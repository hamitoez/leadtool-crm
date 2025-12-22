"use client";

import { useState } from "react";
import {
  Plus,
  ArrowRight,
  Clock,
  MailOpen,
  MailX,
  MousePointerClick,
  AlertTriangle,
  Calendar,
  CalendarCheck,
  PhoneCall,
  Play,
  Mail,
  CheckSquare,
  Bell,
  MoveRight,
  StickyNote,
  BellRing,
  GitBranch,
  Timer,
  ChevronDown,
  ChevronRight,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  TRIGGER_DEFINITIONS,
  ACTION_DEFINITIONS,
  CONDITION_DEFINITIONS,
  DELAY_DEFINITIONS,
  type NodeDefinition,
} from "@/lib/workflow/types";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// Icon mapping
const iconMap: Record<string, React.ElementType> = {
  Plus,
  ArrowRight,
  Clock,
  MailOpen,
  MailX,
  MousePointerClick,
  AlertTriangle,
  Calendar,
  CalendarCheck,
  PhoneCall,
  Play,
  Mail,
  CheckSquare,
  Bell,
  MoveRight,
  StickyNote,
  BellRing,
  GitBranch,
  Timer,
  Zap,
};

interface NodeItemProps {
  definition: NodeDefinition;
}

function NodeItem({ definition }: NodeItemProps) {
  const Icon = iconMap[definition.icon] || Zap;

  const onDragStart = (event: React.DragEvent) => {
    event.dataTransfer.setData("application/reactflow-type", definition.nodeType);
    event.dataTransfer.setData("application/reactflow-subtype", definition.type);
    event.dataTransfer.effectAllowed = "move";
  };

  const colorClasses: Record<string, string> = {
    green: "border-green-500/50 hover:border-green-500 hover:bg-green-500/10",
    blue: "border-blue-500/50 hover:border-blue-500 hover:bg-blue-500/10",
    orange: "border-orange-500/50 hover:border-orange-500 hover:bg-orange-500/10",
    gray: "border-gray-500/50 hover:border-gray-500 hover:bg-gray-500/10",
  };

  const iconColorClasses: Record<string, string> = {
    green: "bg-green-500/20 text-green-600 dark:text-green-400",
    blue: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
    orange: "bg-orange-500/20 text-orange-600 dark:text-orange-400",
    gray: "bg-gray-500/20 text-gray-600 dark:text-gray-400",
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={cn(
        "flex items-center gap-3 p-2 rounded-lg border-2 cursor-grab active:cursor-grabbing transition-all",
        colorClasses[definition.color] || colorClasses.gray
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-md shrink-0",
          iconColorClasses[definition.color] || iconColorClasses.gray
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{definition.label}</p>
        <p className="text-xs text-muted-foreground truncate">
          {definition.description}
        </p>
      </div>
    </div>
  );
}

interface NodeCategoryProps {
  title: string;
  color: string;
  definitions: NodeDefinition[];
  defaultOpen?: boolean;
}

function NodeCategory({
  title,
  color,
  definitions,
  defaultOpen = true,
}: NodeCategoryProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const headerColorClasses: Record<string, string> = {
    green: "text-green-600 dark:text-green-400",
    blue: "text-blue-600 dark:text-blue-400",
    orange: "text-orange-600 dark:text-orange-400",
    gray: "text-gray-600 dark:text-gray-400",
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full py-2 group">
        <span
          className={cn(
            "text-sm font-semibold",
            headerColorClasses[color] || headerColorClasses.gray
          )}
        >
          {title}
        </span>
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-2 pb-4">
          {definitions.map((def) => (
            <NodeItem key={def.type} definition={def} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function NodePalette() {
  return (
    <div className="w-72 border-r bg-card overflow-y-auto">
      <div className="p-4 border-b">
        <h2 className="font-semibold flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Nodes
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Ziehe Nodes auf die Arbeitsflaeche
        </p>
      </div>

      <div className="p-4 space-y-2">
        <NodeCategory
          title="Trigger"
          color="green"
          definitions={TRIGGER_DEFINITIONS}
        />
        <NodeCategory
          title="Aktionen"
          color="blue"
          definitions={ACTION_DEFINITIONS}
        />
        <NodeCategory
          title="Bedingungen"
          color="orange"
          definitions={CONDITION_DEFINITIONS}
          defaultOpen={false}
        />
        <NodeCategory
          title="Verzoegerung"
          color="gray"
          definitions={DELAY_DEFINITIONS}
          defaultOpen={false}
        />
      </div>
    </div>
  );
}
