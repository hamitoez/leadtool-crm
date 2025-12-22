/**
 * Quick-Reply API
 *
 * POST: Send a reply email from the Unibox
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import nodemailer from "nodemailer";

interface RouteParams {
  params: Promise<{ recipientId: string }>;
}

/**
 * POST /api/unibox/[recipientId]/reply
 * Send a quick reply
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { recipientId } = await params;

  try {
    const body = await request.json();
    const { subject, message, accountId } = body;

    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Get user's organizations
    const userOrgIds = await prisma.organizationMember
      .findMany({
        where: { userId: session.user.id, isActive: true },
        select: { organizationId: true },
      })
      .then((members) => members.map((m) => m.organizationId));

    // Get recipient with campaign and last sent email
    const recipient = await prisma.campaignRecipient.findFirst({
      where: {
        id: recipientId,
        campaign: {
          organizationId: { in: userOrgIds },
        },
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            accountIds: true,
            organizationId: true,
          },
        },
        sentEmails: {
          orderBy: { sentAt: "desc" },
          take: 1,
          include: {
            account: true,
          },
        },
        replies: {
          orderBy: { receivedAt: "desc" },
          take: 1,
        },
      },
    });

    if (!recipient) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Determine which account to use
    let account;
    if (accountId) {
      // Use specified account
      account = await prisma.emailAccount.findFirst({
        where: {
          id: accountId,
          organizationId: recipient.campaign.organizationId,
          isActive: true,
          isBlocked: false,
        },
      });
    } else if (recipient.sentEmails[0]?.account) {
      // Use same account as last sent email
      account = recipient.sentEmails[0].account;
    } else if (recipient.campaign.accountIds.length > 0) {
      // Use first campaign account
      account = await prisma.emailAccount.findFirst({
        where: {
          id: { in: recipient.campaign.accountIds },
          isActive: true,
          isBlocked: false,
        },
      });
    }

    if (!account) {
      return NextResponse.json(
        { error: "No email account available" },
        { status: 400 }
      );
    }

    if (!account.smtpHost || !account.smtpUser || !account.smtpPassword) {
      return NextResponse.json(
        { error: "Email account not configured for sending" },
        { status: 400 }
      );
    }

    // Build reply subject
    const lastReply = recipient.replies[0];
    const lastSentEmail = recipient.sentEmails[0];
    const replySubject =
      subject ||
      (lastReply?.subject
        ? lastReply.subject.startsWith("Re:")
          ? lastReply.subject
          : `Re: ${lastReply.subject}`
        : lastSentEmail?.subject
          ? `Re: ${lastSentEmail.subject}`
          : "Re: Your inquiry");

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

    // Build HTML body
    let htmlBody = message.replace(/\n/g, "<br>");
    if (account.signature) {
      htmlBody += `<br><br>--<br>${account.signature}`;
    }

    // Build In-Reply-To and References headers for threading
    const inReplyTo = lastReply?.messageId || lastSentEmail?.messageId;
    const references = inReplyTo ? `<${inReplyTo}>` : undefined;

    // Send email
    const sendResult = await transporter.sendMail({
      from: `"${account.name}" <${account.email}>`,
      to: recipient.email,
      subject: replySubject,
      html: htmlBody,
      text: message,
      headers: {
        ...(inReplyTo && { "In-Reply-To": `<${inReplyTo}>` }),
        ...(references && { References: references }),
        "X-LeadTool-Campaign": recipient.campaignId,
        "X-LeadTool-Reply": "true",
      },
    });

    const messageId = sendResult.messageId?.replace(/[<>]/g, "") || null;

    // Create sent email record
    const sentEmail = await prisma.campaignSentEmail.create({
      data: {
        campaignId: recipient.campaignId,
        recipientId: recipient.id,
        accountId: account.id,
        sequenceId: lastSentEmail?.sequenceId || recipient.sentEmails[0]?.sequenceId || "",
        subject: replySubject,
        body: htmlBody,
        toEmail: recipient.email,
        fromEmail: account.email,
        messageId,
        status: "sent",
        sentAt: new Date(),
      },
    });

    // Update recipient last activity
    await prisma.campaignRecipient.update({
      where: { id: recipientId },
      data: {
        lastActivityAt: new Date(),
      },
    });

    // Update account stats
    await prisma.emailAccount.update({
      where: { id: account.id },
      data: {
        sentToday: { increment: 1 },
        sentTotal: { increment: 1 },
      },
    });

    return NextResponse.json({
      success: true,
      sentEmail: {
        id: sentEmail.id,
        subject: replySubject,
        sentAt: sentEmail.sentAt,
        fromEmail: account.email,
      },
    });
  } catch (error) {
    console.error("[Unibox Reply] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send reply" },
      { status: 500 }
    );
  }
}
