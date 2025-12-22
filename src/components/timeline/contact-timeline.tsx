"use client";

import { useState, useEffect, useCallback } from "react";
import { TimelineItem } from "./timeline-item";
import { TimelineFilters } from "./timeline-filters";
import { Loader2 } from "lucide-react";

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

interface ContactTimelineProps {
  rowId: string;
}

export function ContactTimeline({ rowId }: ContactTimelineProps) {
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const fetchTimeline = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter !== "all") params.set("filter", filter);

      const res = await fetch(`/api/rows/${rowId}/timeline?${params}`);
      const data = await res.json();
      setTimeline(data.timeline || []);
    } catch (error) {
      console.error("Error fetching timeline:", error);
    } finally {
      setLoading(false);
    }
  }, [rowId, filter]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  // Group by date
  const groupedTimeline: Record<string, TimelineEntry[]> = {};
  timeline.forEach((entry) => {
    const date = new Date(entry.createdAt).toLocaleDateString("de-DE", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    if (!groupedTimeline[date]) groupedTimeline[date] = [];
    groupedTimeline[date].push(entry);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <TimelineFilters filter={filter} onFilterChange={setFilter} />

      {timeline.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Keine Einträge vorhanden
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedTimeline).map(([date, entries]) => (
            <div key={date}>
              <h3 className="text-sm font-medium text-muted-foreground mb-3 sticky top-0 bg-background py-1">
                {date}
              </h3>
              <div className="space-y-0 border-l-2 border-muted ml-2">
                {entries.map((entry) => (
                  <TimelineItem key={entry.id} entry={entry} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
