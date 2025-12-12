"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const shortcuts = [
  { keys: ["N"], description: "Neue Zeile hinzufügen" },
  { keys: ["Q"], description: "Quick Add öffnen" },
  { keys: ["E"], description: "Export Dialog öffnen" },
  { keys: ["F"], description: "Suche fokussieren" },
  { keys: ["⌘", "K"], description: "Globale Suche" },
  { keys: ["?"], description: "Diese Hilfe anzeigen" },
  { keys: ["Esc"], description: "Auswahl aufheben / Dialog schließen" },
];

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Tastenkürzel
          </DialogTitle>
          <DialogDescription>
            Nutze diese Tastenkürzel für schnelleres Arbeiten
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-4">
          {shortcuts.map((shortcut, index) => (
            <div
              key={index}
              className="flex items-center justify-between py-2 border-b last:border-0"
            >
              <span className="text-sm text-muted-foreground">
                {shortcut.description}
              </span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key, keyIndex) => (
                  <kbd
                    key={keyIndex}
                    className="px-2 py-1 text-xs font-semibold text-foreground bg-muted border rounded-md shadow-sm"
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Tastenkürzel funktionieren nur außerhalb von Eingabefeldern
        </p>
      </DialogContent>
    </Dialog>
  );
}
