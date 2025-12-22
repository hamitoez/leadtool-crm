import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/webhooks/[webhookId]/logs - Webhook-Logs abrufen
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ webhookId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { webhookId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");
    const status = searchParams.get("status");

    const webhook = await prisma.webhook.findUnique({
      where: { id: webhookId },
    });

    if (!webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    // Prüfe Org-Zugriff
    const member = await prisma.organizationMember.findFirst({
      where: {
        organizationId: webhook.organizationId,
        userId: session.user.id,
        isActive: true,
        role: { in: ["OWNER", "ADMIN"] },
      },
    });

    if (!member) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const where: { webhookId: string; status?: string } = { webhookId };
    if (status) {
      where.status = status;
    }

    const [logs, total] = await Promise.all([
      prisma.webhookLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.webhookLog.count({ where }),
    ]);

    return NextResponse.json({
      logs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + logs.length < total,
      },
    });
  } catch (error) {
    console.error("GET /api/webhooks/[webhookId]/logs error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/webhooks/[webhookId]/logs - Logs löschen
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ webhookId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { webhookId } = await params;

    const webhook = await prisma.webhook.findUnique({
      where: { id: webhookId },
    });

    if (!webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    // Prüfe Org-Zugriff
    const member = await prisma.organizationMember.findFirst({
      where: {
        organizationId: webhook.organizationId,
        userId: session.user.id,
        isActive: true,
        role: { in: ["OWNER", "ADMIN"] },
      },
    });

    if (!member) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { count } = await prisma.webhookLog.deleteMany({
      where: { webhookId },
    });

    return NextResponse.json({ deleted: count });
  } catch (error) {
    console.error("DELETE /api/webhooks/[webhookId]/logs error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
