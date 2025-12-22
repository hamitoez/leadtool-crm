"use client";

import { useState, useEffect, useCallback } from "react";
import { ActivityItem } from "./activity-item";
import { ActivityFilters } from "./activity-filters";
import { Loader2 } from "lucide-react";

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
  _count?: { reminders: number };
}

interface ActivityListProps {
  rowId?: string;
  onActivityClick?: (activity: Activity) => void;
  showRowInfo?: boolean;
}

export function ActivityList({ rowId, onActivityClick, showRowInfo = false }: ActivityListProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<{
    type: string | null;
    status: string | null;
  }>({ type: null, status: null });

  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (rowId) params.set("rowId", rowId);
      if (filters.type) params.set("type", filters.type);
      if (filters.status) params.set("status", filters.status);

      const res = await fetch(`/api/activities?${params}`);
      const data = await res.json();
      setActivities(data.activities || []);
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setLoading(false);
    }
  }, [rowId, filters]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const handleComplete = async (activityId: string) => {
    try {
      await fetch(`/api/activities/${activityId}/complete`, { method: "POST" });
      fetchActivities();
    } catch (error) {
      console.error("Error completing activity:", error);
    }
  };

  const handleStatusChange = async (activityId: string, status: string) => {
    try {
      await fetch(`/api/activities/${activityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      fetchActivities();
    } catch (error) {
      console.error("Error updating activity status:", error);
    }
  };

  // Group activities by date
  const groupedActivities: Record<string, Activity[]> = {};
  activities.forEach((activity) => {
    const date = new Date(activity.createdAt).toLocaleDateString("de-DE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    if (!groupedActivities[date]) groupedActivities[date] = [];
    groupedActivities[date].push(activity);
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
      <ActivityFilters
        filters={filters}
        onFiltersChange={setFilters}
      />

      {activities.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Keine Aktivitäten vorhanden
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedActivities).map(([date, dayActivities]) => (
            <div key={date}>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                {date}
              </h3>
              <div className="space-y-2">
                {dayActivities.map((activity) => (
                  <ActivityItem
                    key={activity.id}
                    activity={activity}
                    onClick={() => onActivityClick?.(activity)}
                    onComplete={handleComplete}
                    onStatusChange={handleStatusChange}
                    onUpdated={fetchActivities}
                    onDeleted={fetchActivities}
                    showRowInfo={showRowInfo}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
