"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import type {
  WorkflowDTO,
  WorkflowNode,
  WorkflowEdge,
} from "@/lib/workflow/types";

// Dynamic import for WorkflowEditor - ReactFlow is a heavy library
// that should only be loaded when the workflow editor page is accessed
const WorkflowEditor = dynamic(
  () => import("@/components/workflow-editor/workflow-editor").then(mod => ({ default: mod.WorkflowEditor })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
          <p className="mt-2 text-muted-foreground">Editor wird geladen...</p>
        </div>
      </div>
    ),
  }
);

export default function WorkflowEditorPage() {
  const params = useParams();
  const router = useRouter();
  const workflowId = params.workflowId as string;

  const [workflow, setWorkflow] = useState<WorkflowDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load workflow
  useEffect(() => {
    async function loadWorkflow() {
      try {
        const res = await fetch(`/api/workflows/${workflowId}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError("Workflow nicht gefunden");
          } else {
            throw new Error("Fehler beim Laden");
          }
          return;
        }
        const data = await res.json();
        setWorkflow(data.workflow);
      } catch (err) {
        console.error("Error loading workflow:", err);
        setError("Fehler beim Laden des Workflows");
      } finally {
        setLoading(false);
      }
    }

    loadWorkflow();
  }, [workflowId]);

  // Save workflow
  const handleSave = useCallback(
    async (
      nodes: WorkflowNode[],
      edges: WorkflowEdge[],
      viewport: { x: number; y: number; zoom: number }
    ) => {
      try {
        // Convert ReactFlow format to API format
        const apiNodes = nodes.map((node) => ({
          id: node.id,
          nodeType: node.data.nodeType,
          subType: node.data.subType,
          label: node.data.label,
          positionX: node.position.x,
          positionY: node.position.y,
          config: node.data.config,
        }));

        const apiEdges = edges.map((edge) => ({
          id: edge.id,
          sourceNodeId: edge.source,
          targetNodeId: edge.target,
          sourceHandle: edge.sourceHandle || null,
          targetHandle: edge.targetHandle || null,
          label: typeof edge.label === "string" ? edge.label : null,
        }));

        const res = await fetch(`/api/workflows/${workflowId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            viewport,
            nodes: apiNodes,
            edges: apiEdges,
          }),
        });

        if (!res.ok) {
          throw new Error("Fehler beim Speichern");
        }

        const data = await res.json();
        setWorkflow(data.workflow);
        toast.success("Workflow gespeichert");
      } catch (err) {
        console.error("Error saving workflow:", err);
        toast.error("Fehler beim Speichern des Workflows");
        throw err;
      }
    },
    [workflowId]
  );

  // Toggle active state
  const handleActivate = useCallback(
    async (isActive: boolean) => {
      try {
        const res = await fetch(`/api/workflows/${workflowId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive }),
        });

        if (!res.ok) {
          throw new Error("Fehler beim Aktivieren");
        }

        const data = await res.json();
        setWorkflow(data.workflow);
        toast.success(isActive ? "Workflow aktiviert" : "Workflow deaktiviert");
      } catch (err) {
        console.error("Error toggling workflow:", err);
        toast.error("Fehler beim Aendern des Status");
      }
    },
    [workflowId]
  );

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
          <p className="mt-2 text-muted-foreground">Workflow wird geladen...</p>
        </div>
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium text-destructive">
            {error || "Workflow nicht gefunden"}
          </p>
          <button
            onClick={() => router.push("/workflows")}
            className="mt-4 text-primary hover:underline"
          >
            Zurueck zur Uebersicht
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] -m-6">
      <WorkflowEditor
        workflow={workflow}
        onSave={handleSave}
        onActivate={handleActivate}
      />
    </div>
  );
}
