"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Plus,
  ArrowRight,
  Clock,
  MailOpen,
  MailX,
  MousePointerClick,
  AlertTriangle,
  Calendar,
  CalendarCheck,
  PhoneCall,
  Play,
  Zap,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TriggerNodeData, TriggerSubType } from "@/lib/workflow/types";

const triggerIcons: Record<TriggerSubType, React.ElementType> = {
  DEAL_CREATED: Plus,
  STAGE_CHANGED: ArrowRight,
  NO_ACTIVITY: Clock,
  EMAIL_OPENED: MailOpen,
  EMAIL_NOT_OPENED: MailX,
  EMAIL_CLICKED: MousePointerClick,
  TASK_OVERDUE: AlertTriangle,
  MEETING_SCHEDULED: Calendar,
  MEETING_COMPLETED: CalendarCheck,
  CALL_COMPLETED: PhoneCall,
  MANUAL: Play,
};

const triggerLabels: Record<TriggerSubType, string> = {
  DEAL_CREATED: "Neuer Deal",
  STAGE_CHANGED: "Stage-Wechsel",
  NO_ACTIVITY: "Inaktivität",
  EMAIL_OPENED: "E-Mail geöffnet",
  EMAIL_NOT_OPENED: "E-Mail ungeöffnet",
  EMAIL_CLICKED: "Link geklickt",
  TASK_OVERDUE: "Aufgabe überfällig",
  MEETING_SCHEDULED: "Meeting geplant",
  MEETING_COMPLETED: "Meeting erledigt",
  CALL_COMPLETED: "Anruf erledigt",
  MANUAL: "Manueller Start",
};

const triggerDescriptions: Record<TriggerSubType, string> = {
  DEAL_CREATED: "Startet wenn ein neuer Deal erstellt wird",
  STAGE_CHANGED: "Startet wenn ein Deal die Stage wechselt",
  NO_ACTIVITY: "Startet nach X Tagen ohne Aktivität",
  EMAIL_OPENED: "Startet wenn eine E-Mail geöffnet wird",
  EMAIL_NOT_OPENED: "Startet wenn E-Mail nicht geöffnet wurde",
  EMAIL_CLICKED: "Startet wenn ein Link geklickt wird",
  TASK_OVERDUE: "Startet wenn Aufgabe überfällig ist",
  MEETING_SCHEDULED: "Startet wenn Meeting geplant wird",
  MEETING_COMPLETED: "Startet wenn Meeting abgeschlossen ist",
  CALL_COMPLETED: "Startet wenn Anruf protokolliert wird",
  MANUAL: "Startet per Klick auf 'Ausführen'",
};

function TriggerNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as TriggerNodeData & {
    executionStatus?: "idle" | "running" | "success" | "error";
  };
  const Icon = triggerIcons[nodeData.subType as TriggerSubType] || Zap;
  const label = triggerLabels[nodeData.subType as TriggerSubType] || nodeData.subType;
  const description = triggerDescriptions[nodeData.subType as TriggerSubType] || "";
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

  return (
    <div
      className={cn(
        "w-[280px] rounded-xl border-2 bg-card shadow-lg transition-all duration-200",
        selected
          ? "border-emerald-500 shadow-emerald-500/20 shadow-xl ring-2 ring-emerald-500/20"
          : "border-emerald-500/40 hover:border-emerald-500/70",
        status === "running" && "animate-pulse",
        status === "success" && "border-green-500",
        status === "error" && "border-red-500"
      )}
    >
      {/* Header with gradient */}
      <div className="flex items-center justify-between rounded-t-[10px] bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="text-xs font-medium text-emerald-100 uppercase tracking-wide">
              Trigger
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
        {nodeData.config?.daysOfInactivity && (
          <div className="flex items-center gap-2 text-sm bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-lg px-3 py-2">
            <Clock className="h-4 w-4" />
            <span>Nach {nodeData.config.daysOfInactivity} Tagen</span>
          </div>
        )}

        {nodeData.subType === "MANUAL" && (
          <div className="flex items-center gap-2 text-sm bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-lg px-3 py-2">
            <Play className="h-4 w-4" />
            <span>Klicke "Ausführen" in der Toolbar</span>
          </div>
        )}
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-4 !h-4 !bg-emerald-500 !border-[3px] !border-white !shadow-md !-right-2"
      />
    </div>
  );
}

export const TriggerNode = memo(TriggerNodeComponent);
