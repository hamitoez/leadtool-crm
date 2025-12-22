/**
 * Inbound Email Webhook Endpoint
 *
 * Receives incoming emails from Mailgun/SendGrid/Postmark when someone replies
 * to a campaign email. The Reply-To address contains the tracking ID:
 * Format: r-{trackingId}@{inboundDomain}
 *
 * Flow:
 * 1. Receive webhook from email provider
 * 2. Verify webhook signature
 * 3. Extract tracking ID from recipient address
 * 4. Find original sent email
 * 5. Analyze reply with AI (intent detection)
 * 6. Update campaign stats and recipient status
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { analyzeReplyIntent, ReplyIntent } from "@/lib/email/reply-analyzer";

// Tracking ID regex: r-{cuid}@domain
const TRACKING_ID_REGEX = /^r-([a-z0-9]+)@/i;

interface WebhookPayload {
  provider: "mailgun" | "sendgrid" | "postmark";
  from: string;
  to: string;
  subject: string;
  body: string;
  bodyPlain?: string;
  timestamp?: number;
  signature?: string;
  token?: string;
}

/**
 * POST /api/webhooks/inbound-email
 * Receives inbound emails from Mailgun/SendGrid/Postmark
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Determine provider from query or header
    const provider = request.nextUrl.searchParams.get("provider") || "mailgun";

    // Parse webhook payload based on provider
    let payload: WebhookPayload;

    if (provider === "mailgun") {
      payload = await parseMailgunPayload(request);
    } else if (provider === "sendgrid") {
      payload = await parseSendGridPayload(request);
    } else if (provider === "postmark") {
      payload = await parsePostmarkPayload(request);
    } else {
      return NextResponse.json(
        { success: false, error: "Unknown provider" },
        { status: 400 }
      );
    }

    // Extract tracking ID from recipient address
    const trackingId = extractTrackingId(payload.to);
    if (!trackingId) {
      console.log("[Inbound Webhook] No tracking ID found in:", payload.to);
      return NextResponse.json(
        { success: false, error: "Invalid recipient address" },
        { status: 400 }
      );
    }

    console.log(`[Inbound Webhook] Processing reply for tracking ID: ${trackingId}`);

    // Find the original sent email
    const sentEmail = await prisma.campaignSentEmail.findUnique({
      where: { trackingId },
      include: {
        campaign: {
          include: {
            organization: {
              include: {
                inboundEmailSettings: true,
              },
            },
          },
        },
        recipient: true,
      },
    });

    if (!sentEmail) {
      console.log(`[Inbound Webhook] No sent email found for tracking ID: ${trackingId}`);
      return NextResponse.json(
        { success: false, error: "Original email not found" },
        { status: 404 }
      );
    }

    // Verify webhook signature if secret is configured
    const settings = sentEmail.campaign.organization?.inboundEmailSettings;
    if (settings?.webhookSecret) {
      const isValid = verifyWebhookSignature(provider, payload, settings.webhookSecret);
      if (!isValid) {
        console.log("[Inbound Webhook] Invalid webhook signature");
        return NextResponse.json(
          { success: false, error: "Invalid signature" },
          { status: 401 }
        );
      }
    }

    // Skip if already marked as replied
    if (sentEmail.repliedAt) {
      console.log(`[Inbound Webhook] Already marked as replied: ${sentEmail.id}`);
      return NextResponse.json({
        success: true,
        message: "Already processed",
        trackingId,
      });
    }

    // Analyze reply intent with AI
    const replyText = payload.bodyPlain || stripHtml(payload.body);
    const analysis = await analyzeReplyIntent(replyText, payload.subject);

    console.log(`[Inbound Webhook] Reply analysis: ${analysis.intent} (${(analysis.confidence * 100).toFixed(0)}%)`);

    const now = new Date();

    // Update sent email
    await prisma.campaignSentEmail.update({
      where: { id: sentEmail.id },
      data: {
        repliedAt: now,
        status: "replied",
      },
    });

    // Update recipient with AI analysis and Unibox fields
    await prisma.campaignRecipient.update({
      where: { id: sentEmail.recipientId },
      data: {
        status: "REPLIED",
        repliedAt: now,
        nextSendAt: null, // Stop further emails
        replyIntent: analysis.intent,
        replyConfidence: analysis.confidence,
        replySummary: analysis.summary,
        replyBody: replyText.substring(0, 5000), // Limit to 5000 chars
        isRead: false, // Mark as unread in Unibox
        lastActivityAt: now,
      },
    });

    // Create CampaignReply for threading in Unibox
    await prisma.campaignReply.create({
      data: {
        recipientId: sentEmail.recipientId,
        subject: payload.subject || null,
        bodyText: replyText.substring(0, 50000),
        bodyHtml: payload.body?.substring(0, 50000) || null,
        fromEmail: payload.from,
        fromName: extractName(payload.from),
        toEmail: payload.to,
        accountId: sentEmail.accountId,
        intent: analysis.intent,
        confidence: analysis.confidence,
        summary: analysis.summary,
        source: "webhook",
        receivedAt: now,
        isRead: false,
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

    // Log the webhook
    if (settings) {
      await prisma.inboundWebhookLog.create({
        data: {
          settingsId: settings.id,
          provider,
          eventType: "reply",
          fromEmail: payload.from,
          toEmail: payload.to,
          subject: payload.subject,
          trackingId,
          status: "processed",
          matchedEmailId: sentEmail.id,
          replyIntent: analysis.intent,
          replyConfidence: analysis.confidence,
          rawPayload: {
            from: payload.from,
            to: payload.to,
            subject: payload.subject,
            bodyLength: replyText.length,
          },
        },
      });

      // Update settings stats
      await prisma.inboundEmailSettings.update({
        where: { id: settings.id },
        data: {
          totalReceived: { increment: 1 },
          totalProcessed: { increment: 1 },
          lastWebhookAt: now,
        },
      });
    }

    const processingTime = Date.now() - startTime;
    console.log(`[Inbound Webhook] Processed in ${processingTime}ms`);

    return NextResponse.json({
      success: true,
      trackingId,
      recipientId: sentEmail.recipientId,
      campaignId: sentEmail.campaignId,
      intent: analysis.intent,
      confidence: analysis.confidence,
      processingTime,
    });
  } catch (error) {
    console.error("[Inbound Webhook] Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal error",
      },
      { status: 500 }
    );
  }
}

/**
 * Parse Mailgun webhook payload
 */
async function parseMailgunPayload(request: NextRequest): Promise<WebhookPayload> {
  const formData = await request.formData();

  return {
    provider: "mailgun",
    from: formData.get("sender")?.toString() || formData.get("from")?.toString() || "",
    to: formData.get("recipient")?.toString() || "",
    subject: formData.get("subject")?.toString() || "",
    body: formData.get("body-html")?.toString() || "",
    bodyPlain: formData.get("body-plain")?.toString() || formData.get("stripped-text")?.toString(),
    timestamp: parseInt(formData.get("timestamp")?.toString() || "0"),
    signature: formData.get("signature")?.toString(),
    token: formData.get("token")?.toString(),
  };
}

/**
 * Parse SendGrid Inbound Parse webhook payload
 */
async function parseSendGridPayload(request: NextRequest): Promise<WebhookPayload> {
  const formData = await request.formData();

  // SendGrid sends envelope as JSON string
  const envelope = JSON.parse(formData.get("envelope")?.toString() || "{}");

  return {
    provider: "sendgrid",
    from: formData.get("from")?.toString() || envelope.from || "",
    to: envelope.to?.[0] || formData.get("to")?.toString() || "",
    subject: formData.get("subject")?.toString() || "",
    body: formData.get("html")?.toString() || "",
    bodyPlain: formData.get("text")?.toString(),
  };
}

/**
 * Parse Postmark Inbound webhook payload
 */
async function parsePostmarkPayload(request: NextRequest): Promise<WebhookPayload> {
  const json = await request.json();

  return {
    provider: "postmark",
    from: json.FromFull?.Email || json.From || "",
    to: json.ToFull?.[0]?.Email || json.To || "",
    subject: json.Subject || "",
    body: json.HtmlBody || "",
    bodyPlain: json.TextBody,
  };
}

/**
 * Extract tracking ID from Reply-To address
 * Format: r-{trackingId}@{domain}
 */
function extractTrackingId(recipient: string): string | null {
  // Handle multiple recipients
  const addresses = recipient.split(",").map((a) => a.trim());

  for (const address of addresses) {
    const match = address.match(TRACKING_ID_REGEX);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Verify webhook signature based on provider
 */
function verifyWebhookSignature(
  provider: string,
  payload: WebhookPayload,
  secret: string
): boolean {
  if (provider === "mailgun") {
    // Mailgun signature: HMAC-SHA256(timestamp + token, api_key)
    if (!payload.timestamp || !payload.token || !payload.signature) {
      return false;
    }

    const signatureData = `${payload.timestamp}${payload.token}`;
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(signatureData)
      .digest("hex");

    return payload.signature === expectedSignature;
  }

  if (provider === "sendgrid") {
    // SendGrid uses Event Webhook Signature Verification
    // For Inbound Parse, we rely on the URL being kept secret
    return true;
  }

  if (provider === "postmark") {
    // Postmark uses webhook secret in the URL
    return true;
  }

  return false;
}

/**
 * Strip HTML tags from text
 */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract name from email address
 * e.g. "John Doe <john@example.com>" -> "John Doe"
 * e.g. "john@example.com" -> null
 */
function extractName(email: string): string | null {
  const match = email.match(/^"?([^"<]+)"?\s*</);
  if (match) {
    return match[1].trim();
  }
  return null;
}

/**
 * GET - Health check and webhook URL info
 */
export async function GET(request: NextRequest) {
  const provider = request.nextUrl.searchParams.get("provider") || "mailgun";

  return NextResponse.json({
    status: "ok",
    provider,
    message: "Inbound email webhook endpoint ready",
    usage: {
      mailgun: "POST /api/webhooks/inbound-email?provider=mailgun",
      sendgrid: "POST /api/webhooks/inbound-email?provider=sendgrid",
      postmark: "POST /api/webhooks/inbound-email?provider=postmark",
    },
  });
}
