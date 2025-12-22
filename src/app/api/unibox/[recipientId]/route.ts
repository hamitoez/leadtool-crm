/**
 * Single Conversation API
 *
 * GET: Get full conversation thread (sent emails + replies)
 * PATCH: Update conversation status (isRead, isStarred, uniboxStatus, notes)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ recipientId: string }>;
}

/**
 * GET /api/unibox/[recipientId]
 * Get full conversation with thread
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { recipientId } = await params;

  try {
    // Get user's organizations
    const userOrgIds = await prisma.organizationMember
      .findMany({
        where: { userId: session.user.id, isActive: true },
        select: { organizationId: true },
      })
      .then((members) => members.map((m) => m.organizationId));

    // Get conversation with full thread
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
            organizationId: true,
          },
        },
        sentEmails: {
          orderBy: { sentAt: "asc" },
          include: {
            account: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
            sequence: {
              select: {
                stepNumber: true,
              },
            },
          },
        },
        replies: {
          orderBy: { receivedAt: "asc" },
          include: {
            account: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!recipient) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Mark as read
    if (!recipient.isRead) {
      await prisma.campaignRecipient.update({
        where: { id: recipientId },
        data: { isRead: true },
      });

      // Also mark all replies as read
      await prisma.campaignReply.updateMany({
        where: { recipientId, isRead: false },
        data: { isRead: true },
      });
    }

    // Build thread (combine sent emails and replies, sorted by time)
    const thread: Array<{
      id: string;
      type: "sent" | "reply";
      subject: string | null;
      body: string | null;
      bodyHtml: string | null;
      fromEmail: string;
      fromName: string | null;
      toEmail: string;
      timestamp: Date;
      account: { id: string; email: string; name: string } | null;
      intent?: string | null;
      stepNumber?: number;
      status?: string;
      openCount?: number;
      clickCount?: number;
    }> = [];

    // Add sent emails to thread
    for (const email of recipient.sentEmails) {
      thread.push({
        id: email.id,
        type: "sent",
        subject: email.subject,
        body: email.body,
        bodyHtml: email.body,
        fromEmail: email.fromEmail,
        fromName: email.account?.name || null,
        toEmail: email.toEmail,
        timestamp: email.sentAt,
        account: email.account,
        stepNumber: email.sequence?.stepNumber,
        status: email.status,
        openCount: email.openCount,
        clickCount: email.clickCount,
      });
    }

    // Add replies to thread
    for (const reply of recipient.replies) {
      thread.push({
        id: reply.id,
        type: "reply",
        subject: reply.subject,
        body: reply.bodyText,
        bodyHtml: reply.bodyHtml,
        fromEmail: reply.fromEmail,
        fromName: reply.fromName,
        toEmail: reply.toEmail,
        timestamp: reply.receivedAt,
        account: reply.account,
        intent: reply.intent,
      });
    }

    // If we have a replyBody but no CampaignReply entries, add it as a reply
    if (recipient.replyBody && recipient.replies.length === 0) {
      thread.push({
        id: "legacy-reply",
        type: "reply",
        subject: null,
        body: recipient.replyBody,
        bodyHtml: null,
        fromEmail: recipient.email,
        fromName: recipient.firstName
          ? `${recipient.firstName} ${recipient.lastName || ""}`.trim()
          : null,
        toEmail: recipient.sentEmails[0]?.fromEmail || "",
        timestamp: recipient.repliedAt || new Date(),
        account: null,
        intent: recipient.replyIntent,
      });
    }

    // Sort thread by timestamp
    thread.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Format response
    const conversation = {
      id: recipient.id,
      email: recipient.email,
      firstName: recipient.firstName,
      lastName: recipient.lastName,
      company: recipient.company,
      fullName:
        [recipient.firstName, recipient.lastName].filter(Boolean).join(" ") ||
        recipient.email,

      // Status
      status: recipient.status,
      replyIntent: recipient.replyIntent,
      replyConfidence: recipient.replyConfidence,
      replySummary: recipient.replySummary,
      uniboxStatus: recipient.uniboxStatus,

      // Unibox flags
      isRead: true, // We just marked it as read
      isStarred: recipient.isStarred,
      isArchived: recipient.isArchived,
      notes: recipient.notes,
      assignedTo: recipient.assignedTo,

      // Dates
      startedAt: recipient.startedAt,
      repliedAt: recipient.repliedAt,
      lastActivityAt: recipient.lastActivityAt,

      // Campaign
      campaign: recipient.campaign,

      // Lead link
      rowId: recipient.rowId,

      // Thread
      thread,
      messageCount: thread.length,
    };

    return NextResponse.json(conversation);
  } catch (error) {
    console.error("[Unibox API] GET error:", error);
    return NextResponse.json(
      { error: "Failed to load conversation" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/unibox/[recipientId]
 * Update conversation status
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { recipientId } = await params;

  try {
    const body = await request.json();
    const {
      isRead,
      isStarred,
      isArchived,
      uniboxStatus,
      notes,
      assignedTo,
      replyIntent,
    } = body;

    // Get user's organizations
    const userOrgIds = await prisma.organizationMember
      .findMany({
        where: { userId: session.user.id, isActive: true },
        select: { organizationId: true },
      })
      .then((members) => members.map((m) => m.organizationId));

    // Verify access
    const recipient = await prisma.campaignRecipient.findFirst({
      where: {
        id: recipientId,
        campaign: {
          organizationId: { in: userOrgIds },
        },
      },
    });

    if (!recipient) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      lastActivityAt: new Date(),
    };

    if (isRead !== undefined) updateData.isRead = isRead;
    if (isStarred !== undefined) updateData.isStarred = isStarred;
    if (isArchived !== undefined) updateData.isArchived = isArchived;
    if (uniboxStatus !== undefined) updateData.uniboxStatus = uniboxStatus;
    if (notes !== undefined) updateData.notes = notes;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    if (replyIntent !== undefined) updateData.replyIntent = replyIntent;

    // Update
    const updated = await prisma.campaignRecipient.update({
      where: { id: recipientId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      conversation: {
        id: updated.id,
        isRead: updated.isRead,
        isStarred: updated.isStarred,
        isArchived: updated.isArchived,
        uniboxStatus: updated.uniboxStatus,
        notes: updated.notes,
        assignedTo: updated.assignedTo,
        replyIntent: updated.replyIntent,
      },
    });
  } catch (error) {
    console.error("[Unibox API] PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update conversation" },
      { status: 500 }
    );
  }
}
