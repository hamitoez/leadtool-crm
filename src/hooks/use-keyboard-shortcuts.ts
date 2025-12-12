"use client";

import { useEffect, useCallback } from "react";

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
}

export function useKeyboardShortcuts(
  shortcuts: ShortcutConfig[],
  enabled: boolean = true
) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // Allow escape to work in inputs
      if (isInput && event.key !== "Escape") return;

      for (const shortcut of shortcuts) {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrl ? event.ctrlKey : !event.ctrlKey;
        const metaMatch = shortcut.meta ? event.metaKey : !event.metaKey;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;

        // Special case: Cmd/Ctrl should match either
        const cmdCtrlMatch =
          shortcut.ctrl || shortcut.meta
            ? event.ctrlKey || event.metaKey
            : !event.ctrlKey && !event.metaKey;

        if (
          keyMatch &&
          (shortcut.ctrl || shortcut.meta ? cmdCtrlMatch : ctrlMatch && metaMatch) &&
          shiftMatch &&
          altMatch
        ) {
          event.preventDefault();
          shortcut.action();
          return;
        }
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

// Predefined shortcuts for the table
export interface TableShortcuts {
  onNewRow?: () => void;
  onQuickAdd?: () => void;
  onExport?: () => void;
  onSearch?: () => void;
  onHelp?: () => void;
  onEscape?: () => void;
}

export function useTableShortcuts(actions: TableShortcuts, enabled: boolean = true) {
  const shortcuts: ShortcutConfig[] = [];

  if (actions.onNewRow) {
    shortcuts.push({
      key: "n",
      action: actions.onNewRow,
      description: "Neue Zeile hinzufügen",
    });
  }

  if (actions.onQuickAdd) {
    shortcuts.push({
      key: "q",
      action: actions.onQuickAdd,
      description: "Quick Add öffnen",
    });
  }

  if (actions.onExport) {
    shortcuts.push({
      key: "e",
      action: actions.onExport,
      description: "Export Dialog öffnen",
    });
  }

  if (actions.onSearch) {
    shortcuts.push({
      key: "f",
      action: actions.onSearch,
      description: "Suche fokussieren",
    });
  }

  if (actions.onHelp) {
    shortcuts.push({
      key: "?",
      shift: true,
      action: actions.onHelp,
      description: "Hilfe anzeigen",
    });
  }

  if (actions.onEscape) {
    shortcuts.push({
      key: "Escape",
      action: actions.onEscape,
      description: "Auswahl aufheben / Schließen",
    });
  }

  useKeyboardShortcuts(shortcuts, enabled);
}
