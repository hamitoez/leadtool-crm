"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { toast } from "sonner";
import { Loader2, Timer, Play, Pause, RotateCcw } from "lucide-react";
import { CallScriptSelector } from "@/components/call-scripts/call-script-selector";
import { NoteTemplateSelector } from "@/components/notes/note-template-selector";

interface CreateActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rowId: string;
  defaultType?: string;
  onSuccess?: () => void;
}

const activityTypes = [
  { value: "CALL", label: "Anruf" },
  { value: "EMAIL", label: "E-Mail" },
  { value: "MEETING", label: "Meeting" },
  { value: "NOTE", label: "Notiz" },
  { value: "TASK", label: "Aufgabe" },
  { value: "DOCUMENT", label: "Dokument" },
];

const priorities = [
  { value: "LOW", label: "Niedrig" },
  { value: "MEDIUM", label: "Mittel" },
  { value: "HIGH", label: "Hoch" },
  { value: "URGENT", label: "Dringend" },
];

export function CreateActivityDialog({
  open,
  onOpenChange,
  rowId,
  defaultType = "NOTE",
  onSuccess,
}: CreateActivityDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    type: defaultType,
    title: "",
    description: "",
    status: "COMPLETED",
    priority: "",
    dueDate: "",
    callDuration: "",
    callOutcome: "",
    meetingLocation: "",
    meetingLink: "",
  });

  // Call timer state - using useRef for interval to avoid stale closure issues
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timer on unmount or when dialog closes
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, []);

  // Reset timer when dialog closes
  useEffect(() => {
    if (!open) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      setTimerRunning(false);
      setTimerSeconds(0);
    }
  }, [open]);

  const startTimer = useCallback(() => {
    if (timerIntervalRef.current) return;
    setTimerRunning(true);
    timerIntervalRef.current = setInterval(() => {
      setTimerSeconds((prev) => prev + 1);
    }, 1000);
  }, []);

  const pauseTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setTimerRunning(false);
    setFormData((prev) => ({ ...prev, callDuration: timerSeconds.toString() }));
  }, [timerSeconds]);

  const resetTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setTimerRunning(false);
    setTimerSeconds(0);
    setFormData((prev) => ({ ...prev, callDuration: "" }));
  }, []);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload: Record<string, unknown> = {
        rowId,
        type: formData.type,
        title: formData.title,
        description: formData.description || undefined,
        status: formData.type === "TASK" ? "PLANNED" : formData.status,
      };

      if (formData.priority) payload.priority = formData.priority;
      if (formData.dueDate) payload.dueDate = new Date(formData.dueDate).toISOString();
      if (formData.callDuration) payload.callDuration = parseInt(formData.callDuration);
      if (formData.callOutcome) payload.callOutcome = formData.callOutcome;
      if (formData.meetingLocation) payload.meetingLocation = formData.meetingLocation;
      if (formData.meetingLink) payload.meetingLink = formData.meetingLink;

      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to create activity");

      toast.success("Aktivität erstellt");
      setFormData({
        type: defaultType,
        title: "",
        description: "",
        status: "COMPLETED",
        priority: "",
        dueDate: "",
        callDuration: "",
        callOutcome: "",
        meetingLocation: "",
        meetingLink: "",
      });
      onSuccess?.();
    } catch (error) {
      console.error("Error creating activity:", error);
      toast.error("Fehler beim Erstellen der Aktivität");
    } finally {
      setLoading(false);
    }
  };

  const isTask = formData.type === "TASK";
  const isCall = formData.type === "CALL";
  const isMeeting = formData.type === "MEETING";
  const isNote = formData.type === "NOTE";

  const handleNoteTemplateApply = (content: string) => {
    setFormData((prev) => ({
      ...prev,
      description: content,
      title: prev.title || "Notiz",
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Aktivität erstellen</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Typ</Label>
            <Select
              value={formData.type}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, type: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {activityTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Titel *</Label>
            <Input
              value={formData.title}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder={
                isTask
                  ? "Was muss erledigt werden?"
                  : isCall
                  ? "Anruf-Zusammenfassung"
                  : isMeeting
                  ? "Meeting-Titel"
                  : "Titel"
              }
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Beschreibung</Label>
            <Textarea
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Details..."
              rows={3}
            />
          </div>

          {/* Task-specific fields */}
          {isTask && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Priorität</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, priority: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {priorities.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Fällig am</Label>
                  <Input
                    type="datetime-local"
                    value={formData.dueDate}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, dueDate: e.target.value }))
                    }
                  />
                </div>
              </div>
            </>
          )}

          {/* Call-specific fields */}
          {isCall && (
            <div className="space-y-4">
              {/* Call Script Selector */}
              <CallScriptSelector showPreview={true} />

              {/* Timer */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Timer className="h-4 w-4" />
                  Anruf-Timer
                </Label>
                <div className="flex items-center gap-2">
                  <div className="text-2xl font-mono bg-muted px-4 py-2 rounded-md min-w-[100px] text-center">
                    {formatTime(timerSeconds)}
                  </div>
                  {!timerRunning ? (
                    <Button type="button" variant="outline" size="icon" onClick={startTimer}>
                      <Play className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button type="button" variant="outline" size="icon" onClick={pauseTimer}>
                      <Pause className="h-4 w-4" />
                    </Button>
                  )}
                  <Button type="button" variant="ghost" size="icon" onClick={resetTimer}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Dauer (Sekunden)</Label>
                  <Input
                    type="number"
                    value={formData.callDuration || timerSeconds.toString()}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, callDuration: e.target.value }))
                    }
                    placeholder="180"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ergebnis</Label>
                  <Select
                    value={formData.callOutcome}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, callOutcome: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Ergebnis waehlen..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="erreicht">Erreicht</SelectItem>
                      <SelectItem value="nicht_erreicht">Nicht erreicht</SelectItem>
                      <SelectItem value="mailbox">Mailbox</SelectItem>
                      <SelectItem value="rueckruf">Rueckruf vereinbart</SelectItem>
                      <SelectItem value="termin">Termin vereinbart</SelectItem>
                      <SelectItem value="kein_interesse">Kein Interesse</SelectItem>
                      <SelectItem value="falsche_nummer">Falsche Nummer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Meeting-specific fields */}
          {isMeeting && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ort</Label>
                <Input
                  value={formData.meetingLocation}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      meetingLocation: e.target.value,
                    }))
                  }
                  placeholder="Büro, Zoom, etc."
                />
              </div>
              <div className="space-y-2">
                <Label>Meeting-Link</Label>
                <Input
                  value={formData.meetingLink}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, meetingLink: e.target.value }))
                  }
                  placeholder="https://..."
                />
              </div>
            </div>
          )}

          {/* Note-specific fields */}
          {isNote && (
            <div className="space-y-2">
              <NoteTemplateSelector onApply={handleNoteTemplateApply} />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
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
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
