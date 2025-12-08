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
import { MoreVertical, Pencil, Trash2, FolderKanban } from "lucide-react";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { EditProjectDialog } from "./edit-project-dialog";
import { toast } from "sonner";
import { formatDistanceToNow } from "@/lib/utils";

interface ProjectCardProps {
  project: {
    id: string;
    name: string;
    description: string | null;
    updatedAt: Date;
    _count: {
      tables: number;
    };
  };
}

export function ProjectCard({ project }: ProjectCardProps) {
  const [showEditDialog, setShowEditDialog] = React.useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    try {
      setIsDeleting(true);

      const response = await fetch(`/api/projects/${project.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete project");
      }

      toast.success("Project deleted successfully");
      setShowDeleteDialog(false);
      router.refresh();
    } catch (error) {
      console.error("Error deleting project:", error);
      toast.error("Failed to delete project. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Card className="group relative transition-all hover:shadow-md">
        <Link href={`/projects/${project.id}`}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="line-clamp-1">{project.name}</CardTitle>
                <CardDescription className="line-clamp-2 mt-1.5">
                  {project.description || "No description"}
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
            <div className="flex items-center text-sm text-muted-foreground">
              <FolderKanban className="mr-2 h-4 w-4" />
              {project._count.tables} table{project._count.tables !== 1 ? "s" : ""}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Updated {formatDistanceToNow(new Date(project.updatedAt))}
            </p>
          </CardContent>
        </Link>
      </Card>

      <EditProjectDialog
        project={project}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
      />

      <DeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDelete}
        title="Delete Project"
        description={`Are you sure you want to delete "${project.name}"? This will permanently delete the project and all its tables, columns, and data. This action cannot be undone.`}
        itemName={project.name}
        requireConfirmation={true}
        isLoading={isDeleting}
      />
    </>
  );
}
