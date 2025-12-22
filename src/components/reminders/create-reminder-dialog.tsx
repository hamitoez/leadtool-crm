"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { Loader2, Calendar as CalendarIcon, Clock } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface CreateReminderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rowId?: string;
  activityId?: string;
  defaultTitle?: string;
  onSuccess?: () => void;
}

const reminderTypes = [
  { value: "CUSTOM", label: "Benutzerdefiniert" },
  { value: "FOLLOW_UP", label: "Follow-up" },
  { value: "DEADLINE", label: "Deadline" },
  { value: "BEFORE_ACTIVITY", label: "Vor Aktivitaet" },
];

const quickTimes = [
  { label: "In 15 Min", minutes: 15 },
  { label: "In 1 Std", minutes: 60 },
  { label: "In 3 Std", minutes: 180 },
  { label: "Morgen 9:00", preset: "tomorrow9" },
  { label: "Naechste Woche", preset: "nextWeek" },
];

export function CreateReminderDialog({
  open,
  onOpenChange,
  rowId,
  activityId,
  defaultTitle = "",
  onSuccess,
}: CreateReminderDialogProps) {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState(defaultTitle);
  const [message, setMessage] = useState("");
  const [type, setType] = useState("CUSTOM");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState("09:00");

  const handleQuickTime = (quick: typeof quickTimes[0]) => {
    const now = new Date();

    if (quick.minutes) {
      const newDate = new Date(now.getTime() + quick.minutes * 60000);
      setDate(newDate);
      setTime(format(newDate, "HH:mm"));
    } else if (quick.preset === "tomorrow9") {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      setDate(tomorrow);
      setTime("09:00");
    } else if (quick.preset === "nextWeek") {
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);
      nextWeek.setHours(9, 0, 0, 0);
      setDate(nextWeek);
      setTime("09:00");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("Bitte gib einen Titel ein");
      return;
    }

    if (!date) {
      toast.error("Bitte waehle ein Datum");
      return;
    }

    // Combine date and time
    const [hours, minutes] = time.split(":").map(Number);
    const remindAt = new Date(date);
    remindAt.setHours(hours, minutes, 0, 0);

    if (remindAt <= new Date()) {
      toast.error("Der Zeitpunkt muss in der Zukunft liegen");
      return;
    }

    setLoading(true);

    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        type,
        remindAt: remindAt.toISOString(),
      };

      if (message.trim()) payload.message = message.trim();
      if (rowId) payload.rowId = rowId;
      if (activityId) payload.activityId = activityId;

      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Fehler beim Erstellen");
      }

      toast.success("Erinnerung erstellt");

      // Reset form
      setTitle("");
      setMessage("");
      setType("CUSTOM");
      setDate(undefined);
      setTime("09:00");

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error creating reminder:", error);
      toast.error(error instanceof Error ? error.message : "Fehler beim Erstellen");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Erinnerung erstellen</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Titel *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Woran moechtest du erinnert werden?"
              required
            />
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label>Typ</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {reminderTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quick Times */}
          <div className="space-y-2">
            <Label>Schnellauswahl</Label>
            <div className="flex flex-wrap gap-2">
              {quickTimes.map((quick) => (
                <Button
                  key={quick.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickTime(quick)}
                  className="text-xs"
                >
                  {quick.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Datum *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "dd.MM.yyyy", { locale: de }) : "Datum"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    locale={de}
                    disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Uhrzeit *</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Notiz (optional)</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Zusaetzliche Details..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Erstellen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
