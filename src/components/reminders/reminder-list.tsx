"use client";

import { ReminderItem } from "./reminder-item";

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
    table?: {
      id: string;
      name: string;
      projectId: string;
    };
  };
  activity?: {
    id: string;
    title: string;
    type: string;
  };
}

interface ReminderListProps {
  reminders: Reminder[];
  onAction?: () => void;
  compact?: boolean;
}

export function ReminderList({ reminders, onAction, compact }: ReminderListProps) {
  const handleDismiss = async (id: string) => {
    try {
      await fetch(`/api/reminders/${id}/dismiss`, { method: "POST" });
      onAction?.();
    } catch (error) {
      console.error("Error dismissing reminder:", error);
    }
  };

  const handleSnooze = async (id: string, duration: string) => {
    try {
      await fetch(`/api/reminders/${id}/snooze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duration }),
      });
      onAction?.();
    } catch (error) {
      console.error("Error snoozing reminder:", error);
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await fetch(`/api/reminders/${id}/complete`, { method: "POST" });
      onAction?.();
    } catch (error) {
      console.error("Error completing reminder:", error);
    }
  };

  if (reminders.length === 0) {
    return null;
  }

  return (
    <div className={compact ? "max-h-[300px] overflow-y-auto" : "space-y-2"}>
      {reminders.map((reminder) => (
        <ReminderItem
          key={reminder.id}
          reminder={reminder}
          onDismiss={handleDismiss}
          onSnooze={handleSnooze}
          onComplete={handleComplete}
          compact={compact}
        />
      ))}
    </div>
  );
}
