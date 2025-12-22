"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import {
  Calendar,
  Euro,
  Phone,
  Mail,
  Clock,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { format } from "date-fns";
import { de } from "date-fns/locale";

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

interface DealCardProps {
  deal: Deal;
  pipelineId?: string;
  isDragging?: boolean;
  onClick?: () => void;
  onDeleted?: () => void;
  onUpdated?: () => void;
}

export function DealCard({
  deal,
  pipelineId,
  isDragging,
  onClick,
  onDeleted,
  onUpdated,
}: DealCardProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editValue, setEditValue] = useState<string>(deal.value?.toString() || "");
  const [editProbability, setEditProbability] = useState(deal.probability);
  const [editExpectedClose, setEditExpectedClose] = useState<Date | undefined>(
    deal.expectedClose ? new Date(deal.expectedClose) : undefined
  );

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: deal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Extract display data from cells
  const getDisplayName = () => {
    const companyCell = deal.row.cells.find(
      (c) => c.column.type === "COMPANY" || c.column.name.toLowerCase().includes("firma")
    );
    const nameCell = deal.row.cells.find(
      (c) => c.column.type === "PERSON" || c.column.name.toLowerCase() === "name"
    );
    const textCell = deal.row.cells.find((c) => c.column.type === "TEXT");

    const getValue = (cell: Cell | undefined) => {
      if (!cell) return null;
      const val = cell.value;
      if (typeof val === "string") return val;
      if (val && typeof val === "object" && "name" in val) return (val as { name: string }).name;
      return null;
    };

    return getValue(companyCell) || getValue(nameCell) || getValue(textCell) || "Unbekannt";
  };

  const getContactInfo = () => {
    const emailCell = deal.row.cells.find((c) => c.column.type === "EMAIL");
    const phoneCell = deal.row.cells.find((c) => c.column.type === "PHONE");

    return {
      email: typeof emailCell?.value === "string" ? emailCell.value : null,
      phone: typeof phoneCell?.value === "string" ? phoneCell.value : null,
    };
  };

  const displayName = getDisplayName();
  const contactInfo = getContactInfo();
  const nextActivity = deal.row.activities?.[0];

  // Calculate days in stage
  const daysInStage = Math.floor(
    (Date.now() - new Date(deal.stageChangedAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  // Calculate lead score from row data
  const calculateScore = () => {
    const cells = deal.row.cells || [];

    const hasEmail = cells.some(
      (c) => c.column.type === "EMAIL" && c.value && String(c.value).includes("@")
    );
    const hasPhone = cells.some(
      (c) => c.column.type === "PHONE" && c.value && String(c.value).length > 5
    );
    const hasWebsite = cells.some(
      (c) => c.column.type === "URL" && c.value && String(c.value).startsWith("http")
    );
    const hasCompanyName = cells.some(
      (c) =>
        (c.column.name.toLowerCase().includes("firma") ||
          c.column.name.toLowerCase().includes("company")) &&
        c.value &&
        String(c.value).length > 2
    );

    const filledFields = cells.filter(
      (c) => c.value !== null && c.value !== "" && c.value !== undefined
    ).length;
    const totalFields = cells.length;

    // Data Completeness (40%)
    const completenessRatio = totalFields > 0 ? filledFields / totalFields : 0;
    const dataCompleteness = Math.round(completenessRatio * 100);

    // Contactability (35%)
    let contactabilityScore = 0;
    if (hasEmail) contactabilityScore += 50;
    if (hasPhone) contactabilityScore += 35;
    if (hasWebsite) contactabilityScore += 15;
    const contactability = Math.min(contactabilityScore, 100);

    // Business Signals (25%)
    let businessScore = 0;
    if (hasCompanyName) businessScore += 40;
    if (hasWebsite) businessScore += 30;
    const businessSignals = Math.min(businessScore, 100);

    return Math.round(
      dataCompleteness * 0.4 + contactability * 0.35 + businessSignals * 0.25
    );
  };

  const leadScore = calculateScore();

  const getScoreColor = (score: number) => {
    if (score >= 70) return "bg-green-500";
    if (score >= 50) return "bg-yellow-500";
    if (score >= 30) return "bg-orange-500";
    return "bg-red-500";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 70) return "Heiss";
    if (score >= 50) return "Warm";
    if (score >= 30) return "Kalt";
    return "Niedrig";
  };

  // Probability color
  const getProbabilityColor = (prob: number) => {
    if (prob >= 70) return "bg-green-500";
    if (prob >= 40) return "bg-yellow-500";
    return "bg-red-500";
  };

  const handleEditDeal = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/deals/${deal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          value: editValue ? parseFloat(editValue) : null,
          probability: editProbability,
          expectedClose: editExpectedClose?.toISOString() || null,
        }),
      });

      if (res.ok) {
        toast.success("Deal aktualisiert");
        setEditDialogOpen(false);
        onUpdated?.();
      } else {
        const data = await res.json();
        toast.error(data.error || "Fehler beim Aktualisieren");
      }
    } catch (error) {
      console.error("Error updating deal:", error);
      toast.error("Fehler beim Aktualisieren");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDeal = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/deals/${deal.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Deal entfernt");
        setDeleteDialogOpen(false);
        onDeleted?.();
      } else {
        const data = await res.json();
        toast.error(data.error || "Fehler beim Entfernen");
      }
    } catch (error) {
      console.error("Error deleting deal:", error);
      toast.error("Fehler beim Entfernen");
    } finally {
      setSaving(false);
    }
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <>
      <Card
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={onClick}
        className={cn(
          "p-3 cursor-grab active:cursor-grabbing",
          "hover:shadow-md transition-shadow",
          (isDragging || isSortableDragging) && "opacity-50 shadow-lg rotate-2"
        )}
      >
        {/* Header with name and menu */}
        <div className="flex items-start justify-between mb-2">
          <div className="font-medium truncate flex-1">{displayName}</div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={handleMenuClick}>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 -mr-1 -mt-1 shrink-0"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={handleMenuClick}>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setEditValue(deal.value?.toString() || "");
                  setEditProbability(deal.probability);
                  setEditExpectedClose(
                    deal.expectedClose ? new Date(deal.expectedClose) : undefined
                  );
                  setEditDialogOpen(true);
                }}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Deal bearbeiten
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteDialogOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Aus Pipeline entfernen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Value and Probability */}
        <div className="flex items-center justify-between mb-2">
          {deal.value ? (
            <div className="flex items-center text-sm text-muted-foreground">
              <Euro className="h-3.5 w-3.5 mr-1" />
              {deal.value.toLocaleString("de-DE")}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Kein Wert</span>
          )}
          <div className="flex items-center gap-1">
            <div
              className={cn("h-1.5 w-12 rounded-full bg-muted overflow-hidden")}
            >
              <div
                className={cn("h-full", getProbabilityColor(deal.probability))}
                style={{ width: `${deal.probability}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">{deal.probability}%</span>
          </div>
        </div>

        {/* Contact Icons & Score */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            {contactInfo.email && (
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            {contactInfo.phone && (
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            {daysInStage > 0 && (
              <span className="text-xs text-muted-foreground flex items-center">
                <Clock className="h-3 w-3 mr-1" />
                {daysInStage}d
              </span>
            )}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1">
                <div
                  className={cn(
                    "w-2 h-2 rounded-full",
                    getScoreColor(leadScore)
                  )}
                />
                <span className="text-xs font-medium">{leadScore}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Lead Score: {leadScore}%</p>
              <p className="text-xs text-muted-foreground">{getScoreLabel(leadScore)}</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Expected Close Date */}
        {deal.expectedClose && (
          <div className="flex items-center text-xs text-muted-foreground mb-2">
            <Calendar className="h-3 w-3 mr-1" />
            {new Date(deal.expectedClose).toLocaleDateString("de-DE")}
          </div>
        )}

        {/* Next Activity */}
        {nextActivity && (
          <Badge variant="outline" className="text-xs w-full justify-start truncate">
            {nextActivity.title}
          </Badge>
        )}
      </Card>

      {/* Edit Deal Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Deal bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Deal-Wert (EUR)</Label>
              <Input
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Wahrscheinlichkeit: {editProbability}%</Label>
              <Slider
                value={[editProbability]}
                onValueChange={(v) => setEditProbability(v[0])}
                min={0}
                max={100}
                step={5}
              />
            </div>
            <div className="space-y-2">
              <Label>Erwarteter Abschluss</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !editExpectedClose && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {editExpectedClose
                      ? format(editExpectedClose, "dd.MM.yyyy", { locale: de })
                      : "Datum waehlen"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={editExpectedClose}
                    onSelect={setEditExpectedClose}
                    locale={de}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {editExpectedClose && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditExpectedClose(undefined)}
                  className="text-xs"
                >
                  Datum entfernen
                </Button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleEditDeal} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Deal Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Deal aus Pipeline entfernen?</AlertDialogTitle>
            <AlertDialogDescription>
              Der Lead &quot;{displayName}&quot; wird aus der Pipeline entfernt.
              Die Kontaktdaten bleiben erhalten und du kannst den Lead spaeter wieder hinzufuegen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDeal}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Entfernen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
