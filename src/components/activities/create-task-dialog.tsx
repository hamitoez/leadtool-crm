"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, Loader2, CalendarIcon, Search, Building2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Row {
  id: string;
  cells: Array<{
    value: unknown;
    column: { name: string; type: string };
  }>;
  table?: {
    name: string;
    project?: { name: string };
  };
}

interface CreateTaskDialogProps {
  onTaskCreated?: () => void;
  children?: React.ReactNode;
}

export function CreateTaskDialog({ onTaskCreated, children }: CreateTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingRows, setLoadingRows] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedRowId, setSelectedRowId] = useState<string>("");
  const [priority, setPriority] = useState<string>("MEDIUM");
  const [dueDate, setDueDate] = useState<Date | undefined>();

  useEffect(() => {
    if (open) {
      fetchRows();
    }
  }, [open]);

  const fetchRows = async () => {
    setLoadingRows(true);
    try {
      const res = await fetch("/api/activities/available-rows");
      if (res.ok) {
        const data = await res.json();
        setRows(data);
      }
    } catch (error) {
      console.error("Error fetching rows:", error);
    } finally {
      setLoadingRows(false);
    }
  };

  const getRowDisplayName = (row: Row) => {
    const companyCell = row.cells.find(
      (c) => c.column.type === "COMPANY" || c.column.name.toLowerCase().includes("firma")
    );
    const nameCell = row.cells.find(
      (c) => c.column.type === "TEXT" || c.column.name.toLowerCase().includes("name")
    );
    return (companyCell?.value as string) || (nameCell?.value as string) || "Unbekannt";
  };

  const filteredRows = rows.filter((row) => {
    const name = getRowDisplayName(row).toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Bitte gib einen Titel ein");
      return;
    }

    if (!selectedRowId) {
      toast.error("Bitte wähle einen Kontakt aus");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rowId: selectedRowId,
          type: "TASK",
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          dueDate: dueDate?.toISOString(),
          status: "PLANNED",
        }),
      });

      if (res.ok) {
        toast.success("Aufgabe erstellt");
        setOpen(false);
        resetForm();
        onTaskCreated?.();
      } else {
        const data = await res.json();
        toast.error(data.error || "Fehler beim Erstellen");
      }
    } catch (error) {
      console.error("Error creating task:", error);
      toast.error("Fehler beim Erstellen der Aufgabe");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setSelectedRowId("");
    setPriority("MEDIUM");
    setDueDate(undefined);
    setSearchQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Neue Aufgabe
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg overflow-hidden">
        <DialogHeader>
          <DialogTitle>Neue Aufgabe erstellen</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-hidden">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Titel *</Label>
            <Input
              id="title"
              placeholder="z.B. Angebot nachfassen"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Contact Selection */}
          <div className="space-y-2 overflow-hidden">
            <Label>Kontakt *</Label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Kontakt suchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="h-[150px] border rounded-md overflow-hidden">
              <ScrollArea className="h-full w-full">
                {loadingRows ? (
                  <div className="flex items-center justify-center h-[150px]">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredRows.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    {rows.length === 0 ? "Keine Kontakte vorhanden" : "Keine Kontakte gefunden"}
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {filteredRows.slice(0, 50).map((row) => (
                      <button
                        key={row.id}
                        onClick={() => setSelectedRowId(row.id)}
                        className={cn(
                          "w-full text-left p-2 rounded-md text-sm transition-colors flex items-center gap-2 overflow-hidden",
                          selectedRowId === row.id
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted"
                        )}
                      >
                        <Building2 className="h-4 w-4 shrink-0" />
                        <span className="truncate flex-1 min-w-0">{getRowDisplayName(row)}</span>
                        {row.table && (
                          <span className="text-xs opacity-70 shrink-0 max-w-[80px] truncate">
                            {row.table.name}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Beschreibung</Label>
            <Textarea
              id="description"
              placeholder="Optionale Details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {/* Priority & Due Date Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priorität</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Niedrig</SelectItem>
                  <SelectItem value="MEDIUM">Mittel</SelectItem>
                  <SelectItem value="HIGH">Hoch</SelectItem>
                  <SelectItem value="URGENT">Dringend</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Fällig am</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dueDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, "dd.MM.yyyy", { locale: de }) : "Datum wählen"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    locale={de}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSubmit} disabled={saving || !title || !selectedRowId}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Aufgabe erstellen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
