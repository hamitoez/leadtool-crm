"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Phone,
  Mail,
  Calendar,
  FileText,
  CheckSquare,
  Plus,
} from "lucide-react";
import { CreateActivityDialog } from "./create-activity-dialog";

interface QuickActivityButtonsProps {
  rowId: string;
  onActivityCreated?: () => void;
}

export function QuickActivityButtons({
  rowId,
  onActivityCreated,
}: QuickActivityButtonsProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("NOTE");

  const handleQuickAdd = (type: string) => {
    setSelectedType(type);
    setDialogOpen(true);
  };

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleQuickAdd("CALL")}
        >
          <Phone className="h-4 w-4 mr-1" />
          Anruf
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleQuickAdd("EMAIL")}
        >
          <Mail className="h-4 w-4 mr-1" />
          E-Mail
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleQuickAdd("MEETING")}
        >
          <Calendar className="h-4 w-4 mr-1" />
          Meeting
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleQuickAdd("TASK")}
        >
          <CheckSquare className="h-4 w-4 mr-1" />
          Aufgabe
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleQuickAdd("NOTE")}
        >
          <FileText className="h-4 w-4 mr-1" />
          Notiz
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <CreateActivityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        rowId={rowId}
        defaultType={selectedType}
        onSuccess={() => {
          setDialogOpen(false);
          onActivityCreated?.();
        }}
      />
    </>
  );
}
