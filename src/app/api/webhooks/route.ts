import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

// GET /api/webhooks - Liste aller Webhooks der Organisation
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    if (!organizationId) {
      return NextResponse.json(
        { error: "organizationId required" },
        { status: 400 }
      );
    }

    // Prüfe Org-Zugriff
    const member = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: session.user.id,
        isActive: true,
        role: { in: ["OWNER", "ADMIN"] },
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Access denied - Admin required" },
        { status: 403 }
      );
    }

    const webhooks = await prisma.webhook.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { logs: true },
        },
      },
    });

    return NextResponse.json(webhooks);
  } catch (error) {
    console.error("GET /api/webhooks error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/webhooks - Neuen Webhook erstellen
const createWebhookSchema = z.object({
  organizationId: z.string(),
  name: z.string().min(1).max(100),
  url: z.string().url(),
  secret: z.string().optional(),
  events: z.array(z.enum([
    "LEAD_CREATED", "LEAD_UPDATED", "LEAD_DELETED",
    "DEAL_CREATED", "DEAL_UPDATED", "DEAL_DELETED",
    "DEAL_STAGE_CHANGED", "DEAL_WON", "DEAL_LOST",
    "ACTIVITY_CREATED", "ACTIVITY_COMPLETED",
    "PIPELINE_CREATED", "STAGE_CREATED",
  ])).min(1),
  headers: z.record(z.string(), z.string()).optional(),
  maxRetries: z.number().min(0).max(10).optional(),
  retryDelay: z.number().min(10).max(3600).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const input = createWebhookSchema.parse(body);

    // Prüfe Org-Zugriff
    const member = await prisma.organizationMember.findFirst({
      where: {
        organizationId: input.organizationId,
        userId: session.user.id,
        isActive: true,
        role: { in: ["OWNER", "ADMIN"] },
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Access denied - Admin required" },
        { status: 403 }
      );
    }

    const webhook = await prisma.webhook.create({
      data: {
        organizationId: input.organizationId,
        name: input.name,
        url: input.url,
        secret: input.secret,
        events: input.events,
        headers: input.headers || {},
        maxRetries: input.maxRetries ?? 3,
        retryDelay: input.retryDelay ?? 60,
        createdBy: session.user.id,
      },
    });

    return NextResponse.json(webhook, { status: 201 });
  } catch (error) {
    console.error("POST /api/webhooks error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", issues: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
