"use client";

import { useState } from "react";
import { RefreshCw, Settings, TrendingUp, Target, Euro, Plus, Loader2, Users, Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Stage {
  id: string;
  name: string;
  color: string;
  position: number;
  stageType: "OPEN" | "WON" | "LOST";
  autoMoveAfterDays: number | null;
  deals: Array<unknown>;
}

interface Pipeline {
  id: string;
  name: string;
  isDefault: boolean;
  stages: Stage[];
}

interface PipelineHeaderProps {
  pipeline: Pipeline;
  projectId: string;
  stats: {
    totalDeals: number;
    totalValue: number;
    weightedValue: number;
  } | null;
  onRefresh: () => void;
}

export function PipelineHeader({ pipeline, projectId, stats, onRefresh }: PipelineHeaderProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addStageOpen, setAddStageOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    created: number;
    failed: number;
  } | null>(null);

  // Pipeline settings
  const [pipelineName, setPipelineName] = useState(pipeline.name);

  // New stage form
  const [newStageName, setNewStageName] = useState("");
  const [newStageColor, setNewStageColor] = useState("#3b82f6");
  const [newStageType, setNewStageType] = useState<"OPEN" | "WON" | "LOST">("OPEN");

  const colorOptions = [
    { value: "#3b82f6", label: "Blau" },
    { value: "#22c55e", label: "Gruen" },
    { value: "#eab308", label: "Gelb" },
    { value: "#f97316", label: "Orange" },
    { value: "#ef4444", label: "Rot" },
    { value: "#8b5cf6", label: "Violett" },
    { value: "#06b6d4", label: "Cyan" },
    { value: "#ec4899", label: "Pink" },
    { value: "#6b7280", label: "Grau" },
  ];

  // Get first OPEN stage for bulk import
  const firstOpenStage = pipeline.stages
    .filter((s) => s.stageType === "OPEN")
    .sort((a, b) => a.position - b.position)[0];

  const handleBulkImport = async () => {
    if (!firstOpenStage) {
      toast.error("Keine offene Stage gefunden");
      return;
    }

    setImporting(true);
    setImportResult(null);
    try {
      const res = await fetch("/api/deals/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipelineId: pipeline.id,
          stageId: firstOpenStage.id,
          applyScoring: true,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setImportResult({ created: data.created, failed: data.failed });
        if (data.created > 0) {
          toast.success(`${data.created} Leads importiert`);
          onRefresh();
        } else {
          toast.info("Keine neuen Leads ohne Deal gefunden");
        }
      } else {
        toast.error(data.error || "Import fehlgeschlagen");
      }
    } catch (error) {
      console.error("Error bulk importing:", error);
      toast.error("Import fehlgeschlagen");
    } finally {
      setImporting(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  const handleSavePipelineName = async () => {
    if (!pipelineName.trim()) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/pipelines/${pipeline.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: pipelineName }),
      });

      if (res.ok) {
        toast.success("Pipeline-Name aktualisiert");
        onRefresh();
      } else {
        toast.error("Fehler beim Speichern");
      }
    } catch (error) {
      console.error("Error updating pipeline:", error);
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  const handleAddStage = async () => {
    if (!newStageName.trim()) {
      toast.error("Bitte gib einen Namen ein");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/pipelines/${pipeline.id}/stages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newStageName,
          color: newStageColor,
          stageType: newStageType,
        }),
      });

      if (res.ok) {
        toast.success("Stage hinzugefuegt");
        setAddStageOpen(false);
        setNewStageName("");
        setNewStageColor("#3b82f6");
        setNewStageType("OPEN");
        onRefresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "Fehler beim Erstellen");
      }
    } catch (error) {
      console.error("Error adding stage:", error);
      toast.error("Fehler beim Erstellen");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between p-4">
          <div>
            <h1 className="text-2xl font-semibold">{pipeline.name}</h1>
            <p className="text-sm text-muted-foreground">
              {pipeline.stages.length} Stages
            </p>
          </div>

          <div className="flex items-center gap-2">
            {firstOpenStage && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    onClick={handleBulkImport}
                    disabled={importing}
                    className="gap-2"
                  >
                    {importing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">Alle importieren</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Alle Leads ohne Deal automatisch importieren</p>
                  <p className="text-xs text-muted-foreground">mit Lead-Scoring</p>
                </TooltipContent>
              </Tooltip>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                setPipelineName(pipeline.name);
                setSettingsOpen(true);
              }}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="flex gap-4 px-4 pb-4 overflow-x-auto">
            <Card className="flex items-center gap-3 p-3 min-w-[160px]">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Target className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Deals</p>
                <p className="text-lg font-semibold">{stats.totalDeals}</p>
              </div>
            </Card>

            <Card className="flex items-center gap-3 p-3 min-w-[180px]">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <Euro className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pipeline-Wert</p>
                <p className="text-lg font-semibold">
                  EUR {stats.totalValue.toLocaleString("de-DE")}
                </p>
              </div>
            </Card>

            <Card className="flex items-center gap-3 p-3 min-w-[200px]">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Gewichteter Wert</p>
                <p className="text-lg font-semibold">
                  EUR {stats.weightedValue.toLocaleString("de-DE")}
                </p>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pipeline-Einstellungen</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Pipeline Name */}
            <div className="space-y-2">
              <Label>Pipeline-Name</Label>
              <div className="flex gap-2">
                <Input
                  value={pipelineName}
                  onChange={(e) => setPipelineName(e.target.value)}
                  placeholder="Pipeline Name"
                />
                <Button
                  onClick={handleSavePipelineName}
                  disabled={saving || pipelineName === pipeline.name}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Speichern"}
                </Button>
              </div>
            </div>

            {/* Stages Overview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Stages ({pipeline.stages.length})</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddStageOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Neue Stage
                </Button>
              </div>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {pipeline.stages
                  .sort((a, b) => a.position - b.position)
                  .map((stage) => (
                    <div
                      key={stage.id}
                      className="flex items-center gap-3 p-2 rounded-md border bg-muted/50"
                    >
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: stage.color }}
                      />
                      <span className="flex-1 truncate text-sm">{stage.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {stage.stageType === "WON" ? "Gewonnen" :
                         stage.stageType === "LOST" ? "Verloren" : "Offen"}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {stage.deals.length} Deals
                      </span>
                    </div>
                  ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Tipp: Einzelne Stages kannst du direkt im Board ueber das Menue (⋯) bearbeiten oder loeschen.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>
              Schliessen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Stage Dialog */}
      <Dialog open={addStageOpen} onOpenChange={setAddStageOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Neue Stage hinzufuegen</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                placeholder="z.B. Qualifizierung, Angebot, Verhandlung..."
              />
            </div>

            <div className="space-y-2">
              <Label>Farbe</Label>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setNewStageColor(color.value)}
                    className={cn(
                      "w-8 h-8 rounded-full border-2 transition-all",
                      newStageColor === color.value
                        ? "border-foreground scale-110"
                        : "border-transparent"
                    )}
                    style={{ backgroundColor: color.value }}
                    title={color.label}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Typ</Label>
              <Select value={newStageType} onValueChange={(v) => setNewStageType(v as "OPEN" | "WON" | "LOST")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPEN">Offen (normaler Fortschritt)</SelectItem>
                  <SelectItem value="WON">Gewonnen (Deal abgeschlossen)</SelectItem>
                  <SelectItem value="LOST">Verloren (Deal verloren)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                &quot;Gewonnen&quot; und &quot;Verloren&quot; sind End-Stages fuer abgeschlossene Deals.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddStageOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleAddStage} disabled={saving || !newStageName.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Stage erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
