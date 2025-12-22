"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Phone,
  Mail,
  Calendar,
  FileText,
  CheckSquare,
  File,
  MessageSquare,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { toast } from "sonner";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface Activity {
  id: string;
  rowId: string;
  type: string;
  status: string;
  title: string;
  description: string | null;
  priority: string | null;
  dueDate: string | null;
  completedAt: string | null;
  callDuration: number | null;
  callOutcome: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  row?: {
    id: string;
    cells: Array<{
      value: unknown;
      column: { name: string; type: string };
    }>;
  };
}

interface ActivityItemProps {
  activity: Activity;
  onClick?: () => void;
  onComplete?: (id: string) => void;
  onStatusChange?: (id: string, status: string) => void;
  onUpdated?: () => void;
  onDeleted?: () => void;
  showRowInfo?: boolean;
}

const activityIcons: Record<string, React.ReactNode> = {
  CALL: <Phone className="h-4 w-4" />,
  EMAIL: <Mail className="h-4 w-4" />,
  MEETING: <Calendar className="h-4 w-4" />,
  NOTE: <FileText className="h-4 w-4" />,
  TASK: <CheckSquare className="h-4 w-4" />,
  DOCUMENT: <File className="h-4 w-4" />,
  COMMENT: <MessageSquare className="h-4 w-4" />,
};

const activityColors: Record<string, string> = {
  CALL: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  EMAIL: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  MEETING: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  NOTE: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  TASK: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  DOCUMENT: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  COMMENT: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
};

const statusIcons: Record<string, React.ReactNode> = {
  COMPLETED: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  CANCELLED: <XCircle className="h-4 w-4 text-red-500" />,
  MISSED: <AlertCircle className="h-4 w-4 text-orange-500" />,
  PLANNED: <Clock className="h-4 w-4 text-blue-500" />,
};

const priorityColors: Record<string, string> = {
  URGENT: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  HIGH: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  MEDIUM: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  LOW: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
};

export function ActivityItem({
  activity,
  onClick,
  onComplete,
  onStatusChange,
  onUpdated,
  onDeleted,
  showRowInfo,
}: ActivityItemProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editTitle, setEditTitle] = useState(activity.title);
  const [editDescription, setEditDescription] = useState(activity.description || "");
  const [editPriority, setEditPriority] = useState(activity.priority || "MEDIUM");
  const [editStatus, setEditStatus] = useState(activity.status);
  const [editDueDate, setEditDueDate] = useState<Date | undefined>(
    activity.dueDate ? new Date(activity.dueDate) : undefined
  );

  const isTask = activity.type === "TASK";
  const isCompleted = activity.status === "COMPLETED";
  const isOverdue =
    activity.dueDate &&
    activity.status === "PLANNED" &&
    new Date(activity.dueDate) < new Date();

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const getRowName = () => {
    if (!activity.row?.cells) return null;
    const textCell = activity.row.cells.find(
      (c) => c.column.type === "TEXT" || c.column.type === "COMPANY"
    );
    if (textCell?.value && typeof textCell.value === "string") {
      return textCell.value;
    }
    return null;
  };

  const handleCheckboxChange = async () => {
    const newStatus = isCompleted ? "PLANNED" : "COMPLETED";

    if (onStatusChange) {
      onStatusChange(activity.id, newStatus);
    } else if (onComplete && !isCompleted) {
      onComplete(activity.id);
    } else {
      // Fallback: direct API call for status toggle
      try {
        const res = await fetch(`/api/activities/${activity.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
        if (res.ok) {
          toast.success(newStatus === "COMPLETED" ? "Aufgabe erledigt" : "Aufgabe wieder geoeffnet");
          onUpdated?.();
        }
      } catch (error) {
        console.error("Error updating status:", error);
        toast.error("Fehler beim Aktualisieren");
      }
    }
  };

  const handleEdit = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/activities/${activity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription || null,
          priority: editPriority,
          status: editStatus,
          dueDate: editDueDate?.toISOString() || null,
        }),
      });

      if (res.ok) {
        toast.success("Aktivitaet aktualisiert");
        setEditDialogOpen(false);
        onUpdated?.();
      } else {
        const data = await res.json();
        toast.error(data.error || "Fehler beim Aktualisieren");
      }
    } catch (error) {
      console.error("Error updating activity:", error);
      toast.error("Fehler beim Aktualisieren");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/activities/${activity.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Aktivitaet geloescht");
        setDeleteDialogOpen(false);
        onDeleted?.();
      } else {
        const data = await res.json();
        toast.error(data.error || "Fehler beim Loeschen");
      }
    } catch (error) {
      console.error("Error deleting activity:", error);
      toast.error("Fehler beim Loeschen");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card
        className={cn(
          "p-3 cursor-pointer hover:shadow-md transition-shadow",
          isCompleted && "opacity-60"
        )}
        onClick={onClick}
      >
        <div className="flex items-start gap-3">
          {/* Task Checkbox - now toggleable */}
          {isTask && (
            <Checkbox
              checked={isCompleted}
              onCheckedChange={handleCheckboxChange}
              onClick={(e) => e.stopPropagation()}
              className="mt-1"
            />
          )}

          {/* Activity Icon */}
          <div
            className={cn(
              "p-2 rounded-lg shrink-0",
              activityColors[activity.type] || activityColors.NOTE
            )}
          >
            {activityIcons[activity.type] || activityIcons.NOTE}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "font-medium truncate",
                    isCompleted && "line-through"
                  )}
                >
                  {activity.title}
                </p>
                {activity.description && (
                  <p className="text-sm text-muted-foreground truncate">
                    {activity.description}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {activity.priority && (
                  <Badge
                    variant="secondary"
                    className={cn("text-xs", priorityColors[activity.priority])}
                  >
                    {activity.priority}
                  </Badge>
                )}
                {statusIcons[activity.status]}

                {/* Dropdown Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditTitle(activity.title);
                        setEditDescription(activity.description || "");
                        setEditPriority(activity.priority || "MEDIUM");
                        setEditStatus(activity.status);
                        setEditDueDate(activity.dueDate ? new Date(activity.dueDate) : undefined);
                        setEditDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Bearbeiten
                    </DropdownMenuItem>
                    {isCompleted && (
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCheckboxChange();
                        }}
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Wieder oeffnen
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Loeschen
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Meta Info */}
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span>{formatTime(activity.createdAt)}</span>

              {activity.callDuration && (
                <span>{formatDuration(activity.callDuration)}</span>
              )}

              {activity.dueDate && (
                <span className={cn(isOverdue && "text-red-500 font-medium")}>
                  Faellig: {new Date(activity.dueDate).toLocaleDateString("de-DE")}
                </span>
              )}

              {showRowInfo && getRowName() && (
                <span className="truncate max-w-[150px]">{getRowName()}</span>
              )}

              <div className="flex items-center gap-1 ml-auto">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={activity.user.image || undefined} />
                  <AvatarFallback className="text-[10px]">
                    {activity.user.name?.[0] || activity.user.email[0]}
                  </AvatarFallback>
                </Avatar>
                <span>{activity.user.name || activity.user.email}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Aktivitaet bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Titel</Label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Titel"
              />
            </div>
            <div className="space-y-2">
              <Label>Beschreibung</Label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Optionale Beschreibung..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PLANNED">Geplant</SelectItem>
                    <SelectItem value="COMPLETED">Erledigt</SelectItem>
                    <SelectItem value="CANCELLED">Abgesagt</SelectItem>
                    <SelectItem value="MISSED">Verpasst</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioritaet</Label>
                <Select value={editPriority} onValueChange={setEditPriority}>
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
            </div>
            {isTask && (
              <div className="space-y-2">
                <Label>Faellig am</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !editDueDate && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {editDueDate
                        ? format(editDueDate, "dd.MM.yyyy", { locale: de })
                        : "Datum waehlen"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={editDueDate}
                      onSelect={setEditDueDate}
                      locale={de}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {editDueDate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditDueDate(undefined)}
                    className="text-xs"
                  >
                    Datum entfernen
                  </Button>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleEdit} disabled={saving || !editTitle.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Aktivitaet loeschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Bist du sicher, dass du &quot;{activity.title}&quot; loeschen moechtest?
              Diese Aktion kann nicht rueckgaengig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Loeschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
