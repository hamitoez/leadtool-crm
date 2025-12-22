"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TimelineFiltersProps {
  filter: string;
  onFilterChange: (filter: string) => void;
}

const filters = [
  { value: "all", label: "Alle" },
  { value: "activities", label: "Aktivitäten" },
  { value: "changes", label: "Änderungen" },
];

export function TimelineFilters({ filter, onFilterChange }: TimelineFiltersProps) {
  return (
    <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
      {filters.map((f) => (
        <Button
          key={f.value}
          variant="ghost"
          size="sm"
          onClick={() => onFilterChange(f.value)}
          className={cn(
            "h-7 px-3",
            filter === f.value && "bg-background shadow-sm"
          )}
        >
          {f.label}
        </Button>
      ))}
    </div>
  );
}
