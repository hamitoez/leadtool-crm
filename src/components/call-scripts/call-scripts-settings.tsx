"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, Phone, Star } from "lucide-react";
import { CallScriptForm } from "./call-script-form";
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

interface Question {
  question: string;
  hint?: string;
  required?: boolean;
}

interface Objection {
  objection: string;
  response: string;
}

interface CallScript {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  introduction?: string | null;
  questions: Question[];
  objections: Objection[];
  closingNotes?: string | null;
  isDefault: boolean;
  isActive: boolean;
  usageCount: number;
  lastUsedAt?: string | null;
}

export function CallScriptsSettings() {
  const [scripts, setScripts] = useState<CallScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingScript, setEditingScript] = useState<CallScript | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchScripts = useCallback(async () => {
    try {
      const res = await fetch("/api/call-scripts");
      if (res.ok) {
        const data = await res.json();
        setScripts(data.scripts);
      }
    } catch (error) {
      console.error("Error fetching scripts:", error);
      toast.error("Fehler beim Laden der Scripts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScripts();
  }, [fetchScripts]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/call-scripts/${deleteId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Script geloescht");
        fetchScripts();
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

  const handleEdit = (script: CallScript) => {
    setEditingScript(script);
    setFormOpen(true);
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setEditingScript(null);
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
          <h3 className="text-lg font-medium">Anruf-Scripts</h3>
          <p className="text-sm text-muted-foreground">
            Erstellen Sie Leitfaeden fuer Ihre Telefonate
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Neues Script
        </Button>
      </div>

      {scripts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Phone className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              Noch keine Anruf-Scripts vorhanden
            </p>
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Erstes Script erstellen
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {scripts.map((script) => (
            <Card key={script.id} className={!script.isActive ? "opacity-60" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">{script.name}</CardTitle>
                    {script.isDefault && (
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                    )}
                    {script.category && (
                      <Badge variant="outline">{script.category}</Badge>
                    )}
                    {!script.isActive && (
                      <Badge variant="secondary">Inaktiv</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(script)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(script.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                {script.description && (
                  <CardDescription>{script.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>
                    {(script.questions as Question[])?.length || 0} Fragen
                  </span>
                  <span>
                    {(script.objections as Objection[])?.length || 0} Einwaende
                  </span>
                  <span>{script.usageCount}x verwendet</span>
                  {script.lastUsedAt && (
                    <span>
                      Zuletzt: {new Date(script.lastUsedAt).toLocaleDateString("de-DE")}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CallScriptForm
        open={formOpen}
        onOpenChange={handleFormClose}
        script={editingScript}
        onSuccess={() => {
          handleFormClose();
          fetchScripts();
        }}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Script loeschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dieses Script wird unwiderruflich geloescht.
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
