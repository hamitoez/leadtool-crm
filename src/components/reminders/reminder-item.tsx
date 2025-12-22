"use client";

import { cn } from "@/lib/utils";
import { Bell, Clock, Check, X, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Reminder {
  id: string;
  title: string;
  message: string | null;
  remindAt: string;
  status: string;
  type: string;
  row?: {
    id: string;
    cells: Array<{
      value: unknown;
      column: { name: string; type: string };
    }>;
  };
}

interface ReminderItemProps {
  reminder: Reminder;
  onDismiss: (id: string) => void;
  onSnooze: (id: string, duration: string) => void;
  onComplete: (id: string) => void;
  compact?: boolean;
}

export function ReminderItem({
  reminder,
  onDismiss,
  onSnooze,
  onComplete,
  compact,
}: ReminderItemProps) {
  const isOverdue = new Date(reminder.remindAt) < new Date();

  const getRowName = () => {
    if (!reminder.row?.cells) return null;
    const textCell = reminder.row.cells.find(
      (c) => c.column.type === "TEXT" || c.column.type === "COMPANY"
    );
    if (textCell?.value && typeof textCell.value === "string") {
      return textCell.value;
    }
    return null;
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / 60000);

    if (diffMins < 0) {
      const absMins = Math.abs(diffMins);
      if (absMins < 60) return `vor ${absMins} Min.`;
      if (absMins < 1440) return `vor ${Math.floor(absMins / 60)} Std.`;
      return `vor ${Math.floor(absMins / 1440)} Tagen`;
    }

    if (diffMins < 60) return `in ${diffMins} Min.`;
    if (diffMins < 1440) return `in ${Math.floor(diffMins / 60)} Std.`;
    return date.toLocaleDateString("de-DE");
  };

  const rowName = getRowName();

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-start gap-3 p-3 hover:bg-muted/50 border-b last:border-b-0",
          isOverdue && "bg-red-50 dark:bg-red-950/20"
        )}
      >
        <Bell
          className={cn(
            "h-4 w-4 mt-0.5 shrink-0",
            isOverdue ? "text-red-500" : "text-muted-foreground"
          )}
        />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{reminder.title}</p>
          {rowName && (
            <p className="text-xs text-muted-foreground truncate">{rowName}</p>
          )}
          <p
            className={cn(
              "text-xs mt-1",
              isOverdue ? "text-red-500" : "text-muted-foreground"
            )}
          >
            <Clock className="h-3 w-3 inline mr-1" />
            {formatTime(reminder.remindAt)}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onComplete(reminder.id)}>
              <Check className="h-4 w-4 mr-2" />
              Erledigt
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSnooze(reminder.id, "15m")}>
              15 Min. später
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSnooze(reminder.id, "1h")}>
              1 Std. später
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSnooze(reminder.id, "tomorrow")}>
              Morgen
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDismiss(reminder.id)}
              className="text-destructive"
            >
              <X className="h-4 w-4 mr-2" />
              Verwerfen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  // Full version
  return (
    <div
      className={cn(
        "flex items-start gap-4 p-4 border rounded-lg",
        isOverdue && "border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900"
      )}
    >
      <div
        className={cn(
          "p-2 rounded-lg shrink-0",
          isOverdue
            ? "bg-red-100 dark:bg-red-900/30"
            : "bg-blue-100 dark:bg-blue-900/30"
        )}
      >
        <Bell
          className={cn(
            "h-5 w-5",
            isOverdue
              ? "text-red-600 dark:text-red-400"
              : "text-blue-600 dark:text-blue-400"
          )}
        />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium">{reminder.title}</p>
        {reminder.message && (
          <p className="text-sm text-muted-foreground mt-1">{reminder.message}</p>
        )}
        {rowName && (
          <p className="text-sm text-muted-foreground mt-1">
            Kontakt: {rowName}
          </p>
        )}
        <p
          className={cn(
            "text-sm mt-2 flex items-center gap-1",
            isOverdue ? "text-red-500" : "text-muted-foreground"
          )}
        >
          <Clock className="h-4 w-4" />
          {formatTime(reminder.remindAt)}
        </p>
      </div>

      <div className="flex gap-2 shrink-0">
        <Button size="sm" onClick={() => onComplete(reminder.id)}>
          <Check className="h-4 w-4 mr-1" />
          Erledigt
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              Snooze
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onSnooze(reminder.id, "15m")}>
              15 Minuten
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSnooze(reminder.id, "1h")}>
              1 Stunde
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSnooze(reminder.id, "3h")}>
              3 Stunden
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSnooze(reminder.id, "tomorrow")}>
              Morgen 9:00
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSnooze(reminder.id, "next_week")}>
              Nächste Woche
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDismiss(reminder.id)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
