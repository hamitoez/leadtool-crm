"use client";

import { useEffect, useState } from "react";
import { StatCard } from "./stat-card";
import { RecentActivity } from "./recent-activity";
import { ProjectStats } from "./project-stats";
import { QuickActions } from "./quick-actions";
import { FolderKanban, Table2, Rows3, Columns3, Loader2 } from "lucide-react";
import type { DashboardStats } from "@/app/api/dashboard/route";

interface DashboardClientProps {
  userName: string;
}

export function DashboardClient({ userName }: DashboardClientProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch("/api/dashboard");
        if (!response.ok) {
          throw new Error("Failed to fetch dashboard stats");
        }
        const data = await response.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    }

    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Welcome back, {userName}</h1>
        <p className="text-muted-foreground">
          Here&apos;s an overview of your CRM data
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Projects"
          value={stats.totalProjects}
          description="Active projects"
          icon={FolderKanban}
          trend={
            stats.weeklyGrowth.projects > 0
              ? {
                  value: stats.weeklyGrowth.projects,
                  label: "this week",
                  isPositive: true,
                }
              : undefined
          }
        />
        <StatCard
          title="Total Tables"
          value={stats.totalTables}
          description="Across all projects"
          icon={Table2}
          trend={
            stats.weeklyGrowth.tables > 0
              ? {
                  value: stats.weeklyGrowth.tables,
                  label: "this week",
                  isPositive: true,
                }
              : undefined
          }
        />
        <StatCard
          title="Total Rows"
          value={stats.totalRows}
          description="Data entries"
          icon={Rows3}
          trend={
            stats.weeklyGrowth.rows > 0
              ? {
                  value: stats.weeklyGrowth.rows,
                  label: "this week",
                  isPositive: true,
                }
              : undefined
          }
        />
        <StatCard
          title="Total Columns"
          value={stats.totalColumns}
          description="Data fields"
          icon={Columns3}
        />
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column */}
        <div className="space-y-6">
          <ProjectStats
            projects={stats.projectStats}
            totalRows={stats.totalRows}
          />
          <QuickActions />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <RecentActivity activities={stats.recentActivity} />
        </div>
      </div>
    </div>
  );
}
