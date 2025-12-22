/**
 * Campaign Email Sender
 *
 * Sends campaign emails via SMTP with tracking support.
 * Handles email personalization, tracking pixel insertion, and link wrapping.
 *
 * REPLY DETECTION:
 * - Uses Reply-To header with tracking ID for near-realtime webhook-based detection
 * - Format: r-{trackingId}@{inboundDomain} (e.g., r-abc123@reply.performanty.de)
 * - Falls back to Message-ID matching via IMAP if webhook not configured
 */

import nodemailer from "nodemailer";
import prisma from "@/lib/prisma";
import { personalizeEmail } from "./spintax";
import { addTrackingPixel, wrapLinksForTracking } from "./tracking";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * Generate Reply-To address with embedded tracking ID
 * Format: r-{trackingId}@{inboundDomain}
 */
function generateReplyToAddress(trackingId: string, inboundDomain: string): string {
  return `r-${trackingId}@${inboundDomain}`;
}

interface SendCampaignEmailParams {
  accountId: string;
  recipientId: string;
  sequenceId: string;
  campaignId: string;
  variantId?: string | null;
}

interface SendCampaignEmailResult {
  success: boolean;
  sentEmailId?: string;
  error?: string;
}

/**
 * Send a single campaign email
 */
export async function sendCampaignEmail(
  params: SendCampaignEmailParams
): Promise<SendCampaignEmailResult> {
  const { accountId, recipientId, sequenceId, campaignId, variantId } = params;

  try {
    // Load all required data including organization's inbound email settings
    const [account, recipient, sequence, campaign] = await Promise.all([
      prisma.emailAccount.findUnique({ where: { id: accountId } }),
      prisma.campaignRecipient.findUnique({ where: { id: recipientId } }),
      prisma.campaignSequence.findUnique({
        where: { id: sequenceId },
        include: { variants: true },
      }),
      prisma.campaign.findUnique({
        where: { id: campaignId },
        include: {
          organization: {
            include: {
              inboundEmailSettings: true,
            },
          },
        },
      }),
    ]);

    if (!account || !recipient || !sequence || !campaign) {
      return {
        success: false,
        error: "Missing required data (account, recipient, sequence, or campaign)",
      };
    }

    // Get inbound email settings for Reply-To header
    const inboundSettings = campaign.organization?.inboundEmailSettings;
    const useReplyToTracking = inboundSettings?.isActive &&
                                inboundSettings?.isVerified &&
                                inboundSettings?.inboundDomain;

    // Check if account has SMTP configured
    if (!account.smtpHost || !account.smtpUser || !account.smtpPassword) {
      return {
        success: false,
        error: "Email account SMTP not configured",
      };
    }

    // Check daily limit
    if (account.sentToday >= account.dailyLimit) {
      return {
        success: false,
        error: "Daily sending limit reached for this account",
      };
    }

    // Get email content (from variant or sequence)
    let subject: string;
    let body: string;
    let actualVariantId: string | null = variantId || null;

    if (variantId) {
      const variant = sequence.variants.find((v) => v.id === variantId);
      if (variant) {
        subject = variant.subject;
        body = variant.body;
      } else {
        subject = sequence.subject;
        body = sequence.body;
        actualVariantId = null;
      }
    } else if (sequence.variants.length > 0) {
      // A/B Testing: Select variant based on weight
      const variant = selectVariant(sequence.variants);
      subject = variant.subject;
      body = variant.body;
      actualVariantId = variant.id;
    } else {
      subject = sequence.subject;
      body = sequence.body;
    }

    // Prepare variables for personalization
    const variables: Record<string, string> = {
      firstName: recipient.firstName || "",
      lastName: recipient.lastName || "",
      fullName: [recipient.firstName, recipient.lastName].filter(Boolean).join(" "),
      email: recipient.email,
      company: recipient.company || "",
      ...(recipient.variables as Record<string, string>),
    };

    // Personalize subject and body (spintax + variables)
    const personalizedSubject = personalizeEmail(subject, variables);
    let personalizedBody = personalizeEmail(body, variables);

    // Create the sent email record first to get trackingId
    const sentEmail = await prisma.campaignSentEmail.create({
      data: {
        campaignId,
        recipientId,
        accountId,
        sequenceId,
        variantId: actualVariantId,
        subject: personalizedSubject,
        body: personalizedBody,
        toEmail: recipient.email,
        fromEmail: account.email,
        status: "sending",
      },
    });

    // Add tracking if enabled
    if (campaign.trackOpens) {
      personalizedBody = addTrackingPixel(personalizedBody, sentEmail.trackingId, APP_URL);
    }
    if (campaign.trackClicks) {
      personalizedBody = wrapLinksForTracking(personalizedBody, sentEmail.trackingId, APP_URL);
    }

    // Update the body with tracking
    await prisma.campaignSentEmail.update({
      where: { id: sentEmail.id },
      data: { body: personalizedBody },
    });

    // Create nodemailer transporter
    const transporter = nodemailer.createTransport({
      host: account.smtpHost,
      port: account.smtpPort || 587,
      secure: account.smtpPort === 465,
      auth: {
        user: account.smtpUser,
        pass: account.smtpPassword,
      },
    });

    // Build email with signature
    let htmlBody = personalizedBody;
    if (account.signature) {
      htmlBody += `<br/><br/>--<br/>${account.signature}`;
    }

    // Build Reply-To header for webhook-based reply detection
    // Format: r-{trackingId}@{inboundDomain}
    let replyTo: string | undefined;
    if (useReplyToTracking && inboundSettings?.inboundDomain) {
      replyTo = generateReplyToAddress(sentEmail.trackingId, inboundSettings.inboundDomain);
    }

    // Send email and capture the message ID for reply detection
    const sendResult = await transporter.sendMail({
      from: `"${account.name}" <${account.email}>`,
      to: recipient.email,
      replyTo, // Enables near-realtime reply detection via webhook
      subject: personalizedSubject,
      html: htmlBody,
      headers: {
        // Custom header for debugging/tracking
        "X-LeadTool-Campaign": campaignId,
        "X-LeadTool-Tracking": sentEmail.trackingId,
      },
    });

    // Extract message ID from the send result
    // Nodemailer returns messageId with angle brackets, we store it without
    const messageId = sendResult.messageId?.replace(/[<>]/g, "") || null;

    // Update sent email status with message ID for reply detection
    await prisma.campaignSentEmail.update({
      where: { id: sentEmail.id },
      data: {
        status: "sent",
        sentAt: new Date(),
        messageId,
      },
    });

    // Update account stats
    await prisma.emailAccount.update({
      where: { id: accountId },
      data: {
        sentToday: { increment: 1 },
        sentTotal: { increment: 1 },
      },
    });

    // Update campaign stats
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        sentCount: { increment: 1 },
        sentTodayCount: { increment: 1 },
      },
    });

    // Update variant stats if applicable
    if (actualVariantId) {
      await prisma.campaignSequenceVariant.update({
        where: { id: actualVariantId },
        data: {
          sentCount: { increment: 1 },
        },
      });
    }

    return {
      success: true,
      sentEmailId: sentEmail.id,
    };
  } catch (error) {
    console.error("Error sending campaign email:", error);

    // If email was created but sending failed, mark as failed
    // Note: We don't have a proper error status in schema, using bounced as fallback
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Select a variant based on weight distribution
 */
function selectVariant(variants: Array<{ id: string; weight: number }>): { id: string; weight: number; subject: string; body: string } {
  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
  let random = Math.random() * totalWeight;

  for (const variant of variants) {
    random -= variant.weight;
    if (random <= 0) {
      return variant as { id: string; weight: number; subject: string; body: string };
    }
  }

  return variants[0] as { id: string; weight: number; subject: string; body: string };
}

/**
 * Reset daily sending counters for all accounts (call at midnight)
 */
export async function resetDailySendingCounters(): Promise<void> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  await prisma.emailAccount.updateMany({
    where: {
      lastResetAt: { lt: startOfDay },
    },
    data: {
      sentToday: 0,
      lastResetAt: now,
    },
  });

  // Also reset campaign daily counters
  await prisma.campaign.updateMany({
    where: {
      status: "ACTIVE",
    },
    data: {
      sentTodayCount: 0,
    },
  });
}

/**
 * Get an available email account for sending (round-robin with limit check)
 */
export async function getAvailableAccount(
  accountIds: string[]
): Promise<string | null> {
  const accounts = await prisma.emailAccount.findMany({
    where: {
      id: { in: accountIds },
      isActive: true,
      isBlocked: false,
    },
    orderBy: { sentToday: "asc" }, // Use account with least sends today
  });

  for (const account of accounts) {
    if (account.sentToday < account.dailyLimit) {
      return account.id;
    }
  }

  return null;
}
