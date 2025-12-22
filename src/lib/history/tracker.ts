import prisma from "@/lib/prisma";
import { HistoryEventType, Prisma } from "@prisma/client";

interface TrackChangeParams {
  rowId: string;
  userId?: string;
  eventType: HistoryEventType;
  title: string;
  description?: string;
  fieldName?: string;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
  activityId?: string;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Track a change in contact history
 */
export async function trackChange(params: TrackChangeParams) {
  try {
    return await prisma.contactHistory.create({
      data: {
        rowId: params.rowId,
        userId: params.userId || null,
        eventType: params.eventType,
        title: params.title,
        description: params.description,
        fieldName: params.fieldName,
        oldValue: params.oldValue,
        newValue: params.newValue,
        activityId: params.activityId,
        metadata: params.metadata,
      },
    });
  } catch (error) {
    console.error("Error tracking change:", error);
    // Don't throw - history tracking should not break the main operation
    return null;
  }
}

/**
 * Track a field change with automatic formatting
 */
export async function trackFieldChange(params: {
  rowId: string;
  userId: string;
  fieldName: string;
  oldValue: Prisma.InputJsonValue;
  newValue: Prisma.InputJsonValue;
}) {
  const title = `${params.fieldName} geändert`;

  return trackChange({
    rowId: params.rowId,
    userId: params.userId,
    eventType: "FIELD_CHANGED",
    title,
    fieldName: params.fieldName,
    oldValue: params.oldValue,
    newValue: params.newValue,
  });
}

/**
 * Track when a lead is created
 */
export async function trackLeadCreated(params: {
  rowId: string;
  userId: string;
  source?: string;
}) {
  return trackChange({
    rowId: params.rowId,
    userId: params.userId,
    eventType: "CREATED",
    title: "Lead erstellt",
    metadata: { source: params.source || "manual" },
  });
}

/**
 * Track when a lead is scraped
 */
export async function trackLeadScraped(params: {
  rowId: string;
  url: string;
  pagesScraped: number;
  confidence: number;
}) {
  return trackChange({
    rowId: params.rowId,
    eventType: "SCRAPED",
    title: "Website gescraped",
    description: `${params.pagesScraped} Seiten analysiert`,
    metadata: {
      url: params.url,
      pagesScraped: params.pagesScraped,
      confidence: params.confidence,
    },
  });
}

/**
 * Track when a deal is created
 */
export async function trackDealCreated(params: {
  rowId: string;
  userId: string;
  stageName: string;
  stageId: string;
  value?: number;
}) {
  return trackChange({
    rowId: params.rowId,
    userId: params.userId,
    eventType: "DEAL_CREATED",
    title: "Deal erstellt",
    description: `Stage: ${params.stageName}`,
    metadata: {
      stageId: params.stageId,
      stageName: params.stageName,
      value: params.value,
    },
  });
}

/**
 * Track when deal stage changes
 */
export async function trackStageChanged(params: {
  rowId: string;
  userId: string;
  oldStage: { id: string; name: string };
  newStage: { id: string; name: string };
  dealValue?: number;
}) {
  const eventType = params.newStage.name.toLowerCase().includes("gewonnen")
    ? "DEAL_WON"
    : params.newStage.name.toLowerCase().includes("verloren")
    ? "DEAL_LOST"
    : "STAGE_CHANGED";

  const titles: Record<string, string> = {
    DEAL_WON: "Deal gewonnen!",
    DEAL_LOST: "Deal verloren",
    STAGE_CHANGED: `Stage: ${params.oldStage.name} → ${params.newStage.name}`,
  };

  return trackChange({
    rowId: params.rowId,
    userId: params.userId,
    eventType: eventType as HistoryEventType,
    title: titles[eventType],
    oldValue: params.oldStage,
    newValue: params.newStage,
    metadata: {
      dealValue: params.dealValue,
    },
  });
}

/**
 * Track when deal value changes
 */
export async function trackValueChanged(params: {
  rowId: string;
  userId: string;
  oldValue: number | null;
  newValue: number | null;
}) {
  const formatValue = (v: number | null) =>
    v !== null ? `€${v.toLocaleString("de-DE")}` : "€0";

  return trackChange({
    rowId: params.rowId,
    userId: params.userId,
    eventType: "VALUE_CHANGED",
    title: `Wert: ${formatValue(params.oldValue)} → ${formatValue(params.newValue)}`,
    fieldName: "value",
    oldValue: { value: params.oldValue },
    newValue: { value: params.newValue },
  });
}

/**
 * Track when an activity is logged
 */
export async function trackActivityLogged(params: {
  rowId: string;
  userId: string;
  activityId: string;
  activityType: string;
  title: string;
  description?: string;
}) {
  const eventTypeMap: Record<string, HistoryEventType> = {
    CALL: "CALL_LOGGED",
    EMAIL: "EMAIL_SENT",
    MEETING: "MEETING_COMPLETED",
    NOTE: "NOTE_ADDED",
    TASK: "TASK_CREATED",
    DOCUMENT: "DOCUMENT_UPLOADED",
  };

  return trackChange({
    rowId: params.rowId,
    userId: params.userId,
    eventType: eventTypeMap[params.activityType] || "NOTE_ADDED",
    title: params.title,
    description: params.description,
    activityId: params.activityId,
    metadata: { activityType: params.activityType },
  });
}

/**
 * Track when a task is completed
 */
export async function trackTaskCompleted(params: {
  rowId: string;
  userId: string;
  activityId: string;
  taskTitle: string;
}) {
  return trackChange({
    rowId: params.rowId,
    userId: params.userId,
    eventType: "TASK_COMPLETED",
    title: `Task erledigt: ${params.taskTitle}`,
    activityId: params.activityId,
  });
}

/**
 * Track when data is imported
 */
export async function trackImported(params: {
  rowId: string;
  userId: string;
  source: string;
  fieldsImported: string[];
}) {
  return trackChange({
    rowId: params.rowId,
    userId: params.userId,
    eventType: "IMPORTED",
    title: "Daten importiert",
    description: `${params.fieldsImported.length} Felder aus ${params.source}`,
    metadata: {
      source: params.source,
      fieldsImported: params.fieldsImported,
    },
  });
}

export default {
  trackChange,
  trackFieldChange,
  trackLeadCreated,
  trackLeadScraped,
  trackDealCreated,
  trackStageChanged,
  trackValueChanged,
  trackActivityLogged,
  trackTaskCompleted,
  trackImported,
};
