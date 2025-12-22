"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { GitBranch, Split, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConditionNodeData, ConditionSubType } from "@/lib/workflow/types";

const conditionIcons: Record<ConditionSubType, React.ElementType> = {
  IF_ELSE: GitBranch,
  SWITCH: Split,
};

const conditionLabels: Record<ConditionSubType, string> = {
  IF_ELSE: "Wenn / Dann",
  SWITCH: "Mehrfach-Verzweigung",
};

const conditionDescriptions: Record<ConditionSubType, string> = {
  IF_ELSE: "Verzweigt den Workflow basierend auf einer Bedingung",
  SWITCH: "Verzweigt in mehrere Pfade",
};

const operatorLabels: Record<string, string> = {
  equals: "ist gleich",
  not_equals: "ist nicht gleich",
  contains: "enthält",
  greater_than: "ist größer als",
  less_than: "ist kleiner als",
  is_empty: "ist leer",
  is_not_empty: "ist nicht leer",
};

function ConditionNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as ConditionNodeData & {
    executionStatus?: "idle" | "running" | "success" | "error";
    executionResult?: "true" | "false";
  };
  const Icon = conditionIcons[nodeData.subType as ConditionSubType] || GitBranch;
  const label = conditionLabels[nodeData.subType as ConditionSubType] || nodeData.subType;
  const description = conditionDescriptions[nodeData.subType as ConditionSubType] || "";
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

  // Get condition preview
  const getConditionPreview = () => {
    const config = nodeData.config;
    if (!config || !config.field) return null;

    const op = operatorLabels[config.operator || "equals"] || config.operator;
    const value = config.value !== undefined ? ` "${config.value}"` : "";

    return (
      <div className="text-sm bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-lg px-3 py-2">
        <span className="font-medium">{config.field}</span> {op}{value}
      </div>
    );
  };

  const conditionPreview = getConditionPreview();

  return (
    <div
      className={cn(
        "w-[280px] rounded-xl border-2 bg-card shadow-lg transition-all duration-200",
        selected
          ? "border-amber-500 shadow-amber-500/20 shadow-xl ring-2 ring-amber-500/20"
          : "border-amber-500/40 hover:border-amber-500/70",
        status === "running" && "animate-pulse",
        status === "success" && "border-green-500",
        status === "error" && "border-red-500"
      )}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-4 !h-4 !bg-amber-500 !border-[3px] !border-white !shadow-md !-left-2"
      />

      {/* Header with gradient */}
      <div className="flex items-center justify-between rounded-t-[10px] bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="text-xs font-medium text-amber-100 uppercase tracking-wide">
              Bedingung
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

        {/* Condition Preview */}
        {conditionPreview}

        {!conditionPreview && (
          <div className="text-xs text-muted-foreground/60 italic">
            Klicke zum Konfigurieren
          </div>
        )}

        {/* Branch Labels */}
        <div className="flex justify-end gap-4 mt-2 pr-2">
          <div className={cn(
            "flex items-center gap-1.5 text-xs font-medium",
            status === "success" && nodeData.executionResult === "true"
              ? "text-green-600"
              : "text-muted-foreground"
          )}>
            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            Ja
          </div>
          <div className={cn(
            "flex items-center gap-1.5 text-xs font-medium",
            status === "success" && nodeData.executionResult === "false"
              ? "text-red-600"
              : "text-muted-foreground"
          )}>
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
            Nein
          </div>
        </div>
      </div>

      {/* Output Handles - True and False */}
      <Handle
        type="source"
        position={Position.Right}
        id="true"
        className="!w-4 !h-4 !bg-green-500 !border-[3px] !border-white !shadow-md !-right-2 !top-[40%]"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="false"
        className="!w-4 !h-4 !bg-red-500 !border-[3px] !border-white !shadow-md !-right-2 !top-[60%]"
      />
    </div>
  );
}

export const ConditionNode = memo(ConditionNodeComponent);
