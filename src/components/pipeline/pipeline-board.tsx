"use client";

import { useEffect, useState, useCallback } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCorners,
} from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { PipelineStage } from "./pipeline-stage";
import { DealCard } from "./deal-card";
import { DealDetailSheet } from "./deal-detail-sheet";
import { PipelineHeader } from "./pipeline-header";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Cell {
  id: string;
  value: unknown;
  column: {
    id: string;
    name: string;
    type: string;
  };
}

interface Row {
  id: string;
  cells: Cell[];
  activities?: Array<{
    id: string;
    title: string;
    dueDate: string | null;
  }>;
}

interface Deal {
  id: string;
  rowId: string;
  stageId: string;
  value: number | null;
  probability: number;
  expectedClose: string | null;
  position: number;
  row: Row;
  stageChangedAt: string;
}

interface Stage {
  id: string;
  name: string;
  color: string;
  position: number;
  stageType: "OPEN" | "WON" | "LOST";
  autoMoveAfterDays: number | null;
  deals: Deal[];
  _count: { deals: number };
}

interface Pipeline {
  id: string;
  name: string;
  isDefault: boolean;
  stages: Stage[];
}

interface PipelineBoardProps {
  projectId: string;
}

export function PipelineBoard({ projectId }: PipelineBoardProps) {
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [dealSheetOpen, setDealSheetOpen] = useState(false);
  const [stats, setStats] = useState<{
    totalDeals: number;
    totalValue: number;
    weightedValue: number;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const fetchPipeline = useCallback(async () => {
    try {
      // First get or create pipeline
      const pipelinesRes = await fetch(`/api/pipelines?projectId=${projectId}`);
      let pipelines = await pipelinesRes.json();

      if (!pipelines.length) {
        // Create default pipeline
        const createRes = await fetch("/api/pipelines", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            name: "Sales Pipeline",
            isDefault: true,
          }),
        });
        const newPipeline = await createRes.json();
        pipelines = [newPipeline];
      }

      const defaultPipeline = pipelines.find((p: Pipeline) => p.isDefault) || pipelines[0];

      // Fetch full pipeline data
      const res = await fetch(`/api/pipelines/${defaultPipeline.id}`);
      const data = await res.json();

      setPipeline(data.pipeline);
      setStats(data.stats);
    } catch (error) {
      console.error("Error fetching pipeline:", error);
      toast.error("Pipeline konnte nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchPipeline();
  }, [fetchPipeline]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const deal = pipeline?.stages
      .flatMap((s) => s.deals)
      .find((d) => d.id === active.id);
    if (deal) setActiveDeal(deal);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || !pipeline) return;

    const activeStageId = pipeline.stages.find((s) =>
      s.deals.some((d) => d.id === active.id)
    )?.id;

    const overStageId = pipeline.stages.find(
      (s) => s.id === over.id || s.deals.some((d) => d.id === over.id)
    )?.id;

    if (!activeStageId || !overStageId || activeStageId === overStageId) return;

    // Optimistic update - move deal between stages visually
    setPipeline((prev) => {
      if (!prev) return prev;

      const newStages = prev.stages.map((stage) => {
        if (stage.id === activeStageId) {
          return {
            ...stage,
            deals: stage.deals.filter((d) => d.id !== active.id),
          };
        }
        if (stage.id === overStageId) {
          const deal = prev.stages
            .find((s) => s.id === activeStageId)
            ?.deals.find((d) => d.id === active.id);
          if (deal) {
            return {
              ...stage,
              deals: [...stage.deals, { ...deal, stageId: overStageId }],
            };
          }
        }
        return stage;
      });

      return { ...prev, stages: newStages };
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDeal(null);

    if (!over || !pipeline) return;

    const overStageId = pipeline.stages.find(
      (s) => s.id === over.id || s.deals.some((d) => d.id === over.id)
    )?.id;

    if (!overStageId) return;

    try {
      await fetch(`/api/deals/${active.id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId: overStageId }),
      });

      // Refresh to get correct data
      fetchPipeline();
    } catch (error) {
      console.error("Error moving deal:", error);
      toast.error("Deal konnte nicht verschoben werden");
      fetchPipeline(); // Revert on error
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!pipeline) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <p className="text-muted-foreground">Keine Pipeline gefunden</p>
        <Button onClick={fetchPipeline}>
          <Plus className="h-4 w-4 mr-2" />
          Pipeline erstellen
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <PipelineHeader
        pipeline={pipeline}
        projectId={projectId}
        stats={stats}
        onRefresh={fetchPipeline}
      />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-4 p-4 min-h-full">
            <SortableContext
              items={pipeline.stages.map((s) => s.id)}
              strategy={horizontalListSortingStrategy}
            >
              {pipeline.stages
                .sort((a, b) => a.position - b.position)
                .map((stage) => (
                  <PipelineStage
                    key={stage.id}
                    stage={stage}
                    projectId={projectId}
                    pipelineId={pipeline.id}
                    onDealAdded={fetchPipeline}
                    onStageUpdated={fetchPipeline}
                    onDealDeleted={fetchPipeline}
                    onDealClick={(dealId) => {
                      const deal = pipeline.stages
                        .flatMap((s) => s.deals.map((d) => ({ ...d, stage: s })))
                        .find((d) => d.id === dealId);
                      if (deal) {
                        setSelectedDeal(deal);
                        setDealSheetOpen(true);
                      }
                    }}
                  />
                ))}
            </SortableContext>
          </div>
        </div>

        <DragOverlay>
          {activeDeal ? (
            <DealCard deal={activeDeal} isDragging />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Deal Detail Sheet */}
      <DealDetailSheet
        open={dealSheetOpen}
        onOpenChange={setDealSheetOpen}
        deal={selectedDeal}
        onUpdated={fetchPipeline}
      />
    </div>
  );
}
