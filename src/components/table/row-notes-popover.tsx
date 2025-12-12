"use client";

import { useState, useEffect } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";

interface RowNotesPopoverProps {
  rowId: string;
  notes: string | null;
  onNotesChange: (rowId: string, notes: string | null) => Promise<void>;
}

export function RowNotesPopover({
  rowId,
  notes,
  onNotesChange,
}: RowNotesPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localNotes, setLocalNotes] = useState(notes || "");
  const [isSaving, setIsSaving] = useState(false);

  // Sync local state when notes prop changes
  useEffect(() => {
    setLocalNotes(notes || "");
  }, [notes]);

  // Debounced save
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(async () => {
      const newNotes = localNotes.trim() || null;
      if (newNotes !== notes) {
        setIsSaving(true);
        try {
          await onNotesChange(rowId, newNotes);
        } finally {
          setIsSaving(false);
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [localNotes, isOpen, notes, rowId, onNotesChange]);

  const hasNotes = notes && notes.trim().length > 0;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 w-7 p-0 hover:bg-amber-100 dark:hover:bg-amber-900/30",
            hasNotes && "text-amber-600 dark:text-amber-400"
          )}
          title={hasNotes ? notes : "Notiz hinzufügen"}
        >
          <StickyNote
            className={cn(
              "h-4 w-4",
              hasNotes ? "fill-amber-200 dark:fill-amber-800" : ""
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Notiz</span>
            {isSaving && (
              <span className="text-xs text-muted-foreground">Speichern...</span>
            )}
          </div>
          <Textarea
            placeholder="Notiz hinzufügen..."
            value={localNotes}
            onChange={(e) => setLocalNotes(e.target.value)}
            className="min-h-[100px] resize-none text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Wird automatisch gespeichert
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
