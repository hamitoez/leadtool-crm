/**
 * Unibox API - Unified Inbox for Campaign Replies
 *
 * GET: List all conversations with replies
 * Supports filtering by: status, intent, campaign, isRead, isStarred
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);

    // Pagination
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    // Filters
    const status = searchParams.get("status"); // REPLIED, BOUNCED, etc.
    const intent = searchParams.get("intent"); // INTERESTED, NOT_INTERESTED, etc.
    const campaignId = searchParams.get("campaignId");
    const isRead = searchParams.get("isRead"); // "true" or "false"
    const isStarred = searchParams.get("isStarred"); // "true" or "false"
    const isArchived = searchParams.get("isArchived"); // "true" or "false"
    const search = searchParams.get("search");
    const uniboxStatus = searchParams.get("uniboxStatus");

    // Get user's organizations
    const userOrgIds = await prisma.organizationMember
      .findMany({
        where: { userId: session.user.id, isActive: true },
        select: { organizationId: true },
      })
      .then((members) => members.map((m) => m.organizationId));

    // Build where clause
    const where: Record<string, unknown> = {
      campaign: {
        organizationId: { in: userOrgIds },
      },
      // Only show recipients that have replies
      repliedAt: { not: null },
    };

    // Apply filters
    if (status) {
      where.status = status;
    }
    if (intent) {
      where.replyIntent = intent;
    }
    if (campaignId) {
      where.campaignId = campaignId;
    }
    if (isRead !== null && isRead !== undefined) {
      where.isRead = isRead === "true";
    }
    if (isStarred === "true") {
      where.isStarred = true;
    }
    if (isArchived !== null && isArchived !== undefined) {
      where.isArchived = isArchived === "true";
    } else {
      // Default: don't show archived
      where.isArchived = false;
    }
    if (uniboxStatus) {
      where.uniboxStatus = uniboxStatus;
    }
    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { company: { contains: search, mode: "insensitive" } },
        { replySummary: { contains: search, mode: "insensitive" } },
      ];
    }

    // Get total count
    const total = await prisma.campaignRecipient.count({ where });

    // Get conversations
    const conversations = await prisma.campaignRecipient.findMany({
      where,
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
        sentEmails: {
          orderBy: { sentAt: "desc" },
          take: 1,
          select: {
            id: true,
            subject: true,
            sentAt: true,
            fromEmail: true,
          },
        },
        replies: {
          orderBy: { receivedAt: "desc" },
          take: 1,
          select: {
            id: true,
            subject: true,
            bodyText: true,
            receivedAt: true,
            isRead: true,
          },
        },
      },
      orderBy: [
        { isRead: "asc" }, // Unread first
        { repliedAt: "desc" }, // Then by reply date
      ],
      skip,
      take: limit,
    });

    // Format response
    const formattedConversations = conversations.map((conv) => ({
      id: conv.id,
      email: conv.email,
      firstName: conv.firstName,
      lastName: conv.lastName,
      company: conv.company,
      fullName: [conv.firstName, conv.lastName].filter(Boolean).join(" ") || conv.email,

      // Status
      status: conv.status,
      replyIntent: conv.replyIntent,
      replyConfidence: conv.replyConfidence,
      replySummary: conv.replySummary,
      uniboxStatus: conv.uniboxStatus,

      // Unibox flags
      isRead: conv.isRead,
      isStarred: conv.isStarred,
      isArchived: conv.isArchived,

      // Last activity
      repliedAt: conv.repliedAt,
      lastActivityAt: conv.lastActivityAt || conv.repliedAt,

      // Campaign
      campaign: conv.campaign,

      // Preview
      lastSentEmail: conv.sentEmails[0] || null,
      lastReply: conv.replies[0]
        ? {
            ...conv.replies[0],
            preview: conv.replies[0].bodyText?.substring(0, 150) || "",
          }
        : conv.replyBody
          ? {
              preview: conv.replyBody.substring(0, 150),
              receivedAt: conv.repliedAt,
            }
          : null,
    }));

    // Get stats for sidebar
    const stats = await getUniboxStats(userOrgIds);

    return NextResponse.json({
      conversations: formattedConversations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats,
    });
  } catch (error) {
    console.error("[Unibox API] Error:", error);
    return NextResponse.json(
      { error: "Failed to load conversations" },
      { status: 500 }
    );
  }
}

/**
 * Get stats for unibox sidebar
 */
async function getUniboxStats(organizationIds: string[]) {
  const baseWhere = {
    campaign: {
      organizationId: { in: organizationIds },
    },
    repliedAt: { not: null },
    isArchived: false,
  };

  const [
    total,
    unread,
    starred,
    interested,
    notInterested,
    meetingRequest,
    question,
  ] = await Promise.all([
    prisma.campaignRecipient.count({ where: baseWhere }),
    prisma.campaignRecipient.count({ where: { ...baseWhere, isRead: false } }),
    prisma.campaignRecipient.count({ where: { ...baseWhere, isStarred: true } }),
    prisma.campaignRecipient.count({
      where: { ...baseWhere, replyIntent: "INTERESTED" },
    }),
    prisma.campaignRecipient.count({
      where: { ...baseWhere, replyIntent: "NOT_INTERESTED" },
    }),
    prisma.campaignRecipient.count({
      where: { ...baseWhere, replyIntent: "MEETING_REQUEST" },
    }),
    prisma.campaignRecipient.count({
      where: { ...baseWhere, replyIntent: "QUESTION" },
    }),
  ]);

  return {
    total,
    unread,
    starred,
    byIntent: {
      INTERESTED: interested,
      NOT_INTERESTED: notInterested,
      MEETING_REQUEST: meetingRequest,
      QUESTION: question,
    },
  };
}
