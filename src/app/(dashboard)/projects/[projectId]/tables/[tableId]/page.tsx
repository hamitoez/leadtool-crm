import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { TableViewClient } from "@/components/table/table-view-client";
import { RowData, ColumnConfig } from "@/types/table";

interface TableViewPageProps {
  params: Promise<{ projectId: string; tableId: string }>;
}

export default async function TableViewPage({ params }: TableViewPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { projectId, tableId } = await params;

  // Verify project ownership
  const project = await prisma.project.findUnique({
    where: {
      id: projectId,
      userId: session.user.id,
    },
  });

  if (!project) {
    notFound();
  }

  // Get table details with columns and rows
  const table = await prisma.table.findUnique({
    where: {
      id: tableId,
      projectId,
    },
    include: {
      columns: {
        where: { isVisible: true },
        orderBy: { position: "asc" },
      },
      rows: {
        orderBy: { position: "asc" },
        include: {
          cells: true,
        },
      },
    },
  });

  if (!table) {
    notFound();
  }

  // Transform columns to ColumnConfig format
  const columns: ColumnConfig[] = table.columns.map((col) => ({
    id: col.id,
    name: col.name,
    type: col.type,
    position: col.position,
    width: col.width,
    isVisible: col.isVisible,
    isPinned: col.isPinned,
    config: (col.config || {}) as ColumnConfig["config"],
    aiConfig: col.aiConfig as ColumnConfig["aiConfig"],
  }));

  // Transform rows to RowData format
  const rows: RowData[] = table.rows.map((row) => ({
    id: row.id,
    position: row.position,
    isFavorite: row.isFavorite,
    notes: row.notes,
    cells: row.cells.reduce(
      (acc, cell) => ({
        ...acc,
        [cell.columnId]: {
          id: cell.id,
          rowId: cell.rowId,
          columnId: cell.columnId,
          value: cell.value,
          metadata: (cell.metadata as Record<string, unknown>) || {},
          createdAt: cell.createdAt,
          updatedAt: cell.updatedAt,
        },
      }),
      {}
    ),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center space-x-1 text-sm text-muted-foreground">
        <Link
          href="/projects"
          className="hover:text-foreground transition-colors"
        >
          Projects
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link
          href={`/projects/${projectId}`}
          className="hover:text-foreground transition-colors"
        >
          {project.name}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">{table.name}</span>
      </nav>

      {/* Table View */}
      <div className="flex-1 min-h-0">
        <TableViewClient
          initialRows={rows}
          columns={columns}
          tableId={tableId}
          tableName={table.name}
        />
      </div>
    </div>
  );
}
