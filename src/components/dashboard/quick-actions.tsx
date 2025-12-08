"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderPlus, Upload, Settings, BookOpen } from "lucide-react";

const actions = [
  {
    title: "New Project",
    description: "Create a new project to organize your data",
    href: "/projects",
    icon: FolderPlus,
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  },
  {
    title: "Import Data",
    description: "Upload CSV files to import leads",
    href: "/import",
    icon: Upload,
    color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  },
  {
    title: "Settings",
    description: "Configure your account preferences",
    href: "/settings",
    icon: Settings,
    color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  },
  {
    title: "Documentation",
    description: "Learn how to use LeadTool CRM",
    href: "#",
    icon: BookOpen,
    color: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  },
];

export function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Common tasks to get started</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {actions.map((action) => (
            <Link
              key={action.title}
              href={action.href}
              className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
            >
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${action.color}`}>
                <action.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{action.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {action.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
