"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { DealCard } from "./deal-card";
import { AddDealDialog } from "./add-deal-dialog";
import { cn } from "@/lib/utils";
import { MoreHorizontal, Plus, Pencil, Trash2, Loader2, Timer } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Cell {
  id: string;
  value: unknown;
  column: {
    id: string;
    name: string;
    type: string;
  };
}

interface Row {
  id: string;
  cells: Cell[];
  activities?: Array<{
    id: string;
    title: string;
    dueDate: string | null;
  }>;
}

interface Deal {
  id: string;
  rowId: string;
  stageId: string;
  value: number | null;
  probability: number;
  expectedClose: string | null;
  position: number;
  row: Row;
  stageChangedAt: string;
}

interface Stage {
  id: string;
  name: string;
  color: string;
  position: number;
  stageType: "OPEN" | "WON" | "LOST";
  autoMoveAfterDays: number | null;
  deals: Deal[];
  _count: { deals: number };
}

interface PipelineStageProps {
  stage: Stage;
  projectId: string;
  pipelineId: string;
  onDealClick: (dealId: string) => void;
  onDealAdded: () => void;
  onStageUpdated: () => void;
  onDealDeleted?: () => void;
}

export function PipelineStage({
  stage,
  projectId,
  pipelineId,
  onDealClick,
  onDealAdded,
  onStageUpdated,
  onDealDeleted,
}: PipelineStageProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState(stage.name);
  const [editColor, setEditColor] = useState(stage.color);
  const [editType, setEditType] = useState(stage.stageType);
  const [editAutoMove, setEditAutoMove] = useState<string>(
    stage.autoMoveAfterDays?.toString() || ""
  );

  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  });

  const totalValue = stage.deals.reduce((sum, deal) => sum + (deal.value || 0), 0);

  const stageTypeColors = {
    OPEN: "bg-background",
    WON: "bg-green-50 dark:bg-green-950/20",
    LOST: "bg-red-50 dark:bg-red-950/20",
  };

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

  const handleEditStage = async () => {
    setSaving(true);
    try {
      const autoMoveDays = editAutoMove.trim() ? parseInt(editAutoMove) : null;
      const res = await fetch(`/api/pipelines/${pipelineId}/stages/${stage.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          color: editColor,
          stageType: editType,
          autoMoveAfterDays: autoMoveDays && autoMoveDays > 0 ? autoMoveDays : null,
        }),
      });

      if (res.ok) {
        toast.success("Stage aktualisiert");
        setEditDialogOpen(false);
        onStageUpdated();
      } else {
        const data = await res.json();
        toast.error(data.error || "Fehler beim Aktualisieren");
      }
    } catch (error) {
      console.error("Error updating stage:", error);
      toast.error("Fehler beim Aktualisieren");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStage = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/pipelines/${pipelineId}/stages/${stage.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Stage geloescht");
        setDeleteDialogOpen(false);
        onStageUpdated();
      } else {
        const data = await res.json();
        toast.error(data.error || "Fehler beim Loeschen");
      }
    } catch (error) {
      console.error("Error deleting stage:", error);
      toast.error("Fehler beim Loeschen");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-col w-72 min-w-72 rounded-lg border",
          stageTypeColors[stage.stageType],
          isOver && "ring-2 ring-primary"
        )}
      >
        {/* Stage Header */}
        <div className="p-3 border-b">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: stage.color }}
              />
              <span className="font-medium">{stage.name}</span>
              <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {stage.deals.length}
              </span>
              {stage.autoMoveAfterDays && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Timer className="h-3 w-3" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Auto-Move nach {stage.autoMoveAfterDays} Tagen</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => {
                  setEditName(stage.name);
                  setEditColor(stage.color);
                  setEditType(stage.stageType);
                  setEditAutoMove(stage.autoMoveAfterDays?.toString() || "");
                  setEditDialogOpen(true);
                }}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Stage bearbeiten
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Stage loeschen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {totalValue > 0 && (
            <div className="text-sm text-muted-foreground">
              EUR {totalValue.toLocaleString("de-DE")}
            </div>
          )}
        </div>

      {/* Deals List */}
      <div className="flex-1 p-2 overflow-y-auto max-h-[calc(100vh-280px)]">
        <SortableContext
          items={stage.deals.map((d) => d.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {stage.deals
              .sort((a, b) => a.position - b.position)
              .map((deal) => (
                <DealCard
                  key={deal.id}
                  deal={deal}
                  pipelineId={pipelineId}
                  onClick={() => onDealClick(deal.id)}
                  onDeleted={onDealDeleted || onStageUpdated}
                  onUpdated={onStageUpdated}
                />
              ))}
          </div>
        </SortableContext>

        {stage.deals.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Keine Deals
          </div>
        )}
      </div>

      {/* Add Deal Button */}
      <div className="p-2 border-t">
        <AddDealDialog
          stageId={stage.id}
          stageName={stage.name}
          projectId={projectId}
          onDealAdded={onDealAdded}
        >
          <Button variant="ghost" className="w-full justify-start text-muted-foreground">
            <Plus className="h-4 w-4 mr-2" />
            Deal hinzufuegen
          </Button>
        </AddDealDialog>
      </div>
    </div>

      {/* Edit Stage Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stage bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Stage Name"
              />
            </div>
            <div className="space-y-2">
              <Label>Farbe</Label>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setEditColor(color.value)}
                    className={cn(
                      "w-8 h-8 rounded-full border-2 transition-all",
                      editColor === color.value
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
              <Select value={editType} onValueChange={(v) => setEditType(v as "OPEN" | "WON" | "LOST")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPEN">Offen</SelectItem>
                  <SelectItem value="WON">Gewonnen</SelectItem>
                  <SelectItem value="LOST">Verloren</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editType === "OPEN" && (
              <div className="space-y-2">
                <Label>Auto-Move nach Tagen</Label>
                <Input
                  type="number"
                  min="1"
                  max="365"
                  value={editAutoMove}
                  onChange={(e) => setEditAutoMove(e.target.value)}
                  placeholder="z.B. 7"
                />
                <p className="text-xs text-muted-foreground">
                  Deals werden automatisch in die naechste Stage verschoben, wenn sie diese Anzahl Tage inaktiv sind. Leer lassen fuer kein Auto-Move.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleEditStage} disabled={saving || !editName.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Stage Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stage loeschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {stage.deals.length > 0 ? (
                <>
                  Diese Stage enthaelt noch {stage.deals.length} Deal(s).
                  Bitte verschiebe zuerst alle Deals in eine andere Stage.
                </>
              ) : (
                <>
                  Bist du sicher, dass du die Stage &quot;{stage.name}&quot; loeschen moechtest?
                  Diese Aktion kann nicht rueckgaengig gemacht werden.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStage}
              disabled={saving || stage.deals.length > 0}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Loeschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
