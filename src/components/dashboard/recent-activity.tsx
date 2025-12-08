"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { FolderPlus, TableIcon, Import, Rows3 } from "lucide-react";

interface ActivityItem {
  id: string;
  type: "project_created" | "table_created" | "rows_added" | "import";
  title: string;
  description: string;
  timestamp: string;
  projectId?: string;
  tableId?: string;
}

interface RecentActivityProps {
  activities: ActivityItem[];
}

const activityIcons = {
  project_created: FolderPlus,
  table_created: TableIcon,
  rows_added: Rows3,
  import: Import,
};

const activityColors = {
  project_created: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  table_created: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  rows_added: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  import: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
};

export function RecentActivity({ activities }: RecentActivityProps) {
  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your latest actions and updates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Rows3 className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              No recent activity. Start by creating a project!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Your latest actions and updates</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => {
            const Icon = activityIcons[activity.type];
            const colorClass = activityColors[activity.type];

            const href = activity.tableId && activity.projectId
              ? `/projects/${activity.projectId}/tables/${activity.tableId}`
              : activity.projectId
              ? `/projects/${activity.projectId}`
              : undefined;

            const content = (
              <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center ${colorClass}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{activity.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {activity.description}
                  </p>
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                </div>
              </div>
            );

            return href ? (
              <Link key={activity.id} href={href} className="block">
                {content}
              </Link>
            ) : (
              <div key={activity.id}>{content}</div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
