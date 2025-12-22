"use client";

import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivityList, CreateTaskDialog } from "@/components/activities";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, CheckSquare, Clock, AlertTriangle, Search, Plus } from "lucide-react";

interface TaskStats {
  total: number;
  planned: number;
  completed: number;
  overdue: number;
}

export default function TasksPage() {
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const [todayRes, overdueRes] = await Promise.all([
        fetch("/api/activities/today"),
        fetch("/api/activities/overdue"),
      ]);

      const today = await todayRes.json();
      const overdue = await overdueRes.json();

      setStats({
        total: (today.tasksDueToday?.length || 0) + (overdue.total || 0),
        planned: today.tasksDueToday?.length || 0,
        completed: 0, // Would need another API call
        overdue: overdue.total || 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Aufgaben</h1>
          <p className="text-muted-foreground">
            Alle Tasks und Aktivitäten im Überblick
          </p>
        </div>
        <CreateTaskDialog onTaskCreated={fetchStats}>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Neue Aufgabe
          </Button>
        </CreateTaskDialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <CheckSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Gesamt</p>
            <p className="text-2xl font-semibold">{stats?.total || 0}</p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
            <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Heute fällig</p>
            <p className="text-2xl font-semibold">{stats?.planned || 0}</p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Überfällig</p>
            <p className="text-2xl font-semibold">{stats?.overdue || 0}</p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
            <CheckSquare className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Erledigt heute</p>
            <p className="text-2xl font-semibold">{stats?.completed || 0}</p>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">
            Alle Aufgaben
          </TabsTrigger>
          <TabsTrigger value="today">
            Heute
            {stats && stats.planned > 0 && (
              <Badge variant="secondary" className="ml-2">
                {stats.planned}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="overdue">
            Überfällig
            {stats && stats.overdue > 0 && (
              <Badge variant="destructive" className="ml-2">
                {stats.overdue}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="activities">
            Alle Aktivitäten
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Card className="p-4">
            <TasksView filter="TASK" status="PLANNED" onRefresh={fetchStats} />
          </Card>
        </TabsContent>

        <TabsContent value="today">
          <Card className="p-4">
            <TodayTasksView onRefresh={fetchStats} />
          </Card>
        </TabsContent>

        <TabsContent value="overdue">
          <Card className="p-4">
            <OverdueTasksView onRefresh={fetchStats} />
          </Card>
        </TabsContent>

        <TabsContent value="activities">
          <Card className="p-4">
            <ActivityList showRowInfo />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Tasks View Component
function TasksView({
  filter,
  status,
  onRefresh,
}: {
  filter?: string;
  status?: string;
  onRefresh: () => void;
}) {
  const [tasks, setTasks] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTasks() {
      try {
        const params = new URLSearchParams();
        if (filter) params.set("type", filter);
        if (status) params.set("status", status);

        const res = await fetch(`/api/activities?${params}`);
        const data = await res.json();
        setTasks(data.activities || []);
      } catch (error) {
        console.error("Error fetching tasks:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchTasks();
  }, [filter, status]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Keine Aufgaben vorhanden
      </div>
    );
  }

  return <ActivityList showRowInfo />;
}

// Today's Tasks View
function TodayTasksView({ onRefresh }: { onRefresh: () => void }) {
  const [data, setData] = useState<{ tasksDueToday: unknown[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchToday() {
      try {
        const res = await fetch("/api/activities/today");
        const data = await res.json();
        setData(data);
      } catch (error) {
        console.error("Error fetching today's tasks:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchToday();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data?.tasksDueToday?.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Keine Aufgaben für heute
      </div>
    );
  }

  return <ActivityList showRowInfo />;
}

// Overdue Tasks View
function OverdueTasksView({ onRefresh }: { onRefresh: () => void }) {
  const [data, setData] = useState<{ tasks: unknown[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOverdue() {
      try {
        const res = await fetch("/api/activities/overdue");
        const data = await res.json();
        setData(data);
      } catch (error) {
        console.error("Error fetching overdue tasks:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchOverdue();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data?.tasks?.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Keine überfälligen Aufgaben
      </div>
    );
  }

  return <ActivityList showRowInfo />;
}
