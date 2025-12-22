"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Mail,
  CheckSquare,
  Bell,
  MoveRight,
  StickyNote,
  BellRing,
  Zap,
  CheckCircle2,
  XCircle,
  Loader2,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActionNodeData, ActionSubType } from "@/lib/workflow/types";

const actionIcons: Record<ActionSubType, React.ElementType> = {
  SEND_EMAIL: Send,
  CREATE_TASK: CheckSquare,
  CREATE_REMINDER: Bell,
  MOVE_STAGE: MoveRight,
  ADD_NOTE: StickyNote,
  NOTIFY_USER: BellRing,
};

const actionLabels: Record<ActionSubType, string> = {
  SEND_EMAIL: "E-Mail senden",
  CREATE_TASK: "Aufgabe erstellen",
  CREATE_REMINDER: "Erinnerung setzen",
  MOVE_STAGE: "Stage ändern",
  ADD_NOTE: "Notiz hinzufügen",
  NOTIFY_USER: "Benachrichtigen",
};

const actionDescriptions: Record<ActionSubType, string> = {
  SEND_EMAIL: "Sendet eine E-Mail an den Kontakt",
  CREATE_TASK: "Erstellt eine neue Aufgabe",
  CREATE_REMINDER: "Setzt eine Erinnerung für später",
  MOVE_STAGE: "Verschiebt den Deal in eine andere Stage",
  ADD_NOTE: "Fügt eine Notiz zum Kontakt hinzu",
  NOTIFY_USER: "Sendet eine Benachrichtigung",
};

function ActionNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as ActionNodeData & {
    executionStatus?: "idle" | "running" | "success" | "error";
    executionMessage?: string;
  };
  const Icon = actionIcons[nodeData.subType as ActionSubType] || Zap;
  const label = actionLabels[nodeData.subType as ActionSubType] || nodeData.subType;
  const description = actionDescriptions[nodeData.subType as ActionSubType] || "";
  const status = nodeData.executionStatus || "idle";

  const getStatusIcon = () => {
    switch (status) {
      case "running":
        return <Loader2 className="h-3.5 w-3.5 animate-spin text-yellow-500" />;
      case "success":
        return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
      case "error":
        return <XCircle className="h-3.5 w-3.5 text-red-500" />;
      default:
        return null;
    }
  };

  // Get config preview based on action type
  const getConfigPreview = () => {
    const config = nodeData.config;
    if (!config) return null;

    switch (nodeData.subType) {
      case "SEND_EMAIL":
        if (config.subject) {
          return (
            <div className="flex items-center gap-2 text-sm bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-lg px-3 py-2">
              <Mail className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Betreff: {config.subject}</span>
            </div>
          );
        }
        break;
      case "CREATE_TASK":
        if (config.taskTitle) {
          return (
            <div className="flex items-center gap-2 text-sm bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-lg px-3 py-2">
              <CheckSquare className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{config.taskTitle}</span>
            </div>
          );
        }
        break;
      case "CREATE_REMINDER":
        if (config.reminderTitle || config.reminderMinutes) {
          return (
            <div className="flex items-center gap-2 text-sm bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-lg px-3 py-2">
              <Bell className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">
                {config.reminderTitle || `In ${config.reminderMinutes} Minuten`}
              </span>
            </div>
          );
        }
        break;
      case "ADD_NOTE":
        if (config.noteContent) {
          return (
            <div className="flex items-center gap-2 text-sm bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-lg px-3 py-2">
              <StickyNote className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{String(config.noteContent).substring(0, 30)}...</span>
            </div>
          );
        }
        break;
      case "NOTIFY_USER":
        if (config.notificationTitle) {
          return (
            <div className="flex items-center gap-2 text-sm bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-lg px-3 py-2">
              <BellRing className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{config.notificationTitle}</span>
            </div>
          );
        }
        break;
    }
    return null;
  };

  const configPreview = getConfigPreview();

  return (
    <div
      className={cn(
        "w-[280px] rounded-xl border-2 bg-card shadow-lg transition-all duration-200",
        selected
          ? "border-blue-500 shadow-blue-500/20 shadow-xl ring-2 ring-blue-500/20"
          : "border-blue-500/40 hover:border-blue-500/70",
        status === "running" && "animate-pulse",
        status === "success" && "border-green-500",
        status === "error" && "border-red-500"
      )}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-4 !h-4 !bg-blue-500 !border-[3px] !border-white !shadow-md !-left-2"
      />

      {/* Header with gradient */}
      <div className="flex items-center justify-between rounded-t-[10px] bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="text-xs font-medium text-blue-100 uppercase tracking-wide">
              Aktion
            </span>
            <p className="text-sm font-semibold text-white">{label}</p>
          </div>
        </div>
        {getStatusIcon()}
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>

        {/* Config Preview */}
        {configPreview}

        {/* Execution Message */}
        {status === "success" && nodeData.executionMessage && (
          <div className="flex items-center gap-2 text-sm bg-green-500/10 text-green-700 dark:text-green-400 rounded-lg px-3 py-2">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{nodeData.executionMessage}</span>
          </div>
        )}

        {status === "error" && nodeData.executionMessage && (
          <div className="flex items-center gap-2 text-sm bg-red-500/10 text-red-700 dark:text-red-400 rounded-lg px-3 py-2">
            <XCircle className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{nodeData.executionMessage}</span>
          </div>
        )}

        {!configPreview && status === "idle" && (
          <div className="text-xs text-muted-foreground/60 italic">
            Klicke zum Konfigurieren
          </div>
        )}
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-4 !h-4 !bg-blue-500 !border-[3px] !border-white !shadow-md !-right-2"
      />
    </div>
  );
}

export const ActionNode = memo(ActionNodeComponent);
