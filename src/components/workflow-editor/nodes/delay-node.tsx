"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Timer, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DelayNodeData, DelaySubType } from "@/lib/workflow/types";

const delayIcons: Record<DelaySubType, React.ElementType> = {
  WAIT: Timer,
  WAIT_UNTIL: Clock,
};

const delayLabels: Record<DelaySubType, string> = {
  WAIT: "Warten",
  WAIT_UNTIL: "Warten bis",
};

const delayDescriptions: Record<DelaySubType, string> = {
  WAIT: "Wartet eine bestimmte Zeitspanne",
  WAIT_UNTIL: "Wartet bis zu einem bestimmten Zeitpunkt",
};

function DelayNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as DelayNodeData & {
    executionStatus?: "idle" | "running" | "success" | "error";
  };
  const Icon = delayIcons[nodeData.subType as DelaySubType] || Timer;
  const label = delayLabels[nodeData.subType as DelaySubType] || nodeData.subType;
  const description = delayDescriptions[nodeData.subType as DelaySubType] || "";
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

  // Get delay preview
  const getDelayPreview = () => {
    const config = nodeData.config;
    if (!config) return null;

    if (nodeData.subType === "WAIT") {
      const parts: string[] = [];
      if (config.delayDays) parts.push(`${config.delayDays} Tage`);
      if (config.delayHours) parts.push(`${config.delayHours} Std`);
      if (config.delayMinutes) parts.push(`${config.delayMinutes} Min`);

      if (parts.length > 0) {
        return (
          <div className="flex items-center gap-2 text-sm bg-slate-500/10 text-slate-700 dark:text-slate-300 rounded-lg px-3 py-2">
            <Timer className="h-4 w-4 flex-shrink-0" />
            <span>{parts.join(", ")}</span>
          </div>
        );
      }
    }

    if (nodeData.subType === "WAIT_UNTIL") {
      if (config.waitUntilDate && config.waitUntilTime) {
        return (
          <div className="flex items-center gap-2 text-sm bg-slate-500/10 text-slate-700 dark:text-slate-300 rounded-lg px-3 py-2">
            <Clock className="h-4 w-4 flex-shrink-0" />
            <span>{config.waitUntilDate} um {config.waitUntilTime}</span>
          </div>
        );
      }
      if (config.waitUntilTime) {
        return (
          <div className="flex items-center gap-2 text-sm bg-slate-500/10 text-slate-700 dark:text-slate-300 rounded-lg px-3 py-2">
            <Clock className="h-4 w-4 flex-shrink-0" />
            <span>Täglich um {config.waitUntilTime}</span>
          </div>
        );
      }
    }

    return null;
  };

  const delayPreview = getDelayPreview();

  return (
    <div
      className={cn(
        "w-[280px] rounded-xl border-2 bg-card shadow-lg transition-all duration-200",
        selected
          ? "border-slate-500 shadow-slate-500/20 shadow-xl ring-2 ring-slate-500/20"
          : "border-slate-500/40 hover:border-slate-500/70",
        status === "running" && "animate-pulse",
        status === "success" && "border-green-500",
        status === "error" && "border-red-500"
      )}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-4 !h-4 !bg-slate-500 !border-[3px] !border-white !shadow-md !-left-2"
      />

      {/* Header with gradient */}
      <div className="flex items-center justify-between rounded-t-[10px] bg-gradient-to-r from-slate-500 to-slate-600 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-200 uppercase tracking-wide">
              Verzögerung
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

        {/* Delay Preview */}
        {delayPreview}

        {!delayPreview && (
          <div className="text-xs text-muted-foreground/60 italic">
            Klicke zum Konfigurieren
          </div>
        )}
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-4 !h-4 !bg-slate-500 !border-[3px] !border-white !shadow-md !-right-2"
      />
    </div>
  );
}

export const DelayNode = memo(DelayNodeComponent);
