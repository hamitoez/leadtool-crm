"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { EditProjectDialog } from "./edit-project-dialog";

interface EditProjectButtonProps {
  project: {
    id: string;
    name: string;
    description: string | null;
  };
}

export function EditProjectButton({ project }: EditProjectButtonProps) {
  const [showEditDialog, setShowEditDialog] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setShowEditDialog(true)}>
        <Pencil className="mr-2 h-4 w-4" />
        Edit Project
      </Button>

      <EditProjectDialog
        project={project}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
      />
    </>
  );
}
