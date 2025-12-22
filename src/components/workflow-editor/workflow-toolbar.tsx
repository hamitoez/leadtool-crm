"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Save,
  Loader2,
  ArrowLeft,
  Play,
  Pause,
  Circle,
  Zap,
  CheckCircle2,
  XCircle,
  History,
} from "lucide-react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ExecutionStep {
  nodeId: string;
  nodeType: string;
  subType: string;
  status: "running" | "success" | "error" | "skipped";
  startedAt: string;
  completedAt?: string;
  result?: { message?: string; action?: string };
  error?: string;
}

interface WorkflowToolbarProps {
  workflowId: string;
  workflowName: string;
  isActive: boolean;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  onSave: () => Promise<void>;
  onActivate: (isActive: boolean) => void;
  onExecutionStart?: () => void;
  onExecutionComplete?: (trace: ExecutionStep[]) => void;
}

export function WorkflowToolbar({
  workflowId,
  workflowName,
  isActive,
  isSaving,
  hasUnsavedChanges,
  onSave,
  onActivate,
  onExecutionStart,
  onExecutionComplete,
}: WorkflowToolbarProps) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastExecution, setLastExecution] = useState<{
    success: boolean;
    trace: ExecutionStep[];
  } | null>(null);
  const [showResults, setShowResults] = useState(false);

  const handleExecute = async () => {
    setIsExecuting(true);
    onExecutionStart?.();

    try {
      // Auto-save if there are unsaved changes
      if (hasUnsavedChanges) {
        await onSave();
      }

      const response = await fetch(`/api/workflows/${workflowId}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Ausführungsfehler");
      }

      setLastExecution({
        success: result.success,
        trace: result.trace || [],
      });
      setShowResults(true);
      onExecutionComplete?.(result.trace || []);
    } catch (error) {
      console.error("Execution error:", error);
      setLastExecution({
        success: false,
        trace: [
          {
            nodeId: "error",
            nodeType: "ERROR",
            subType: "ERROR",
            status: "error",
            startedAt: new Date().toISOString(),
            error: error instanceof Error ? error.message : "Unbekannter Fehler",
          },
        ],
      });
      setShowResults(true);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between border-b bg-card px-4 py-3">
        <div className="flex items-center gap-4">
          <Link href="/workflows">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>

          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">{workflowName}</h1>
            {hasUnsavedChanges && (
              <Badge variant="outline" className="text-xs">
                <Circle className="h-2 w-2 mr-1 fill-orange-500 text-orange-500" />
                Nicht gespeichert
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Execution Result Badge */}
          {lastExecution && !isExecuting && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowResults(true)}
              className="gap-2"
            >
              {lastExecution.success ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm">
                {lastExecution.success ? "Erfolgreich" : "Fehler"}
              </span>
              <History className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          )}

          {/* Execute Button */}
          <Button
            variant="outline"
            onClick={handleExecute}
            disabled={isExecuting || isSaving}
            className="gap-2 border-emerald-500/50 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            {isExecuting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {hasUnsavedChanges ? "Speichere & Führe aus..." : "Ausführen..."}
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                {hasUnsavedChanges ? "Speichern & Ausführen" : "Ausführen"}
              </>
            )}
          </Button>

          {/* Active Toggle */}
          <div className="flex items-center gap-2 border-l pl-3">
            <Switch
              id="workflow-active"
              checked={isActive}
              onCheckedChange={onActivate}
            />
            <Label
              htmlFor="workflow-active"
              className="flex items-center gap-1.5 cursor-pointer"
            >
              {isActive ? (
                <>
                  <Play className="h-3.5 w-3.5 text-green-500" />
                  <span className="text-sm text-green-600 dark:text-green-400">
                    Aktiv
                  </span>
                </>
              ) : (
                <>
                  <Pause className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Inaktiv</span>
                </>
              )}
            </Label>
          </div>

          {/* Save Button */}
          <Button onClick={onSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Speichern...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Speichern
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Execution Results Dialog */}
      <Dialog open={showResults} onOpenChange={setShowResults}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {lastExecution?.success ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Workflow erfolgreich ausgeführt
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-500" />
                  Workflow-Ausführung fehlgeschlagen
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              Übersicht der ausgeführten Schritte
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[400px] pr-4">
            <div className="space-y-3">
              {lastExecution?.trace.map((step, index) => (
                <div
                  key={step.nodeId + index}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                >
                  <div className="mt-0.5">
                    {step.status === "success" ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : step.status === "error" ? (
                      <XCircle className="h-5 w-5 text-red-500" />
                    ) : (
                      <Loader2 className="h-5 w-5 animate-spin text-yellow-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {getNodeTypeLabel(step.nodeType)}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {step.subType}
                      </Badge>
                    </div>
                    {step.result?.message && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {step.result.message}
                      </p>
                    )}
                    {step.error && (
                      <p className="text-sm text-red-500 mt-1">{step.error}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}

function getNodeTypeLabel(nodeType: string): string {
  switch (nodeType) {
    case "TRIGGER":
      return "Trigger";
    case "ACTION":
      return "Aktion";
    case "CONDITION":
      return "Bedingung";
    case "DELAY":
      return "Verzögerung";
    default:
      return nodeType;
  }
}
