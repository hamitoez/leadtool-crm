import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export interface DashboardStats {
  totalProjects: number;
  totalTables: number;
  totalRows: number;
  totalColumns: number;
  recentActivity: RecentActivityItem[];
  projectStats: ProjectStat[];
  weeklyGrowth: WeeklyGrowth;
}

export interface RecentActivityItem {
  id: string;
  type: "project_created" | "table_created" | "rows_added" | "import";
  title: string;
  description: string;
  timestamp: string;
  projectId?: string;
  tableId?: string;
}

export interface ProjectStat {
  id: string;
  name: string;
  tablesCount: number;
  rowsCount: number;
  updatedAt: string;
}

export interface WeeklyGrowth {
  projects: number;
  tables: number;
  rows: number;
}

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get all user's projects with related data
    const projects = await prisma.project.findMany({
      where: { userId },
      include: {
        tables: {
          include: {
            _count: {
              select: { rows: true, columns: true },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Calculate totals
    const totalProjects = projects.length;
    const totalTables = projects.reduce((acc, p) => acc + p.tables.length, 0);
    const totalRows = projects.reduce(
      (acc, p) => acc + p.tables.reduce((tAcc, t) => tAcc + t._count.rows, 0),
      0
    );
    const totalColumns = projects.reduce(
      (acc, p) => acc + p.tables.reduce((tAcc, t) => tAcc + t._count.columns, 0),
      0
    );

    // Calculate weekly growth (items created in last 7 days)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // Run all independent queries in parallel to avoid N+1 pattern
    const [
      recentProjects,
      recentTables,
      recentRows,
      recentProjectsList,
      recentTablesList,
    ] = await Promise.all([
      prisma.project.count({
        where: {
          userId,
          createdAt: { gte: oneWeekAgo },
        },
      }),
      prisma.table.count({
        where: {
          project: { userId },
          createdAt: { gte: oneWeekAgo },
        },
      }),
      prisma.row.count({
        where: {
          table: { project: { userId } },
          createdAt: { gte: oneWeekAgo },
        },
      }),
      prisma.project.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 3,
      }),
      prisma.table.findMany({
        where: { project: { userId } },
        include: { project: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 3,
      }),
    ]);

    // Build project stats
    const projectStats: ProjectStat[] = projects.slice(0, 5).map((p) => ({
      id: p.id,
      name: p.name,
      tablesCount: p.tables.length,
      rowsCount: p.tables.reduce((acc, t) => acc + t._count.rows, 0),
      updatedAt: p.updatedAt.toISOString(),
    }));

    // Build recent activity from projects and tables
    const recentActivity: RecentActivityItem[] = [];

    // Add recent projects
    for (const project of recentProjectsList) {
      recentActivity.push({
        id: `project-${project.id}`,
        type: "project_created",
        title: `Project created: ${project.name}`,
        description: project.description || "No description",
        timestamp: project.createdAt.toISOString(),
        projectId: project.id,
      });
    }

    // Add recent tables
    for (const table of recentTablesList) {
      recentActivity.push({
        id: `table-${table.id}`,
        type: "table_created",
        title: `Table created: ${table.name}`,
        description: `In project "${table.project.name}"`,
        timestamp: table.createdAt.toISOString(),
        projectId: table.projectId,
        tableId: table.id,
      });
    }

    // Sort by timestamp
    recentActivity.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const stats: DashboardStats = {
      totalProjects,
      totalTables,
      totalRows,
      totalColumns,
      recentActivity: recentActivity.slice(0, 5),
      projectStats,
      weeklyGrowth: {
        projects: recentProjects,
        tables: recentTables,
        rows: recentRows,
      },
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 }
    );
  }
}
