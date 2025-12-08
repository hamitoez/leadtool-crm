"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoreVertical, Pencil, Trash2, Table2, Columns3 } from "lucide-react";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { EditTableDialog } from "./edit-table-dialog";
import { toast } from "sonner";
import { formatDistanceToNow } from "@/lib/utils";

interface TableCardProps {
  projectId: string;
  table: {
    id: string;
    name: string;
    description: string | null;
    updatedAt: Date;
    _count: {
      rows: number;
      columns: number;
    };
  };
}

export function TableCard({ projectId, table }: TableCardProps) {
  const [showEditDialog, setShowEditDialog] = React.useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    try {
      setIsDeleting(true);

      const response = await fetch(`/api/projects/${projectId}/tables/${table.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete table");
      }

      toast.success("Table deleted successfully");
      setShowDeleteDialog(false);
      router.refresh();
    } catch (error) {
      console.error("Error deleting table:", error);
      toast.error("Failed to delete table. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Card className="group relative transition-all hover:shadow-md">
        <Link href={`/projects/${projectId}/tables/${table.id}`}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="line-clamp-1">{table.name}</CardTitle>
                <CardDescription className="line-clamp-2 mt-1.5">
                  {table.description || "No description"}
                </CardDescription>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">Open menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      setShowEditDialog(true);
                    }}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      setShowDeleteDialog(true);
                    }}
                    className="text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="flex items-center gap-1">
                <Table2 className="h-3 w-3" />
                {table._count.rows} row{table._count.rows !== 1 ? "s" : ""}
              </Badge>
              <Badge variant="secondary" className="flex items-center gap-1">
                <Columns3 className="h-3 w-3" />
                {table._count.columns} column{table._count.columns !== 1 ? "s" : ""}
              </Badge>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Updated {formatDistanceToNow(new Date(table.updatedAt))}
            </p>
          </CardContent>
        </Link>
      </Card>

      <EditTableDialog
        projectId={projectId}
        table={table}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
      />

      <DeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDelete}
        title="Delete Table"
        description={`Are you sure you want to delete "${table.name}"? This will permanently delete the table and all its data. This action cannot be undone.`}
        itemName={table.name}
        requireConfirmation={true}
        isLoading={isDeleting}
      />
    </>
  );
}
