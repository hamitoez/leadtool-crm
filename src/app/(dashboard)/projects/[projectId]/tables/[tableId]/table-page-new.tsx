import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableViewClient } from "@/components/table/table-view-client";
import { RowData, ColumnConfig, CellData, JsonValue } from "@/types/table";

interface TableViewPageProps {
  params: Promise<{ projectId: string; tableId: string }>;
}

export default async function TableViewPageNew({ params }: TableViewPageProps) {
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

  // Get table details with columns
  const table = await prisma.table.findUnique({
    where: {
      id: tableId,
      projectId,
    },
    include: {
      columns: {
        orderBy: {
          position: "asc",
        },
      },
    },
  });

  if (!table) {
    notFound();
  }

  // Fetch rows with cells (limit to first 100 for initial load)
  const rows = await prisma.row.findMany({
    where: { tableId },
    include: {
      cells: {
        include: {
          column: {
            select: {
              id: true,
              type: true,
            },
          },
        },
      },
    },
    orderBy: { position: "asc" },
    take: 100,
  });

  // Format data for client component
  const formattedColumns: ColumnConfig[] = table.columns.map((col) => ({
    id: col.id,
    name: col.name,
    type: col.type,
    position: col.position,
    width: col.width,
    isVisible: col.isVisible,
    isPinned: col.isPinned,
    config: col.config as Record<string, JsonValue>,
    aiConfig: col.aiConfig as Record<string, JsonValue> | undefined,
  }));

  const formattedRows: RowData[] = rows.map((row) => ({
    id: row.id,
    position: row.position,
    isFavorite: row.isFavorite,
    notes: row.notes,
    cells: row.cells.reduce(
      (acc, cell) => {
        acc[cell.columnId] = {
          id: cell.id,
          rowId: cell.rowId,
          columnId: cell.columnId,
          value: cell.value,
          metadata: cell.metadata as Record<string, JsonValue>,
          createdAt: cell.createdAt,
          updatedAt: cell.updatedAt,
        };
        return acc;
      },
      {} as Record<string, CellData>
    ),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-4">
          <Link href={`/projects/${projectId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {table.name}
            </h1>
            {table.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {table.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-hidden">
        <TableViewClient
          initialRows={formattedRows}
          columns={formattedColumns}
          tableId={tableId}
        />
      </div>
    </div>
  );
}
