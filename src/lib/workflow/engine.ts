// Workflow Execution Engine
// Executes workflows step by step, following the node connections

import prisma from "@/lib/prisma";
import type { WorkflowNodeType, TaskPriority, ActivityStatus } from "@prisma/client";

interface ExecutionContext {
  workflowId: string;
  executionId: string;
  userId: string;
  rowId?: string;
  dealId?: string;
  variables: Record<string, unknown>;
  trace: ExecutionStep[];
}

interface ExecutionStep {
  nodeId: string;
  nodeType: WorkflowNodeType;
  subType: string;
  status: "running" | "success" | "error" | "skipped";
  startedAt: string;
  completedAt?: string;
  result?: unknown;
  error?: string;
}

interface WorkflowNode {
  id: string;
  nodeType: WorkflowNodeType;
  subType: string;
  config: Record<string, unknown>;
}

interface WorkflowEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle: string | null;
}

export class WorkflowEngine {
  private nodes: Map<string, WorkflowNode> = new Map();
  private edges: WorkflowEdge[] = [];
  private context: ExecutionContext;

  constructor(
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    context: Omit<ExecutionContext, "trace">
  ) {
    nodes.forEach((node) => this.nodes.set(node.id, node));
    this.edges = edges;
    this.context = { ...context, trace: [] };
  }

  // Find the trigger node (starting point)
  private findTriggerNode(): WorkflowNode | undefined {
    for (const node of this.nodes.values()) {
      if (node.nodeType === "TRIGGER") {
        return node;
      }
    }
    return undefined;
  }

  // Find the next nodes after a given node
  private findNextNodes(nodeId: string, handleId?: string): WorkflowNode[] {
    const nextNodes: WorkflowNode[] = [];

    for (const edge of this.edges) {
      if (edge.sourceNodeId === nodeId) {
        // If handleId is specified, only follow that handle
        if (handleId && edge.sourceHandle !== handleId) {
          continue;
        }
        const targetNode = this.nodes.get(edge.targetNodeId);
        if (targetNode) {
          nextNodes.push(targetNode);
        }
      }
    }

    return nextNodes;
  }

  // Execute a single node
  private async executeNode(node: WorkflowNode): Promise<{
    success: boolean;
    result?: unknown;
    error?: string;
    nextHandle?: string;
  }> {
    const step: ExecutionStep = {
      nodeId: node.id,
      nodeType: node.nodeType,
      subType: node.subType,
      status: "running",
      startedAt: new Date().toISOString(),
    };
    this.context.trace.push(step);

    try {
      let result: unknown;
      let nextHandle: string | undefined;

      switch (node.nodeType) {
        case "TRIGGER":
          result = await this.executeTrigger(node);
          break;
        case "ACTION":
          result = await this.executeAction(node);
          break;
        case "CONDITION":
          const conditionResult = await this.executeCondition(node);
          result = conditionResult;
          nextHandle = conditionResult ? "true" : "false";
          break;
        case "DELAY":
          result = await this.executeDelay(node);
          break;
        default:
          throw new Error(`Unknown node type: ${node.nodeType}`);
      }

      step.status = "success";
      step.completedAt = new Date().toISOString();
      step.result = result;

      return { success: true, result, nextHandle };
    } catch (error) {
      step.status = "error";
      step.completedAt = new Date().toISOString();
      step.error = error instanceof Error ? error.message : String(error);

      return { success: false, error: step.error };
    }
  }

  // Execute trigger node
  private async executeTrigger(node: WorkflowNode): Promise<unknown> {
    // Trigger nodes just pass through - they're the starting point
    return { triggered: true, subType: node.subType };
  }

  // Execute action node
  private async executeAction(node: WorkflowNode): Promise<unknown> {
    const config = node.config;

    switch (node.subType) {
      case "SEND_EMAIL":
        // For now, just log the email action
        return {
          action: "SEND_EMAIL",
          subject: config.subject,
          body: config.body,
          message: `E-Mail würde gesendet: ${config.subject}`,
        };

      case "CREATE_TASK":
        // Create a task in the database
        if (this.context.rowId) {
          const task = await prisma.activity.create({
            data: {
              userId: this.context.userId,
              rowId: this.context.rowId,
              type: "TASK",
              title: String(config.taskTitle || "Automatische Aufgabe"),
              description: config.taskDescription
                ? String(config.taskDescription)
                : undefined,
              priority: ((config.taskPriority as string) || "MEDIUM") as TaskPriority,
              status: "PLANNED" as ActivityStatus,
              dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
            },
          });
          return {
            action: "CREATE_TASK",
            taskId: task.id,
            message: `Aufgabe erstellt: ${config.taskTitle}`,
          };
        }
        return {
          action: "CREATE_TASK",
          message: `Aufgabe würde erstellt: ${config.taskTitle}`,
        };

      case "CREATE_REMINDER":
        // Create a reminder in the database
        const reminderMinutes = (config.reminderMinutes as number) || 60;
        const reminder = await prisma.reminder.create({
          data: {
            userId: this.context.userId,
            type: "CUSTOM",
            title: String(config.reminderTitle || "Workflow-Erinnerung"),
            message: "Automatisch erstellt durch Workflow",
            remindAt: new Date(Date.now() + reminderMinutes * 60 * 1000),
            rowId: this.context.rowId,
          },
        });
        return {
          action: "CREATE_REMINDER",
          reminderId: reminder.id,
          message: `Erinnerung erstellt: ${config.reminderTitle || "In " + reminderMinutes + " Minuten"}`,
        };

      case "ADD_NOTE":
        // Add a note to the row
        if (this.context.rowId) {
          await prisma.activity.create({
            data: {
              userId: this.context.userId,
              rowId: this.context.rowId,
              type: "NOTE",
              title: "Workflow-Notiz",
              description: String(config.noteContent || ""),
              status: "COMPLETED" as ActivityStatus,
            },
          });
          return {
            action: "ADD_NOTE",
            message: `Notiz hinzugefügt`,
          };
        }
        return {
          action: "ADD_NOTE",
          message: `Notiz würde hinzugefügt: ${String(config.noteContent || "").substring(0, 30)}...`,
        };

      case "NOTIFY_USER":
        // Create a notification
        await prisma.notification.create({
          data: {
            userId: this.context.userId,
            type: "SYSTEM",
            title: String(config.notificationTitle || "Workflow-Benachrichtigung"),
            message: String(config.notificationMessage || ""),
            read: false,
          },
        });
        return {
          action: "NOTIFY_USER",
          message: `Benachrichtigung gesendet: ${config.notificationTitle}`,
        };

      case "MOVE_STAGE":
        // Move deal to a new stage
        if (this.context.dealId && config.stageId) {
          await prisma.deal.update({
            where: { id: this.context.dealId },
            data: { stageId: String(config.stageId) },
          });
          return {
            action: "MOVE_STAGE",
            message: `Deal in neue Stage verschoben`,
          };
        }
        return {
          action: "MOVE_STAGE",
          message: `Deal würde in Stage ${config.stageId} verschoben`,
        };

      default:
        return { action: node.subType, message: "Unbekannte Aktion" };
    }
  }

  // Execute condition node
  private async executeCondition(node: WorkflowNode): Promise<boolean> {
    const config = node.config;
    const field = config.field as string;
    const operator = config.operator as string;
    const value = config.value;

    // Get the field value from context
    const fieldValue = this.context.variables[field];

    switch (operator) {
      case "equals":
        return fieldValue === value;
      case "not_equals":
        return fieldValue !== value;
      case "contains":
        return String(fieldValue || "").includes(String(value || ""));
      case "greater_than":
        return Number(fieldValue) > Number(value);
      case "less_than":
        return Number(fieldValue) < Number(value);
      case "is_empty":
        return !fieldValue || fieldValue === "";
      case "is_not_empty":
        return !!fieldValue && fieldValue !== "";
      default:
        return true;
    }
  }

  // Execute delay node (for manual execution, we skip delays)
  private async executeDelay(node: WorkflowNode): Promise<unknown> {
    const config = node.config;
    const delayMs =
      ((config.delayDays as number) || 0) * 24 * 60 * 60 * 1000 +
      ((config.delayHours as number) || 0) * 60 * 60 * 1000 +
      ((config.delayMinutes as number) || 0) * 60 * 1000;

    // For manual execution, we just simulate the delay (max 2 seconds)
    const simulatedDelay = Math.min(delayMs, 2000);
    if (simulatedDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, simulatedDelay));
    }

    return {
      action: "DELAY",
      configuredDelay: delayMs,
      message: `Verzögerung: ${formatDelay(delayMs)}`,
    };
  }

  // Execute the entire workflow
  async execute(): Promise<{
    success: boolean;
    executionId: string;
    trace: ExecutionStep[];
    error?: string;
  }> {
    const triggerNode = this.findTriggerNode();
    if (!triggerNode) {
      return {
        success: false,
        executionId: this.context.executionId,
        trace: [],
        error: "Kein Trigger-Node gefunden",
      };
    }

    // Start execution from trigger
    let currentNodes: WorkflowNode[] = [triggerNode];
    let success = true;

    while (currentNodes.length > 0) {
      const nextBatch: WorkflowNode[] = [];

      for (const node of currentNodes) {
        const result = await this.executeNode(node);

        if (!result.success) {
          success = false;
          // Continue to next nodes even on error for visibility
        }

        // Find next nodes
        const nextNodes = this.findNextNodes(node.id, result.nextHandle);
        nextBatch.push(...nextNodes);
      }

      currentNodes = nextBatch;
    }

    // Save execution to database
    await prisma.workflowExecution.update({
      where: { id: this.context.executionId },
      data: {
        status: success ? "completed" : "failed",
        trace: JSON.parse(JSON.stringify(this.context.trace)),
        completedAt: new Date(),
      },
    });

    // Update workflow execution count
    await prisma.workflow.update({
      where: { id: this.context.workflowId },
      data: {
        executionCount: { increment: 1 },
        lastExecutedAt: new Date(),
      },
    });

    return {
      success,
      executionId: this.context.executionId,
      trace: this.context.trace,
    };
  }
}

function formatDelay(ms: number): string {
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} Tage`);
  if (hours > 0) parts.push(`${hours} Stunden`);
  if (minutes > 0) parts.push(`${minutes} Minuten`);

  return parts.length > 0 ? parts.join(", ") : "Keine Verzögerung";
}

// Helper function to execute a workflow by ID
export async function executeWorkflow(
  workflowId: string,
  userId: string,
  options?: {
    rowId?: string;
    dealId?: string;
    variables?: Record<string, unknown>;
  }
): Promise<{
  success: boolean;
  executionId: string;
  trace: ExecutionStep[];
  error?: string;
}> {
  // Load workflow with nodes and edges
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId, userId },
    include: {
      nodes: true,
      edges: true,
    },
  });

  if (!workflow) {
    throw new Error("Workflow nicht gefunden");
  }

  // Create execution record
  const execution = await prisma.workflowExecution.create({
    data: {
      workflowId,
      rowId: options?.rowId,
      dealId: options?.dealId,
      status: "running",
      trace: [],
    },
  });

  // Create engine and execute
  const engine = new WorkflowEngine(
    workflow.nodes.map((n) => ({
      id: n.id,
      nodeType: n.nodeType,
      subType: n.subType,
      config: n.config as Record<string, unknown>,
    })),
    workflow.edges.map((e) => ({
      id: e.id,
      sourceNodeId: e.sourceNodeId,
      targetNodeId: e.targetNodeId,
      sourceHandle: e.sourceHandle,
    })),
    {
      workflowId,
      executionId: execution.id,
      userId,
      rowId: options?.rowId,
      dealId: options?.dealId,
      variables: options?.variables || {},
    }
  );

  return engine.execute();
}
