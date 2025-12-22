"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type NodeTypes,
  type EdgeTypes,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { TriggerNode } from "./nodes/trigger-node";
import { ActionNode } from "./nodes/action-node";
import { ConditionNode } from "./nodes/condition-node";
import { DelayNode } from "./nodes/delay-node";
import { NodePalette } from "./panels/node-palette";
import { NodeConfigPanel } from "./panels/node-config-panel";
import { WorkflowToolbar } from "./workflow-toolbar";
import {
  type WorkflowDTO,
  type WorkflowNode,
  type WorkflowEdge,
  type WorkflowNodeData,
  convertToReactFlowNodes,
  convertToReactFlowEdges,
  getNodeDefinition,
} from "@/lib/workflow/types";
import { cn } from "@/lib/utils";

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
  delay: DelayNode,
};

const edgeTypes: EdgeTypes = {};

interface WorkflowEditorProps {
  workflow: WorkflowDTO;
  onSave: (nodes: WorkflowNode[], edges: WorkflowEdge[], viewport: { x: number; y: number; zoom: number }) => Promise<void>;
  onActivate: (isActive: boolean) => Promise<void>;
}

function WorkflowEditorInner({ workflow, onSave, onActivate }: WorkflowEditorProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, getViewport } = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNode>(
    convertToReactFlowNodes(workflow.nodes)
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<WorkflowEdge>(
    convertToReactFlowEdges(workflow.edges)
  );

  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Track changes
  useEffect(() => {
    setHasUnsavedChanges(true);
  }, [nodes, edges]);

  // Handle connection between nodes
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            type: "smoothstep",
            animated: true,
          },
          eds
        )
      );
    },
    [setEdges]
  );

  // Handle node selection
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: WorkflowNode) => {
      setSelectedNode(node);
    },
    []
  );

  // Handle click on pane (deselect)
  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Handle drag from palette
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData("application/reactflow-type");
      const subType = event.dataTransfer.getData("application/reactflow-subtype");

      if (!type || !subType) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const definition = getNodeDefinition(subType);
      if (!definition) return;

      const newNode: WorkflowNode = {
        id: `${type}-${Date.now()}`,
        type: type.toLowerCase(),
        position,
        data: {
          label: definition.label,
          nodeType: type as WorkflowNodeData["nodeType"],
          subType: subType,
          config: { ...definition.defaultConfig },
        } as unknown as Record<string, unknown>,
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [screenToFlowPosition, setNodes]
  );

  // Update node data
  const onNodeDataChange = useCallback(
    (nodeId: string, data: Partial<WorkflowNodeData>) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: { ...node.data, ...data } as unknown as Record<string, unknown>,
            };
          }
          return node;
        })
      );
      // Update selected node if it's the one being edited
      if (selectedNode?.id === nodeId) {
        setSelectedNode((prev) =>
          prev ? { ...prev, data: { ...prev.data, ...data } as unknown as Record<string, unknown> } : null
        );
      }
    },
    [setNodes, selectedNode]
  );

  // Save workflow
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const viewport = getViewport();
      await onSave(nodes, edges, viewport);
      setHasUnsavedChanges(false);
    } finally {
      setIsSaving(false);
    }
  }, [nodes, edges, getViewport, onSave]);

  // Validate connection
  const isValidConnection = useCallback(
    (connection: Connection | WorkflowEdge) => {
      // Don't allow self-connections
      if (connection.source === connection.target) return false;

      // Find source and target nodes
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);

      if (!sourceNode || !targetNode) return false;

      // Triggers can only be source, not target
      if (targetNode.data.nodeType === "TRIGGER") return false;

      // Check for existing connection from same source handle
      const existingEdge = edges.find(
        (e) =>
          e.source === connection.source &&
          e.sourceHandle === connection.sourceHandle
      );

      // Allow multiple outputs from condition nodes
      if (sourceNode.data.nodeType === "CONDITION") {
        return true;
      }

      // Other nodes can only have one output
      if (existingEdge) return false;

      return true;
    },
    [nodes, edges]
  );

  return (
    <div className="flex h-full w-full">
      {/* Node Palette */}
      <NodePalette />

      {/* Main Canvas */}
      <div className="flex-1 flex flex-col">
        <WorkflowToolbar
          workflowId={workflow.id}
          workflowName={workflow.name}
          isActive={workflow.isActive}
          isSaving={isSaving}
          hasUnsavedChanges={hasUnsavedChanges}
          onSave={handleSave}
          onActivate={onActivate}
        />

        <div ref={reactFlowWrapper} className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            isValidConnection={isValidConnection}
            defaultViewport={workflow.viewport}
            fitView
            snapToGrid
            snapGrid={[15, 15]}
            className={cn(
              "bg-background",
              "[&_.react-flow__node]:!cursor-pointer",
              "[&_.react-flow__edge-path]:!stroke-muted-foreground",
              "[&_.react-flow__edge.selected_.react-flow__edge-path]:!stroke-primary"
            )}
          >
            <Background gap={20} size={1} color="hsl(var(--muted-foreground) / 0.1)" />
            <Controls className="!bg-card !border-border !shadow-md [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-foreground [&>button:hover]:!bg-accent" />
            <MiniMap
              className="!bg-card !border-border"
              nodeColor={(node) => {
                switch (node.data?.nodeType) {
                  case "TRIGGER":
                    return "hsl(142, 71%, 45%)";
                  case "ACTION":
                    return "hsl(217, 91%, 60%)";
                  case "CONDITION":
                    return "hsl(25, 95%, 53%)";
                  case "DELAY":
                    return "hsl(215, 14%, 50%)";
                  default:
                    return "hsl(var(--muted-foreground))";
                }
              }}
            />
          </ReactFlow>
        </div>
      </div>

      {/* Config Panel */}
      <NodeConfigPanel
        selectedNode={selectedNode}
        onClose={() => setSelectedNode(null)}
        onUpdate={onNodeDataChange}
        onDelete={(nodeId) => {
          setNodes((nds) => nds.filter((n) => n.id !== nodeId));
          setEdges((eds) =>
            eds.filter((e) => e.source !== nodeId && e.target !== nodeId)
          );
          setSelectedNode(null);
        }}
      />
    </div>
  );
}

export function WorkflowEditor(props: WorkflowEditorProps) {
  return (
    <ReactFlowProvider>
      <WorkflowEditorInner {...props} />
    </ReactFlowProvider>
  );
}
