"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface ActivityFiltersProps {
  filters: {
    type: string | null;
    status: string | null;
  };
  onFiltersChange: (filters: { type: string | null; status: string | null }) => void;
}

const activityTypes = [
  { value: "CALL", label: "Anrufe" },
  { value: "EMAIL", label: "E-Mails" },
  { value: "MEETING", label: "Meetings" },
  { value: "NOTE", label: "Notizen" },
  { value: "TASK", label: "Aufgaben" },
  { value: "DOCUMENT", label: "Dokumente" },
];

const activityStatuses = [
  { value: "PLANNED", label: "Geplant" },
  { value: "COMPLETED", label: "Erledigt" },
  { value: "CANCELLED", label: "Abgesagt" },
  { value: "MISSED", label: "Verpasst" },
];

export function ActivityFilters({ filters, onFiltersChange }: ActivityFiltersProps) {
  const hasFilters = filters.type || filters.status;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select
        value={filters.type || "all"}
        onValueChange={(value) =>
          onFiltersChange({ ...filters, type: value === "all" ? null : value })
        }
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Alle Typen" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alle Typen</SelectItem>
          {activityTypes.map((type) => (
            <SelectItem key={type.value} value={type.value}>
              {type.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.status || "all"}
        onValueChange={(value) =>
          onFiltersChange({ ...filters, status: value === "all" ? null : value })
        }
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Alle Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alle Status</SelectItem>
          {activityStatuses.map((status) => (
            <SelectItem key={status.value} value={status.value}>
              {status.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onFiltersChange({ type: null, status: null })}
        >
          <X className="h-4 w-4 mr-1" />
          Filter zurücksetzen
        </Button>
      )}
    </div>
  );
}
