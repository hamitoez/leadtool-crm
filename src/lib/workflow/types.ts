// TypeScript Types for Visual Workflow Editor

import type { Node, Edge } from "@xyflow/react";

// ============================================
// Node Types
// ============================================

export type WorkflowNodeType = "TRIGGER" | "ACTION" | "CONDITION" | "DELAY";

// Base type for ReactFlow compatibility
export type WorkflowNode = Node<Record<string, unknown>>;
export type WorkflowEdge = Edge;

// Trigger subtypes
export type TriggerSubType =
  | "DEAL_CREATED"
  | "STAGE_CHANGED"
  | "NO_ACTIVITY"
  | "EMAIL_OPENED"
  | "EMAIL_NOT_OPENED"
  | "EMAIL_CLICKED"
  | "TASK_OVERDUE"
  | "MEETING_SCHEDULED"
  | "MEETING_COMPLETED"
  | "CALL_COMPLETED"
  | "MANUAL";

// Action subtypes
export type ActionSubType =
  | "SEND_EMAIL"
  | "CREATE_TASK"
  | "CREATE_REMINDER"
  | "MOVE_STAGE"
  | "ADD_NOTE"
  | "NOTIFY_USER";

// Condition subtypes
export type ConditionSubType = "IF_ELSE" | "SWITCH";

// Delay subtypes
export type DelaySubType = "WAIT" | "WAIT_UNTIL";

export type NodeSubType = TriggerSubType | ActionSubType | ConditionSubType | DelaySubType;

// ============================================
// Node Data
// ============================================

export interface BaseNodeData {
  label: string;
  nodeType: WorkflowNodeType;
  subType: NodeSubType;
  config: Record<string, unknown>;
}

export interface TriggerNodeData extends BaseNodeData {
  nodeType: "TRIGGER";
  subType: TriggerSubType;
  config: {
    pipelineId?: string;
    stageIds?: string[];
    daysOfInactivity?: number;
  };
}

export interface ActionNodeData extends BaseNodeData {
  nodeType: "ACTION";
  subType: ActionSubType;
  config: {
    templateId?: string;
    subject?: string;
    body?: string;
    taskTitle?: string;
    taskDescription?: string;
    taskPriority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    reminderTitle?: string;
    reminderMinutes?: number;
    stageId?: string;
    noteContent?: string;
    notificationTitle?: string;
    notificationMessage?: string;
  };
}

export interface ConditionNodeData extends BaseNodeData {
  nodeType: "CONDITION";
  subType: ConditionSubType;
  config: {
    field?: string;
    operator?: "equals" | "not_equals" | "contains" | "greater_than" | "less_than" | "is_empty" | "is_not_empty";
    value?: string | number | boolean;
    branches?: Array<{ label: string; condition: string }>;
  };
}

export interface DelayNodeData extends BaseNodeData {
  nodeType: "DELAY";
  subType: DelaySubType;
  config: {
    delayMinutes?: number;
    delayHours?: number;
    delayDays?: number;
    waitUntilTime?: string;
    waitUntilDate?: string;
  };
}

export type WorkflowNodeData = TriggerNodeData | ActionNodeData | ConditionNodeData | DelayNodeData;

// ============================================
// API Types
// ============================================

export interface WorkflowDTO {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  viewport: { x: number; y: number; zoom: number };
  executionCount: number;
  lastExecutedAt: string | null;
  pipelineId: string | null;
  nodes: WorkflowNodeDTO[];
  edges: WorkflowEdgeDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowNodeDTO {
  id: string;
  workflowId: string;
  nodeType: WorkflowNodeType;
  subType: string;
  label: string | null;
  positionX: number;
  positionY: number;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowEdgeDTO {
  id: string;
  workflowId: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle: string | null;
  targetHandle: string | null;
  label: string | null;
  createdAt: string;
}

export interface CreateWorkflowInput {
  name: string;
  description?: string;
  pipelineId?: string;
}

export interface UpdateWorkflowInput {
  name?: string;
  description?: string;
  isActive?: boolean;
  viewport?: { x: number; y: number; zoom: number };
  pipelineId?: string;
  nodes?: Array<{
    id?: string;
    nodeType: WorkflowNodeType;
    subType: string;
    label?: string;
    positionX: number;
    positionY: number;
    config?: Record<string, unknown>;
  }>;
  edges?: Array<{
    id?: string;
    sourceNodeId: string;
    targetNodeId: string;
    sourceHandle?: string;
    targetHandle?: string;
    label?: string;
  }>;
}

// ============================================
// Node Definitions for UI
// ============================================

export interface NodeDefinition {
  type: NodeSubType;
  nodeType: WorkflowNodeType;
  label: string;
  description: string;
  icon: string; // Lucide icon name
  color: string; // Tailwind color
  defaultConfig: Record<string, unknown>;
}

export const TRIGGER_DEFINITIONS: NodeDefinition[] = [
  {
    type: "DEAL_CREATED",
    nodeType: "TRIGGER",
    label: "Neuer Deal",
    description: "Wenn ein neuer Deal erstellt wird",
    icon: "Plus",
    color: "green",
    defaultConfig: {},
  },
  {
    type: "STAGE_CHANGED",
    nodeType: "TRIGGER",
    label: "Stage gewechselt",
    description: "Wenn ein Deal in eine andere Stage verschoben wird",
    icon: "ArrowRight",
    color: "green",
    defaultConfig: {},
  },
  {
    type: "NO_ACTIVITY",
    nodeType: "TRIGGER",
    label: "Keine Aktivitaet",
    description: "Wenn ein Kontakt X Tage keine Aktivitaet hatte",
    icon: "Clock",
    color: "green",
    defaultConfig: { daysOfInactivity: 3 },
  },
  {
    type: "EMAIL_OPENED",
    nodeType: "TRIGGER",
    label: "E-Mail geoeffnet",
    description: "Wenn eine E-Mail geoeffnet wird",
    icon: "MailOpen",
    color: "green",
    defaultConfig: {},
  },
  {
    type: "EMAIL_NOT_OPENED",
    nodeType: "TRIGGER",
    label: "E-Mail nicht geoeffnet",
    description: "Wenn eine E-Mail nach X Tagen nicht geoeffnet wurde",
    icon: "MailX",
    color: "green",
    defaultConfig: { daysOfInactivity: 2 },
  },
  {
    type: "EMAIL_CLICKED",
    nodeType: "TRIGGER",
    label: "Link geklickt",
    description: "Wenn ein Link in einer E-Mail geklickt wird",
    icon: "MousePointerClick",
    color: "green",
    defaultConfig: {},
  },
  {
    type: "TASK_OVERDUE",
    nodeType: "TRIGGER",
    label: "Aufgabe ueberfaellig",
    description: "Wenn eine Aufgabe ihr Faelligkeitsdatum ueberschreitet",
    icon: "AlertTriangle",
    color: "green",
    defaultConfig: {},
  },
  {
    type: "MEETING_SCHEDULED",
    nodeType: "TRIGGER",
    label: "Meeting geplant",
    description: "Wenn ein Meeting geplant wird",
    icon: "Calendar",
    color: "green",
    defaultConfig: {},
  },
  {
    type: "MEETING_COMPLETED",
    nodeType: "TRIGGER",
    label: "Meeting abgeschlossen",
    description: "Wenn ein Meeting als erledigt markiert wird",
    icon: "CalendarCheck",
    color: "green",
    defaultConfig: {},
  },
  {
    type: "CALL_COMPLETED",
    nodeType: "TRIGGER",
    label: "Anruf abgeschlossen",
    description: "Wenn ein Anruf protokolliert wird",
    icon: "PhoneCall",
    color: "green",
    defaultConfig: {},
  },
  {
    type: "MANUAL",
    nodeType: "TRIGGER",
    label: "Manuell",
    description: "Workflow manuell starten",
    icon: "Play",
    color: "green",
    defaultConfig: {},
  },
];

export const ACTION_DEFINITIONS: NodeDefinition[] = [
  {
    type: "SEND_EMAIL",
    nodeType: "ACTION",
    label: "E-Mail senden",
    description: "Automatisch eine E-Mail senden",
    icon: "Mail",
    color: "blue",
    defaultConfig: {},
  },
  {
    type: "CREATE_TASK",
    nodeType: "ACTION",
    label: "Aufgabe erstellen",
    description: "Eine neue Aufgabe erstellen",
    icon: "CheckSquare",
    color: "blue",
    defaultConfig: { taskPriority: "MEDIUM" },
  },
  {
    type: "CREATE_REMINDER",
    nodeType: "ACTION",
    label: "Erinnerung erstellen",
    description: "Eine Erinnerung erstellen",
    icon: "Bell",
    color: "blue",
    defaultConfig: { reminderMinutes: 60 },
  },
  {
    type: "MOVE_STAGE",
    nodeType: "ACTION",
    label: "Stage aendern",
    description: "Deal in eine andere Stage verschieben",
    icon: "MoveRight",
    color: "blue",
    defaultConfig: {},
  },
  {
    type: "ADD_NOTE",
    nodeType: "ACTION",
    label: "Notiz hinzufuegen",
    description: "Eine Notiz zum Kontakt hinzufuegen",
    icon: "StickyNote",
    color: "blue",
    defaultConfig: {},
  },
  {
    type: "NOTIFY_USER",
    nodeType: "ACTION",
    label: "Benachrichtigung",
    description: "Eine Benachrichtigung senden",
    icon: "BellRing",
    color: "blue",
    defaultConfig: {},
  },
];

export const CONDITION_DEFINITIONS: NodeDefinition[] = [
  {
    type: "IF_ELSE",
    nodeType: "CONDITION",
    label: "Wenn/Dann",
    description: "Verzweigung basierend auf einer Bedingung",
    icon: "GitBranch",
    color: "orange",
    defaultConfig: { operator: "equals" },
  },
];

export const DELAY_DEFINITIONS: NodeDefinition[] = [
  {
    type: "WAIT",
    nodeType: "DELAY",
    label: "Warten",
    description: "Eine bestimmte Zeit warten",
    icon: "Timer",
    color: "gray",
    defaultConfig: { delayMinutes: 60 },
  },
  {
    type: "WAIT_UNTIL",
    nodeType: "DELAY",
    label: "Warten bis",
    description: "Bis zu einem bestimmten Zeitpunkt warten",
    icon: "Clock",
    color: "gray",
    defaultConfig: {},
  },
];

export const ALL_NODE_DEFINITIONS = [
  ...TRIGGER_DEFINITIONS,
  ...ACTION_DEFINITIONS,
  ...CONDITION_DEFINITIONS,
  ...DELAY_DEFINITIONS,
];

export function getNodeDefinition(subType: string): NodeDefinition | undefined {
  return ALL_NODE_DEFINITIONS.find((def) => def.type === subType);
}

// ============================================
// Conversion Functions
// ============================================

export function convertToReactFlowNodes(nodes: WorkflowNodeDTO[]): WorkflowNode[] {
  return nodes.map((node) => ({
    id: node.id,
    type: node.nodeType.toLowerCase(),
    position: { x: node.positionX, y: node.positionY },
    data: {
      label: node.label || getNodeDefinition(node.subType)?.label || node.subType,
      nodeType: node.nodeType,
      subType: node.subType,
      config: node.config,
    } as unknown as Record<string, unknown>,
  }));
}

export function convertToReactFlowEdges(edges: WorkflowEdgeDTO[]): WorkflowEdge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    sourceHandle: edge.sourceHandle || undefined,
    targetHandle: edge.targetHandle || undefined,
    label: edge.label || undefined,
    type: "smoothstep",
    animated: true,
  }));
}

export function convertFromReactFlowNodes(
  nodes: WorkflowNode[]
): Array<Omit<WorkflowNodeDTO, "workflowId" | "createdAt" | "updatedAt">> {
  return nodes.map((node) => {
    const data = node.data as unknown as WorkflowNodeData;
    return {
      id: node.id,
      nodeType: data.nodeType,
      subType: data.subType,
      label: data.label,
      positionX: node.position.x,
      positionY: node.position.y,
      config: data.config,
    };
  });
}

export function convertFromReactFlowEdges(
  edges: WorkflowEdge[]
): Array<Omit<WorkflowEdgeDTO, "workflowId" | "createdAt">> {
  return edges.map((edge) => ({
    id: edge.id,
    sourceNodeId: edge.source,
    targetNodeId: edge.target,
    sourceHandle: edge.sourceHandle || null,
    targetHandle: edge.targetHandle || null,
    label: typeof edge.label === "string" ? edge.label : null,
  }));
}
