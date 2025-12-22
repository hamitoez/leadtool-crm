"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ReminderList } from "./reminder-list";
import { cn } from "@/lib/utils";

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

export function ReminderBell() {
  const [reminders, setReminders] = useState<{
    upcoming: Reminder[];
    due: Reminder[];
    dueCount: number;
  }>({ upcoming: [], due: [], dueCount: 0 });
  const [open, setOpen] = useState(false);

  const fetchReminders = useCallback(async () => {
    try {
      const res = await fetch("/api/reminders/upcoming");
      if (res.ok) {
        const data = await res.json();
        setReminders(data);
      }
    } catch (error) {
      console.error("Error fetching reminders:", error);
    }
  }, []);

  useEffect(() => {
    fetchReminders();
    // Poll every minute
    const interval = setInterval(fetchReminders, 60000);
    return () => clearInterval(interval);
  }, [fetchReminders]);

  const totalCount = reminders.due.length + reminders.upcoming.length;
  const hasUrgent = reminders.dueCount > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className={cn("h-5 w-5", hasUrgent && "text-orange-500")} />
          {totalCount > 0 && (
            <span
              className={cn(
                "absolute -top-1 -right-1 h-5 w-5 rounded-full text-xs flex items-center justify-center text-white",
                hasUrgent ? "bg-red-500" : "bg-blue-500"
              )}
            >
              {totalCount > 9 ? "9+" : totalCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b">
          <h3 className="font-semibold">Erinnerungen</h3>
          {hasUrgent && (
            <p className="text-xs text-orange-500">
              {reminders.dueCount} überfällig
            </p>
          )}
        </div>
        <ReminderList
          reminders={[...reminders.due, ...reminders.upcoming]}
          onAction={fetchReminders}
          compact
        />
        {totalCount === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Keine anstehenden Erinnerungen
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
