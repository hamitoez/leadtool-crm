import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import crypto from "crypto";

// GET /api/webhooks/[webhookId] - Einzelnen Webhook abrufen
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

    const webhook = await prisma.webhook.findUnique({
      where: { id: webhookId },
      include: {
        _count: {
          select: { logs: true },
        },
        logs: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
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

    return NextResponse.json(webhook);
  } catch (error) {
    console.error("GET /api/webhooks/[webhookId] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/webhooks/[webhookId] - Webhook aktualisieren
const updateWebhookSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().url().optional(),
  secret: z.string().optional().nullable(),
  events: z.array(z.enum([
    "LEAD_CREATED", "LEAD_UPDATED", "LEAD_DELETED",
    "DEAL_CREATED", "DEAL_UPDATED", "DEAL_DELETED",
    "DEAL_STAGE_CHANGED", "DEAL_WON", "DEAL_LOST",
    "ACTIVITY_CREATED", "ACTIVITY_COMPLETED",
    "PIPELINE_CREATED", "STAGE_CREATED",
  ])).min(1).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  isActive: z.boolean().optional(),
  maxRetries: z.number().min(0).max(10).optional(),
  retryDelay: z.number().min(10).max(3600).optional(),
});

export async function PATCH(
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

    const body = await request.json();
    const input = updateWebhookSchema.parse(body);

    const updated = await prisma.webhook.update({
      where: { id: webhookId },
      data: {
        ...input,
        headers: input.headers !== undefined ? input.headers : undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/webhooks/[webhookId] error:", error);
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

// DELETE /api/webhooks/[webhookId] - Webhook löschen
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

    await prisma.webhook.delete({
      where: { id: webhookId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/webhooks/[webhookId] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/webhooks/[webhookId] - Webhook testen
export async function POST(
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

    // Test-Payload erstellen
    const testPayload = {
      event: "TEST",
      timestamp: new Date().toISOString(),
      data: {
        message: "This is a test webhook from LeadTool CRM",
        webhook_id: webhook.id,
        webhook_name: webhook.name,
      },
    };

    // Headers vorbereiten
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "LeadTool-Webhook/1.0",
      "X-Webhook-Event": "TEST",
      "X-Webhook-ID": webhook.id,
      ...(webhook.headers as Record<string, string>),
    };

    // HMAC-Signatur wenn Secret vorhanden
    if (webhook.secret) {
      const signature = crypto
        .createHmac("sha256", webhook.secret)
        .update(JSON.stringify(testPayload))
        .digest("hex");
      headers["X-Webhook-Signature"] = `sha256=${signature}`;
    }

    // Webhook senden
    const startTime = Date.now();
    let responseStatus: number | null = null;
    let responseBody: string | null = null;
    let error: string | null = null;

    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers,
        body: JSON.stringify(testPayload),
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      responseStatus = response.status;
      responseBody = await response.text();
    } catch (e) {
      error = e instanceof Error ? e.message : "Unknown error";
    }

    const responseTime = Date.now() - startTime;

    // Log erstellen (als TEST event - wir verwenden den ersten Event-Typ)
    await prisma.webhookLog.create({
      data: {
        webhookId: webhook.id,
        event: webhook.events[0] || "LEAD_CREATED", // Fallback
        payload: testPayload,
        requestUrl: webhook.url,
        requestHeaders: headers,
        responseStatus,
        responseBody: responseBody?.slice(0, 10000), // Max 10KB
        responseTime,
        status: error ? "failed" : (responseStatus && responseStatus >= 200 && responseStatus < 300 ? "success" : "failed"),
        error,
      },
    });

    // Stats aktualisieren
    if (!error && responseStatus && responseStatus >= 200 && responseStatus < 300) {
      await prisma.webhook.update({
        where: { id: webhookId },
        data: {
          lastTriggeredAt: new Date(),
          lastSuccessAt: new Date(),
          successCount: { increment: 1 },
        },
      });
    } else {
      await prisma.webhook.update({
        where: { id: webhookId },
        data: {
          lastTriggeredAt: new Date(),
          lastFailureAt: new Date(),
          failureCount: { increment: 1 },
        },
      });
    }

    return NextResponse.json({
      success: !error && responseStatus && responseStatus >= 200 && responseStatus < 300,
      responseStatus,
      responseTime,
      error,
      responseBody: responseBody?.slice(0, 1000), // Max 1KB in response
    });
  } catch (error) {
    console.error("POST /api/webhooks/[webhookId] test error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
