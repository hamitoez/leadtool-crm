import prisma from "@/lib/prisma";
import crypto from "crypto";
import { WebhookEvent, Prisma } from "@prisma/client";

interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
  [key: string]: unknown; // Index signature for Prisma JSON compatibility
}

/**
 * Webhook Dispatcher - sendet Events an konfigurierte Webhooks
 */
export async function dispatchWebhook(
  organizationId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  try {
    // Finde alle aktiven Webhooks für dieses Event
    const webhooks = await prisma.webhook.findMany({
      where: {
        organizationId,
        isActive: true,
        events: { has: event },
      },
    });

    if (webhooks.length === 0) {
      return;
    }

    // Payload erstellen
    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
    };

    // Alle Webhooks parallel triggern (fire-and-forget)
    await Promise.allSettled(
      webhooks.map((webhook) => triggerWebhook(webhook, payload))
    );
  } catch (error) {
    console.error("Webhook dispatch error:", error);
  }
}

async function triggerWebhook(
  webhook: {
    id: string;
    url: string;
    secret: string | null;
    headers: unknown;
    maxRetries: number;
    retryDelay: number;
  },
  payload: WebhookPayload
): Promise<void> {
  const payloadString = JSON.stringify(payload);

  // Headers vorbereiten
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "LeadTool-Webhook/1.0",
    "X-Webhook-Event": payload.event,
    "X-Webhook-ID": webhook.id,
    "X-Webhook-Timestamp": payload.timestamp,
    ...(webhook.headers as Record<string, string>),
  };

  // HMAC-Signatur wenn Secret vorhanden
  if (webhook.secret) {
    const signature = crypto
      .createHmac("sha256", webhook.secret)
      .update(payloadString)
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
      body: payloadString,
      signal: AbortSignal.timeout(30000), // 30s timeout
    });

    responseStatus = response.status;
    responseBody = await response.text();
  } catch (e) {
    error = e instanceof Error ? e.message : "Unknown error";
  }

  const responseTime = Date.now() - startTime;
  const isSuccess = !error && responseStatus && responseStatus >= 200 && responseStatus < 300;

  // Log erstellen
  const log = await prisma.webhookLog.create({
    data: {
      webhookId: webhook.id,
      event: payload.event,
      payload: payload as unknown as Prisma.InputJsonValue,
      requestUrl: webhook.url,
      requestHeaders: headers as Prisma.InputJsonValue,
      responseStatus,
      responseBody: responseBody?.slice(0, 10000), // Max 10KB
      responseTime,
      status: isSuccess ? "success" : (webhook.maxRetries > 0 ? "retrying" : "failed"),
      error,
      retryCount: 0,
      nextRetryAt: !isSuccess && webhook.maxRetries > 0
        ? new Date(Date.now() + webhook.retryDelay * 1000)
        : null,
    },
  });

  // Stats aktualisieren
  if (isSuccess) {
    await prisma.webhook.update({
      where: { id: webhook.id },
      data: {
        lastTriggeredAt: new Date(),
        lastSuccessAt: new Date(),
        successCount: { increment: 1 },
      },
    });
  } else {
    await prisma.webhook.update({
      where: { id: webhook.id },
      data: {
        lastTriggeredAt: new Date(),
        lastFailureAt: new Date(),
        failureCount: { increment: 1 },
      },
    });

    // Retry einplanen wenn noch Versuche übrig
    if (webhook.maxRetries > 0) {
      scheduleRetry(log.id, webhook, payload, 1);
    }
  }
}

async function scheduleRetry(
  logId: string,
  webhook: {
    id: string;
    url: string;
    secret: string | null;
    headers: unknown;
    maxRetries: number;
    retryDelay: number;
  },
  payload: WebhookPayload,
  retryCount: number
): Promise<void> {
  // Exponential backoff: delay * 2^retryCount
  const delay = webhook.retryDelay * Math.pow(2, retryCount - 1) * 1000;

  setTimeout(async () => {
    await retryWebhook(logId, webhook, payload, retryCount);
  }, delay);
}

async function retryWebhook(
  logId: string,
  webhook: {
    id: string;
    url: string;
    secret: string | null;
    headers: unknown;
    maxRetries: number;
    retryDelay: number;
  },
  payload: WebhookPayload,
  retryCount: number
): Promise<void> {
  const payloadString = JSON.stringify(payload);

  // Headers vorbereiten
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "LeadTool-Webhook/1.0",
    "X-Webhook-Event": payload.event,
    "X-Webhook-ID": webhook.id,
    "X-Webhook-Timestamp": payload.timestamp,
    "X-Webhook-Retry": retryCount.toString(),
    ...(webhook.headers as Record<string, string>),
  };

  // HMAC-Signatur wenn Secret vorhanden
  if (webhook.secret) {
    const signature = crypto
      .createHmac("sha256", webhook.secret)
      .update(payloadString)
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
      body: payloadString,
      signal: AbortSignal.timeout(30000), // 30s timeout
    });

    responseStatus = response.status;
    responseBody = await response.text();
  } catch (e) {
    error = e instanceof Error ? e.message : "Unknown error";
  }

  const responseTime = Date.now() - startTime;
  const isSuccess = !error && responseStatus && responseStatus >= 200 && responseStatus < 300;
  const hasMoreRetries = retryCount < webhook.maxRetries;

  // Log aktualisieren
  await prisma.webhookLog.update({
    where: { id: logId },
    data: {
      responseStatus,
      responseBody: responseBody?.slice(0, 10000),
      responseTime,
      status: isSuccess ? "success" : (hasMoreRetries ? "retrying" : "failed"),
      error,
      retryCount,
      nextRetryAt: !isSuccess && hasMoreRetries
        ? new Date(Date.now() + webhook.retryDelay * Math.pow(2, retryCount) * 1000)
        : null,
    },
  });

  // Stats aktualisieren
  if (isSuccess) {
    await prisma.webhook.update({
      where: { id: webhook.id },
      data: {
        lastSuccessAt: new Date(),
        successCount: { increment: 1 },
      },
    });
  } else if (hasMoreRetries) {
    // Nächsten Retry einplanen
    scheduleRetry(logId, webhook, payload, retryCount + 1);
  }
}

// Helper-Funktionen für spezifische Events
export async function dispatchLeadCreated(
  organizationId: string,
  lead: {
    id: string;
    tableId: string;
    projectId: string;
    data: Record<string, unknown>;
  }
): Promise<void> {
  await dispatchWebhook(organizationId, "LEAD_CREATED", {
    lead_id: lead.id,
    table_id: lead.tableId,
    project_id: lead.projectId,
    ...lead.data,
  });
}

export async function dispatchLeadUpdated(
  organizationId: string,
  lead: {
    id: string;
    tableId: string;
    projectId: string;
    changes: Record<string, { old: unknown; new: unknown }>;
  }
): Promise<void> {
  await dispatchWebhook(organizationId, "LEAD_UPDATED", {
    lead_id: lead.id,
    table_id: lead.tableId,
    project_id: lead.projectId,
    changes: lead.changes,
  });
}

export async function dispatchLeadDeleted(
  organizationId: string,
  lead: {
    id: string;
    tableId: string;
    projectId: string;
  }
): Promise<void> {
  await dispatchWebhook(organizationId, "LEAD_DELETED", {
    lead_id: lead.id,
    table_id: lead.tableId,
    project_id: lead.projectId,
  });
}

export async function dispatchDealCreated(
  organizationId: string,
  deal: {
    id: string;
    rowId: string;
    stageId: string;
    stageName: string;
    value: number | null;
    probability: number;
  }
): Promise<void> {
  await dispatchWebhook(organizationId, "DEAL_CREATED", {
    deal_id: deal.id,
    lead_id: deal.rowId,
    stage_id: deal.stageId,
    stage_name: deal.stageName,
    value: deal.value,
    probability: deal.probability,
  });
}

export async function dispatchDealStageChanged(
  organizationId: string,
  deal: {
    id: string;
    rowId: string;
    oldStageId: string;
    oldStageName: string;
    newStageId: string;
    newStageName: string;
    value: number | null;
  }
): Promise<void> {
  await dispatchWebhook(organizationId, "DEAL_STAGE_CHANGED", {
    deal_id: deal.id,
    lead_id: deal.rowId,
    old_stage_id: deal.oldStageId,
    old_stage_name: deal.oldStageName,
    new_stage_id: deal.newStageId,
    new_stage_name: deal.newStageName,
    value: deal.value,
  });
}

export async function dispatchDealWon(
  organizationId: string,
  deal: {
    id: string;
    rowId: string;
    value: number | null;
    wonAt: Date;
  }
): Promise<void> {
  await dispatchWebhook(organizationId, "DEAL_WON", {
    deal_id: deal.id,
    lead_id: deal.rowId,
    value: deal.value,
    won_at: deal.wonAt.toISOString(),
  });
}

export async function dispatchDealLost(
  organizationId: string,
  deal: {
    id: string;
    rowId: string;
    value: number | null;
    lostAt: Date;
    reason: string | null;
  }
): Promise<void> {
  await dispatchWebhook(organizationId, "DEAL_LOST", {
    deal_id: deal.id,
    lead_id: deal.rowId,
    value: deal.value,
    lost_at: deal.lostAt.toISOString(),
    reason: deal.reason,
  });
}

export async function dispatchActivityCreated(
  organizationId: string,
  activity: {
    id: string;
    rowId: string;
    type: string;
    title: string;
    userId: string;
  }
): Promise<void> {
  await dispatchWebhook(organizationId, "ACTIVITY_CREATED", {
    activity_id: activity.id,
    lead_id: activity.rowId,
    type: activity.type,
    title: activity.title,
    user_id: activity.userId,
  });
}

export async function dispatchActivityCompleted(
  organizationId: string,
  activity: {
    id: string;
    rowId: string;
    type: string;
    title: string;
    completedAt: Date;
  }
): Promise<void> {
  await dispatchWebhook(organizationId, "ACTIVITY_COMPLETED", {
    activity_id: activity.id,
    lead_id: activity.rowId,
    type: activity.type,
    title: activity.title,
    completed_at: activity.completedAt.toISOString(),
  });
}
