// Workflow Trigger Service
// Automatically triggers workflows based on events

import prisma from "@/lib/prisma";
import { executeWorkflow } from "./engine";

export type TriggerEvent =
  | "DEAL_CREATED"
  | "STAGE_CHANGED"
  | "NO_ACTIVITY"
  | "EMAIL_OPENED"
  | "EMAIL_NOT_OPENED"
  | "EMAIL_CLICKED"
  | "TASK_OVERDUE"
  | "MEETING_SCHEDULED"
  | "MEETING_COMPLETED"
  | "CALL_COMPLETED";

interface TriggerContext {
  userId: string;
  rowId?: string;
  dealId?: string;
  pipelineId?: string;
  stageId?: string;
  oldStageId?: string;
  variables?: Record<string, unknown>;
}

/**
 * Trigger workflows based on an event
 * Finds all active workflows with matching trigger and executes them
 */
export async function triggerWorkflows(
  event: TriggerEvent,
  context: TriggerContext
): Promise<{ executed: number; results: Array<{ workflowId: string; success: boolean; error?: string }> }> {
  const results: Array<{ workflowId: string; success: boolean; error?: string }> = [];

  try {
    // Find all active workflows with matching trigger
    const workflows = await prisma.workflow.findMany({
      where: {
        userId: context.userId,
        isActive: true,
        nodes: {
          some: {
            nodeType: "TRIGGER",
            subType: event,
          },
        },
      },
      include: {
        nodes: {
          where: {
            nodeType: "TRIGGER",
            subType: event,
          },
        },
      },
    });

    // Filter workflows based on trigger configuration
    const matchingWorkflows = workflows.filter((workflow) => {
      const triggerNode = workflow.nodes[0];
      if (!triggerNode) return false;

      const config = triggerNode.config as Record<string, unknown>;

      // Check pipeline filter
      if (config.pipelineId && config.pipelineId !== context.pipelineId) {
        return false;
      }

      // Check stage filter for STAGE_CHANGED
      if (event === "STAGE_CHANGED" && config.stageIds) {
        const stageIds = config.stageIds as string[];
        if (stageIds.length > 0 && context.stageId && !stageIds.includes(context.stageId)) {
          return false;
        }
      }

      return true;
    });

    // Execute each matching workflow
    for (const workflow of matchingWorkflows) {
      try {
        const result = await executeWorkflow(workflow.id, context.userId, {
          rowId: context.rowId,
          dealId: context.dealId,
          variables: {
            ...context.variables,
            triggerEvent: event,
            pipelineId: context.pipelineId,
            stageId: context.stageId,
            oldStageId: context.oldStageId,
          },
        });

        results.push({
          workflowId: workflow.id,
          success: result.success,
          error: result.error,
        });
      } catch (error) {
        results.push({
          workflowId: workflow.id,
          success: false,
          error: error instanceof Error ? error.message : "Execution failed",
        });
      }
    }

    return {
      executed: results.length,
      results,
    };
  } catch (error) {
    console.error("Error triggering workflows:", error);
    return { executed: 0, results: [] };
  }
}

/**
 * Trigger workflows when a deal is created
 */
export async function onDealCreated(
  userId: string,
  dealId: string,
  rowId: string,
  pipelineId: string,
  stageId: string
): Promise<void> {
  // Fire and forget - don't block the API response
  triggerWorkflows("DEAL_CREATED", {
    userId,
    dealId,
    rowId,
    pipelineId,
    stageId,
  }).catch((error) => {
    console.error("Error in onDealCreated trigger:", error);
  });
}

/**
 * Trigger workflows when a deal stage changes
 */
export async function onStageChanged(
  userId: string,
  dealId: string,
  rowId: string,
  pipelineId: string,
  oldStageId: string,
  newStageId: string
): Promise<void> {
  // Fire and forget - don't block the API response
  triggerWorkflows("STAGE_CHANGED", {
    userId,
    dealId,
    rowId,
    pipelineId,
    stageId: newStageId,
    oldStageId,
  }).catch((error) => {
    console.error("Error in onStageChanged trigger:", error);
  });
}

/**
 * Trigger workflows when a call is completed
 */
export async function onCallCompleted(
  userId: string,
  rowId: string,
  callOutcome?: string
): Promise<void> {
  triggerWorkflows("CALL_COMPLETED", {
    userId,
    rowId,
    variables: { callOutcome },
  }).catch((error) => {
    console.error("Error in onCallCompleted trigger:", error);
  });
}

/**
 * Trigger workflows when a meeting is scheduled
 */
export async function onMeetingScheduled(
  userId: string,
  rowId: string,
  meetingDate?: Date
): Promise<void> {
  triggerWorkflows("MEETING_SCHEDULED", {
    userId,
    rowId,
    variables: { meetingDate: meetingDate?.toISOString() },
  }).catch((error) => {
    console.error("Error in onMeetingScheduled trigger:", error);
  });
}
