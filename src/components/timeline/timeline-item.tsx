"use client";

import { cn } from "@/lib/utils";
import {
  Phone,
  Mail,
  Calendar,
  FileText,
  CheckSquare,
  File,
  MessageSquare,
  ArrowRight,
  Trophy,
  XCircle,
  Pencil,
  Globe,
  Import,
  Bell,
  Plus,
  Trash,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface TimelineEntry {
  id: string;
  type: "activity" | "history";
  eventType: string;
  title: string;
  description?: string | null;
  createdAt: string;
  user?: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
  metadata?: Record<string, unknown>;
  activityType?: string;
  activityStatus?: string;
  fieldName?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
}

interface TimelineItemProps {
  entry: TimelineEntry;
}

const eventIcons: Record<string, React.ReactNode> = {
  // Activities
  CALL: <Phone className="h-3.5 w-3.5" />,
  EMAIL: <Mail className="h-3.5 w-3.5" />,
  MEETING: <Calendar className="h-3.5 w-3.5" />,
  NOTE: <FileText className="h-3.5 w-3.5" />,
  TASK: <CheckSquare className="h-3.5 w-3.5" />,
  DOCUMENT: <File className="h-3.5 w-3.5" />,
  COMMENT: <MessageSquare className="h-3.5 w-3.5" />,

  // History events
  CREATED: <Plus className="h-3.5 w-3.5" />,
  UPDATED: <Pencil className="h-3.5 w-3.5" />,
  DELETED: <Trash className="h-3.5 w-3.5" />,
  CALL_LOGGED: <Phone className="h-3.5 w-3.5" />,
  EMAIL_SENT: <Mail className="h-3.5 w-3.5" />,
  EMAIL_RECEIVED: <Mail className="h-3.5 w-3.5" />,
  MEETING_SCHEDULED: <Calendar className="h-3.5 w-3.5" />,
  MEETING_COMPLETED: <Calendar className="h-3.5 w-3.5" />,
  NOTE_ADDED: <FileText className="h-3.5 w-3.5" />,
  TASK_CREATED: <CheckSquare className="h-3.5 w-3.5" />,
  TASK_COMPLETED: <CheckSquare className="h-3.5 w-3.5" />,
  DOCUMENT_UPLOADED: <File className="h-3.5 w-3.5" />,
  DEAL_CREATED: <Plus className="h-3.5 w-3.5" />,
  STAGE_CHANGED: <ArrowRight className="h-3.5 w-3.5" />,
  DEAL_WON: <Trophy className="h-3.5 w-3.5" />,
  DEAL_LOST: <XCircle className="h-3.5 w-3.5" />,
  VALUE_CHANGED: <Pencil className="h-3.5 w-3.5" />,
  PROBABILITY_CHANGED: <Pencil className="h-3.5 w-3.5" />,
  FIELD_CHANGED: <Pencil className="h-3.5 w-3.5" />,
  SCRAPED: <Globe className="h-3.5 w-3.5" />,
  MERGED: <Plus className="h-3.5 w-3.5" />,
  REMINDER_SENT: <Bell className="h-3.5 w-3.5" />,
  AUTO_MOVED: <ArrowRight className="h-3.5 w-3.5" />,
  IMPORTED: <Import className="h-3.5 w-3.5" />,
};

const eventColors: Record<string, string> = {
  // Positive
  DEAL_WON: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  TASK_COMPLETED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  MEETING_COMPLETED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",

  // Negative
  DEAL_LOST: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  DELETED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",

  // Activities
  CALL: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  CALL_LOGGED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  EMAIL: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  EMAIL_SENT: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  MEETING: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  MEETING_SCHEDULED: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",

  // Changes
  STAGE_CHANGED: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  VALUE_CHANGED: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",

  // Default
  DEFAULT: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
};

export function TimelineItem({ entry }: TimelineItemProps) {
  const eventType = entry.activityType || entry.eventType;
  const icon = eventIcons[eventType] || eventIcons.NOTE;
  const colorClass = eventColors[eventType] || eventColors.DEFAULT;

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "string") return value;
    if (typeof value === "number") return value.toLocaleString("de-DE");
    if (typeof value === "object" && "name" in (value as object)) {
      return (value as { name: string }).name;
    }
    return JSON.stringify(value);
  };

  return (
    <div className="relative pl-6 pb-4">
      {/* Timeline dot */}
      <div
        className={cn(
          "absolute -left-[9px] p-1.5 rounded-full",
          colorClass
        )}
      >
        {icon}
      </div>

      {/* Content */}
      <div className="ml-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <p className="font-medium text-sm">{entry.title}</p>
            {entry.description && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {entry.description}
              </p>
            )}

            {/* Show field changes */}
            {entry.fieldName && (entry.oldValue !== undefined || entry.newValue !== undefined) && (
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <span className="line-through">{formatValue(entry.oldValue)}</span>
                <ArrowRight className="h-3 w-3" />
                <span className="font-medium">{formatValue(entry.newValue)}</span>
              </div>
            )}
          </div>

          <span className="text-xs text-muted-foreground shrink-0">
            {formatTime(entry.createdAt)}
          </span>
        </div>

        {/* User info */}
        {entry.user && (
          <div className="flex items-center gap-1.5 mt-2">
            <Avatar className="h-4 w-4">
              <AvatarImage src={entry.user.image || undefined} />
              <AvatarFallback className="text-[8px]">
                {entry.user.name?.[0] || entry.user.email[0]}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground">
              {entry.user.name || entry.user.email}
            </span>
          </div>
        )}

        {/* System event indicator */}
        {!entry.user && entry.type === "history" && (
          <span className="text-xs text-muted-foreground mt-1 inline-block">
            System
          </span>
        )}
      </div>
    </div>
  );
}
