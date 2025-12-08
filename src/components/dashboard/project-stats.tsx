"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { FolderKanban, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProjectStat {
  id: string;
  name: string;
  tablesCount: number;
  rowsCount: number;
  updatedAt: string;
}

interface ProjectStatsProps {
  projects: ProjectStat[];
  totalRows: number;
}

export function ProjectStats({ projects, totalRows }: ProjectStatsProps) {
  if (projects.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Projects Overview</CardTitle>
          <CardDescription>Your top projects by data volume</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <FolderKanban className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              No projects yet. Create your first project to get started!
            </p>
            <Button asChild>
              <Link href="/projects">Create Project</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Projects Overview</CardTitle>
          <CardDescription>Your top projects by data volume</CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/projects">
            View all
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {projects.map((project) => {
            const percentage = totalRows > 0
              ? Math.round((project.rowsCount / totalRows) * 100)
              : 0;

            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="block"
              >
                <div className="space-y-2 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate max-w-[200px]">
                        {project.name}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {project.tablesCount} {project.tablesCount === 1 ? "table" : "tables"}
                      </Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {project.rowsCount.toLocaleString()} rows
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={percentage} className="h-2 flex-1" />
                    <span className="text-xs text-muted-foreground w-10 text-right">
                      {percentage}%
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Updated {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
