"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, FileText } from "lucide-react";
import { NoteTemplateForm } from "./note-template-form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface NoteTemplate {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  content: string;
  variables: string[];
  isActive: boolean;
  usageCount: number;
  lastUsedAt?: string | null;
}

export function NoteTemplatesSettings() {
  const [templates, setTemplates] = useState<NoteTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NoteTemplate | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/note-templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates);
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
      toast.error("Fehler beim Laden der Vorlagen");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/note-templates/${deleteId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Vorlage geloescht");
        fetchTemplates();
      } else {
        throw new Error("Delete failed");
      }
    } catch {
      toast.error("Fehler beim Loeschen");
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const handleEdit = (template: NoteTemplate) => {
    setEditingTemplate(template);
    setFormOpen(true);
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setEditingTemplate(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Notiz-Vorlagen</h3>
          <p className="text-sm text-muted-foreground">
            Erstellen Sie wiederverwendbare Notiz-Vorlagen
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Neue Vorlage
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              Noch keine Notiz-Vorlagen vorhanden
            </p>
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Erste Vorlage erstellen
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {templates.map((template) => (
            <Card key={template.id} className={!template.isActive ? "opacity-60" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    {template.category && (
                      <Badge variant="outline">{template.category}</Badge>
                    )}
                    {!template.isActive && (
                      <Badge variant="secondary">Inaktiv</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(template)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(template.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                {template.description && (
                  <CardDescription>{template.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-sm bg-muted p-2 rounded-md line-clamp-2 font-mono">
                    {template.content}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>
                      {(template.variables as string[])?.length || 0} Variablen
                    </span>
                    <span>{template.usageCount}x verwendet</span>
                    {template.lastUsedAt && (
                      <span>
                        Zuletzt: {new Date(template.lastUsedAt).toLocaleDateString("de-DE")}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <NoteTemplateForm
        open={formOpen}
        onOpenChange={handleFormClose}
        template={editingTemplate}
        onSuccess={() => {
          handleFormClose();
          fetchTemplates();
        }}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vorlage loeschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Vorlage wird unwiderruflich geloescht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Loeschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
