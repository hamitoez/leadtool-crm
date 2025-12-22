/**
 * IMAP Sync Service (FALLBACK MODE)
 *
 * This service runs as a FALLBACK for reply detection when:
 * 1. Webhook-based detection is not configured
 * 2. Someone replies directly instead of using Reply-To
 * 3. Edge cases where webhook delivery fails
 *
 * Primary reply detection should use the webhook endpoint at:
 * /api/webhooks/inbound-email
 *
 * The IMAP sync checks if emails were already processed via webhook
 * to avoid duplicate processing.
 */

import { ImapFlow } from "imapflow";
import prisma from "@/lib/prisma";
import { detectReplyOrBounce, EmailAnalysisResult } from "./reply-detector";
import { analyzeReplyIntent } from "./reply-analyzer";

// Maximum accounts to process per sync run
const MAX_ACCOUNTS_PER_RUN = 10;

// Maximum emails to process per account
const MAX_EMAILS_PER_ACCOUNT = 50;

interface SyncResult {
  accountId: string;
  accountEmail: string;
  success: boolean;
  emailsProcessed: number;
  repliesFound: number;
  bouncesFound: number;
  error?: string;
}

interface ImapSyncStats {
  totalAccounts: number;
  successfulSyncs: number;
  failedSyncs: number;
  totalEmailsProcessed: number;
  totalRepliesFound: number;
  totalBouncesFound: number;
  results: SyncResult[];
}

/**
 * Main sync function - syncs all active email accounts
 */
export async function syncAllAccounts(): Promise<ImapSyncStats> {
  console.log("[IMAP Sync] Starting sync for all accounts...");

  // Get active accounts with IMAP configured
  const accounts = await prisma.emailAccount.findMany({
    where: {
      isActive: true,
      isBlocked: false,
      imapHost: { not: null },
      imapUser: { not: null },
      imapPassword: { not: null },
    },
    take: MAX_ACCOUNTS_PER_RUN,
    orderBy: { lastSyncAt: "asc" }, // Sync oldest first
  });

  const stats: ImapSyncStats = {
    totalAccounts: accounts.length,
    successfulSyncs: 0,
    failedSyncs: 0,
    totalEmailsProcessed: 0,
    totalRepliesFound: 0,
    totalBouncesFound: 0,
    results: [],
  };

  for (const account of accounts) {
    const result = await syncAccount(account);
    stats.results.push(result);

    if (result.success) {
      stats.successfulSyncs++;
      stats.totalEmailsProcessed += result.emailsProcessed;
      stats.totalRepliesFound += result.repliesFound;
      stats.totalBouncesFound += result.bouncesFound;
    } else {
      stats.failedSyncs++;
    }
  }

  console.log(
    `[IMAP Sync] Completed: ${stats.successfulSyncs}/${stats.totalAccounts} accounts, ` +
      `${stats.totalEmailsProcessed} emails, ${stats.totalRepliesFound} replies, ${stats.totalBouncesFound} bounces`
  );

  return stats;
}

/**
 * Sync a single email account
 */
async function syncAccount(account: {
  id: string;
  email: string;
  imapHost: string | null;
  imapPort: number | null;
  imapUser: string | null;
  imapPassword: string | null;
  imapSecure: boolean;
  lastSyncAt: Date | null;
  organizationId: string | null;
}): Promise<SyncResult> {
  const result: SyncResult = {
    accountId: account.id,
    accountEmail: account.email,
    success: false,
    emailsProcessed: 0,
    repliesFound: 0,
    bouncesFound: 0,
  };

  if (!account.imapHost || !account.imapUser || !account.imapPassword) {
    result.error = "IMAP not configured";
    return result;
  }

  let client: ImapFlow | null = null;

  try {
    console.log(`[IMAP Sync] Connecting to ${account.email}...`);

    // Create IMAP client
    client = new ImapFlow({
      host: account.imapHost,
      port: account.imapPort || 993,
      secure: account.imapSecure,
      auth: {
        user: account.imapUser,
        pass: account.imapPassword,
      },
      logger: false, // Disable verbose logging
    });

    // Connect
    await client.connect();

    // Open INBOX
    const mailbox = await client.getMailboxLock("INBOX");

    try {
      // Calculate search date (since last sync, or last 7 days if never synced)
      const sinceDate = account.lastSyncAt
        ? new Date(account.lastSyncAt.getTime() - 60000) // 1 minute overlap for safety
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Search for emails since last sync
      const searchResult = await client.search(
        { since: sinceDate },
        { uid: true }
      );

      // search() returns false if no matches, or number[] of UIDs
      const messages = searchResult === false ? [] : searchResult;

      if (messages.length === 0) {
        console.log(`[IMAP Sync] ${account.email}: No new emails`);
        result.success = true;
        await updateLastSyncAt(account.id);
        return result;
      }

      console.log(`[IMAP Sync] ${account.email}: Found ${messages.length} emails to process`);

      // Limit emails to process
      const uidsToProcess = messages.slice(0, MAX_EMAILS_PER_ACCOUNT);

      // Fetch and process emails one by one to handle deleted/invalid UIDs gracefully
      for (const uid of uidsToProcess) {
        try {
          // Fetch single email
          const fetchIterator = client.fetch([uid], {
            envelope: true,
            source: true,
            uid: true,
          });

          for await (const message of fetchIterator) {
            // Skip if envelope or source is missing
            if (!message.envelope || !message.source) {
              console.log(`[IMAP Sync] Skipping email UID ${message.uid}: missing envelope or source`);
              continue;
            }

            // Extract references header from raw source if needed
            const sourceStr = message.source.toString();
            const referencesMatch = sourceStr.match(/^References:\s*(.+?)(?:\r?\n(?!\s)|$)/im);
            const references = referencesMatch ? referencesMatch[1].trim() : "";

            const analysisResult = await processEmail(account, {
              uid: message.uid,
              envelope: {
                messageId: message.envelope.messageId || undefined,
                inReplyTo: message.envelope.inReplyTo || undefined,
                references: references || undefined,
                from: message.envelope.from?.map(f => ({
                  address: f.address || undefined,
                  name: f.name || undefined
                })),
                subject: message.envelope.subject || undefined,
                date: message.envelope.date || undefined,
              },
              source: message.source,
            });
            result.emailsProcessed++;

            if (analysisResult.isReply) {
              result.repliesFound++;
            }
            if (analysisResult.isBounce) {
              result.bouncesFound++;
            }
          }
        } catch (emailError) {
          // Skip individual email errors (e.g., deleted emails)
          // Don't log full error to avoid spam, just count as skipped
        }
      }

      result.success = true;
      await updateLastSyncAt(account.id);
    } finally {
      mailbox.release();
    }
  } catch (error) {
    console.error(`[IMAP Sync] Error syncing ${account.email}:`, error);
    result.error = error instanceof Error ? error.message : "Unknown error";
  } finally {
    if (client) {
      try {
        await client.logout();
      } catch {
        // Ignore logout errors
      }
    }
  }

  return result;
}

/**
 * Process a single email
 */
async function processEmail(
  account: { id: string; organizationId: string | null },
  message: {
    uid: number;
    envelope: {
      messageId?: string;
      inReplyTo?: string;
      references?: string;
      from?: Array<{ address?: string; name?: string }>;
      subject?: string;
      date?: Date;
    };
    source: Buffer;
  }
): Promise<EmailAnalysisResult> {
  const envelope = message.envelope;
  const source = message.source.toString();

  // Analyze the email for reply/bounce detection
  const analysis = await detectReplyOrBounce({
    messageId: envelope.messageId || "",
    inReplyTo: envelope.inReplyTo || "",
    references: envelope.references || "",
    from: envelope.from?.[0]?.address || "",
    fromName: envelope.from?.[0]?.name || "",
    subject: envelope.subject || "",
    body: source,
    date: envelope.date || new Date(),
  });

  // If it's a reply to a campaign email
  if (analysis.isReply && analysis.originalMessageId) {
    // Pass the reply body for AI analysis
    await handleReply(
      analysis.originalMessageId,
      envelope.date || new Date(),
      source, // Full email body
      envelope.subject
    );
  }

  // If it's a bounce
  if (analysis.isBounce && analysis.bouncedRecipient) {
    await handleBounce(
      analysis.bouncedRecipient,
      analysis.bounceReason || "Delivery failed",
      envelope.date || new Date()
    );
  }

  return analysis;
}

/**
 * Handle a reply to a campaign email (IMAP Fallback)
 *
 * This is called when IMAP detects a reply. It checks if the reply
 * was already processed via webhook to avoid duplicates.
 */
async function handleReply(
  originalMessageId: string,
  repliedAt: Date,
  replyBody?: string,
  replySubject?: string
): Promise<void> {
  // Clean the message ID (remove angle brackets if present)
  const cleanMessageId = originalMessageId.replace(/[<>]/g, "");

  // Find the original sent email
  const sentEmail = await prisma.campaignSentEmail.findUnique({
    where: { messageId: cleanMessageId },
    include: {
      campaign: true,
      recipient: true,
    },
  });

  if (!sentEmail) {
    console.log(`[IMAP Sync] Reply to unknown messageId: ${cleanMessageId}`);
    return;
  }

  // Skip if already marked as replied (likely processed via webhook)
  if (sentEmail.repliedAt) {
    console.log(`[IMAP Sync] Already processed (likely via webhook): ${sentEmail.id}`);
    return;
  }

  console.log(
    `[IMAP Sync] FALLBACK: Reply detected for campaign ${sentEmail.campaignId}, recipient ${sentEmail.toEmail}`
  );

  // Analyze reply intent with AI if we have the body
  let replyIntent: string | undefined;
  let replyConfidence: number | undefined;
  let replySummary: string | undefined;

  if (replyBody) {
    try {
      const analysis = await analyzeReplyIntent(replyBody, replySubject);
      replyIntent = analysis.intent;
      replyConfidence = analysis.confidence;
      replySummary = analysis.summary;
      console.log(`[IMAP Sync] AI Analysis: ${replyIntent} (${(replyConfidence * 100).toFixed(0)}%)`);
    } catch (error) {
      console.error("[IMAP Sync] AI analysis failed:", error);
    }
  }

  // Update sent email
  await prisma.campaignSentEmail.update({
    where: { id: sentEmail.id },
    data: {
      repliedAt,
      status: "replied",
    },
  });

  // Update recipient with AI analysis
  await prisma.campaignRecipient.update({
    where: { id: sentEmail.recipientId },
    data: {
      status: "REPLIED",
      repliedAt,
      nextSendAt: null, // Stop further emails
      replyIntent,
      replyConfidence,
      replySummary,
      replyBody: replyBody?.substring(0, 5000), // Store reply text
    },
  });

  // Update campaign stats
  await prisma.campaign.update({
    where: { id: sentEmail.campaignId },
    data: {
      replyCount: { increment: 1 },
    },
  });

  // Update variant stats if applicable
  if (sentEmail.variantId) {
    await prisma.campaignSequenceVariant.update({
      where: { id: sentEmail.variantId },
      data: {
        replyCount: { increment: 1 },
      },
    });
  }
}

/**
 * Handle a bounced email
 */
async function handleBounce(
  bouncedEmail: string,
  bounceReason: string,
  bouncedAt: Date
): Promise<void> {
  console.log(`[IMAP Sync] Bounce detected for: ${bouncedEmail}`);

  // Find recent sent emails to this recipient (within last 7 days)
  const recentDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const sentEmail = await prisma.campaignSentEmail.findFirst({
    where: {
      toEmail: bouncedEmail.toLowerCase(),
      sentAt: { gte: recentDate },
      bouncedAt: null, // Not already bounced
    },
    orderBy: { sentAt: "desc" },
    include: {
      campaign: true,
    },
  });

  if (!sentEmail) {
    console.log(`[IMAP Sync] No recent sent email found for bounce: ${bouncedEmail}`);
    return;
  }

  // Update sent email
  await prisma.campaignSentEmail.update({
    where: { id: sentEmail.id },
    data: {
      bouncedAt,
      bounceReason,
      status: "bounced",
    },
  });

  // Update recipient
  await prisma.campaignRecipient.update({
    where: { id: sentEmail.recipientId },
    data: {
      status: "BOUNCED",
      bouncedAt,
      nextSendAt: null, // Stop further emails
    },
  });

  // Update campaign stats
  await prisma.campaign.update({
    where: { id: sentEmail.campaignId },
    data: {
      bounceCount: { increment: 1 },
    },
  });

  // Update account bounce count
  await prisma.emailAccount.update({
    where: { id: sentEmail.accountId },
    data: {
      bounceCount: { increment: 1 },
      lastBounceAt: bouncedAt,
    },
  });
}

/**
 * Update the lastSyncAt timestamp for an account
 */
async function updateLastSyncAt(accountId: string): Promise<void> {
  await prisma.emailAccount.update({
    where: { id: accountId },
    data: { lastSyncAt: new Date() },
  });
}
