"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { toast } from "sonner";
import {
  Plus,
  Zap,
  Play,
  Pause,
  MoreHorizontal,
  Pencil,
  Trash2,
  Copy,
  Loader2,
  GitBranch,
  Sparkles,
  Info,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getNodeDefinition } from "@/lib/workflow/types";

interface WorkflowNode {
  id: string;
  nodeType: string;
  subType: string;
  label: string | null;
}

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  executionCount: number;
  lastExecutedAt: string | null;
  nodes: WorkflowNode[];
  createdAt: string;
  updatedAt: string;
}

export default function WorkflowsPage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteWorkflowId, setDeleteWorkflowId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Form states
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const [creatingDemo, setCreatingDemo] = useState(false);

  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    try {
      const res = await fetch("/api/workflows");
      if (res.ok) {
        const data = await res.json();
        const workflowList = data.workflows || [];
        setWorkflows(workflowList);

        // If no workflows exist, automatically create the demo workflow
        if (workflowList.length === 0) {
          await createDemoWorkflow();
        }
      }
    } catch (error) {
      console.error("Error loading workflows:", error);
      toast.error("Fehler beim Laden der Workflows");
    } finally {
      setLoading(false);
    }
  };

  const createDemoWorkflow = async () => {
    setCreatingDemo(true);
    try {
      const res = await fetch("/api/workflows/template", {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        toast.success("Demo-Workflow erstellt! Klicken Sie darauf, um ihn zu testen.");
        // Reload to show the new workflow
        const reloadRes = await fetch("/api/workflows");
        if (reloadRes.ok) {
          const reloadData = await reloadRes.json();
          setWorkflows(reloadData.workflows || []);
        }
      }
    } catch (error) {
      console.error("Error creating demo workflow:", error);
    } finally {
      setCreatingDemo(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast.error("Bitte geben Sie einen Namen ein");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error("Fehler beim Erstellen");
      }

      const data = await res.json();
      toast.success("Workflow erstellt");
      setCreateDialogOpen(false);
      setNewName("");
      setNewDescription("");

      // Navigate to editor
      router.push(`/workflows/${data.workflow.id}`);
    } catch (error) {
      console.error("Error creating workflow:", error);
      toast.error("Fehler beim Erstellen des Workflows");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteWorkflowId) return;

    try {
      const res = await fetch(`/api/workflows/${deleteWorkflowId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Fehler beim Loeschen");
      }

      toast.success("Workflow geloescht");
      setDeleteWorkflowId(null);
      loadWorkflows();
    } catch (error) {
      console.error("Error deleting workflow:", error);
      toast.error("Fehler beim Loeschen des Workflows");
    }
  };

  const handleToggleActive = async (workflow: Workflow) => {
    try {
      const res = await fetch(`/api/workflows/${workflow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !workflow.isActive }),
      });

      if (!res.ok) {
        throw new Error("Fehler");
      }

      toast.success(
        workflow.isActive ? "Workflow deaktiviert" : "Workflow aktiviert"
      );
      loadWorkflows();
    } catch (error) {
      console.error("Error toggling workflow:", error);
      toast.error("Fehler beim Aendern des Status");
    }
  };

  const handleDuplicate = async (workflow: Workflow) => {
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${workflow.name} (Kopie)`,
          description: workflow.description,
        }),
      });

      if (!res.ok) {
        throw new Error("Fehler beim Duplizieren");
      }

      toast.success("Workflow dupliziert");
      loadWorkflows();
    } catch (error) {
      console.error("Error duplicating workflow:", error);
      toast.error("Fehler beim Duplizieren");
    }
  };

  // Get workflow summary
  const getWorkflowSummary = (nodes: WorkflowNode[]) => {
    const triggers = nodes.filter((n) => n.nodeType === "TRIGGER");
    const actions = nodes.filter((n) => n.nodeType === "ACTION");
    const conditions = nodes.filter((n) => n.nodeType === "CONDITION");

    const parts: string[] = [];
    if (triggers.length > 0) {
      const triggerDef = getNodeDefinition(triggers[0].subType);
      parts.push(triggerDef?.label || triggers[0].subType);
    }
    if (conditions.length > 0) {
      parts.push(`${conditions.length} Bedingung${conditions.length > 1 ? "en" : ""}`);
    }
    if (actions.length > 0) {
      parts.push(`${actions.length} Aktion${actions.length > 1 ? "en" : ""}`);
    }

    return parts.join(" -> ") || "Leer";
  };

  if (loading || creatingDemo) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        {creatingDemo && (
          <p className="text-muted-foreground">Demo-Workflow wird erstellt...</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Zap className="h-8 w-8" />
            Workflows
          </h1>
          <p className="text-muted-foreground">
            Automatisieren Sie Ihre Prozesse mit visuellen Workflows
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Neuer Workflow
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Gesamt</CardDescription>
            <CardTitle className="text-3xl">{workflows.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Aktiv</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {workflows.filter((w) => w.isActive).length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Ausfuehrungen</CardDescription>
            <CardTitle className="text-3xl">
              {workflows.reduce((sum, w) => sum + w.executionCount, 0)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Demo Workflow Info Banner */}
      {workflows.some((w) => w.name.includes("Demo:")) && (
        <Alert className="border-emerald-500/50 bg-emerald-500/5">
          <Sparkles className="h-4 w-4 text-emerald-500" />
          <AlertTitle className="text-emerald-700 dark:text-emerald-400">
            Demo-Workflow verfügbar!
          </AlertTitle>
          <AlertDescription className="text-emerald-600/80 dark:text-emerald-300/80">
            Klicken Sie auf den Demo-Workflow und dann auf den &quot;Ausführen&quot;-Button
            in der Toolbar, um zu sehen wie Workflows funktionieren. Der Workflow
            sendet Ihnen eine Benachrichtigung und erstellt eine Erinnerung.
          </AlertDescription>
        </Alert>
      )}

      {/* Workflows List */}
      <Card>
        <CardHeader>
          <CardTitle>Ihre Workflows</CardTitle>
          <CardDescription>
            Klicken Sie auf einen Workflow, um ihn im visuellen Editor zu bearbeiten
          </CardDescription>
        </CardHeader>
        <CardContent>
          {workflows.length === 0 ? (
            <div className="text-center py-12">
              <GitBranch className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">
                Noch keine Workflows
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Erstellen Sie Ihren ersten visuellen Workflow
              </p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Workflow erstellen
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {workflows.map((workflow) => (
                <div
                  key={workflow.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                  onClick={() => router.push(`/workflows/${workflow.id}`)}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        workflow.name.includes("Demo:")
                          ? "bg-emerald-500/10 text-emerald-600"
                          : workflow.isActive
                          ? "bg-green-500/10 text-green-600"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {workflow.name.includes("Demo:") ? (
                        <Sparkles className="h-5 w-5" />
                      ) : (
                        <Zap className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{workflow.name}</span>
                        {workflow.name.includes("Demo:") && (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs">
                            Demo
                          </Badge>
                        )}
                        <Badge
                          variant={workflow.isActive ? "default" : "outline"}
                          className={
                            workflow.isActive ? "bg-green-600" : ""
                          }
                        >
                          {workflow.isActive ? (
                            <>
                              <Play className="h-3 w-3 mr-1" />
                              Aktiv
                            </>
                          ) : (
                            <>
                              <Pause className="h-3 w-3 mr-1" />
                              Inaktiv
                            </>
                          )}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          {getWorkflowSummary(workflow.nodes)}
                        </span>
                        <span>|</span>
                        <span>{workflow.nodes.length} Nodes</span>
                        <span>|</span>
                        <span>{workflow.executionCount}x ausgefuehrt</span>
                      </div>
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            router.push(`/workflows/${workflow.id}`)
                          }
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Bearbeiten
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleToggleActive(workflow)}
                        >
                          {workflow.isActive ? (
                            <>
                              <Pause className="mr-2 h-4 w-4" />
                              Deaktivieren
                            </>
                          ) : (
                            <>
                              <Play className="mr-2 h-4 w-4" />
                              Aktivieren
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDuplicate(workflow)}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Duplizieren
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeleteWorkflowId(workflow.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Loeschen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Neuer Workflow
            </DialogTitle>
            <DialogDescription>
              Erstellen Sie einen neuen visuellen Workflow
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="z.B. Follow-up nach Meeting"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Beschreibung</Label>
              <Textarea
                id="description"
                placeholder="Was macht dieser Workflow?"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
            >
              Abbrechen
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird erstellt...
                </>
              ) : (
                "Workflow erstellen"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteWorkflowId}
        onOpenChange={() => setDeleteWorkflowId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Workflow loeschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Der Workflow wird unwiderruflich geloescht. Diese Aktion kann nicht
              rueckgaengig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Loeschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
