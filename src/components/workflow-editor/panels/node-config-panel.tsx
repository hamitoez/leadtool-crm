"use client";

import { useEffect, useState } from "react";
import { X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type {
  WorkflowNode,
  WorkflowNodeData,
  TriggerSubType,
  ActionSubType,
} from "@/lib/workflow/types";

interface NodeConfigPanelProps {
  selectedNode: WorkflowNode | null;
  onClose: () => void;
  onUpdate: (nodeId: string, data: Partial<WorkflowNodeData>) => void;
  onDelete: (nodeId: string) => void;
}

export function NodeConfigPanel({
  selectedNode,
  onClose,
  onUpdate,
  onDelete,
}: NodeConfigPanelProps) {
  const [label, setLabel] = useState("");
  const [config, setConfig] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (selectedNode) {
      const data = selectedNode.data as unknown as WorkflowNodeData;
      setLabel(data.label);
      setConfig(data.config || {});
    }
  }, [selectedNode]);

  if (!selectedNode) {
    return null;
  }

  const handleLabelChange = (value: string) => {
    setLabel(value);
    onUpdate(selectedNode.id, { label: value });
  };

  const handleConfigChange = (key: string, value: unknown) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    onUpdate(selectedNode.id, { config: newConfig });
  };

  const nodeData = selectedNode.data as unknown as WorkflowNodeData;
  const nodeType = nodeData.nodeType;
  const subType = nodeData.subType;

  const getNodeTypeLabel = () => {
    switch (nodeType) {
      case "TRIGGER":
        return "Trigger";
      case "ACTION":
        return "Aktion";
      case "CONDITION":
        return "Bedingung";
      case "DELAY":
        return "Verzoegerung";
      default:
        return "Node";
    }
  };

  const getHeaderColor = () => {
    switch (nodeType) {
      case "TRIGGER":
        return "bg-green-500";
      case "ACTION":
        return "bg-blue-500";
      case "CONDITION":
        return "bg-orange-500";
      case "DELAY":
        return "bg-gray-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="w-80 border-l bg-card flex flex-col">
      {/* Header */}
      <div className={cn("px-4 py-3 text-white flex items-center justify-between", getHeaderColor())}>
        <span className="font-medium">{getNodeTypeLabel()} konfigurieren</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-white hover:bg-white/20"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Label */}
        <div className="space-y-2">
          <Label htmlFor="node-label">Bezeichnung</Label>
          <Input
            id="node-label"
            value={label}
            onChange={(e) => handleLabelChange(e.target.value)}
            placeholder="Node-Bezeichnung"
          />
        </div>

        <Separator />

        {/* Type-specific configuration */}
        {nodeType === "TRIGGER" && (
          <TriggerConfig
            subType={subType as TriggerSubType}
            config={config}
            onChange={handleConfigChange}
          />
        )}

        {nodeType === "ACTION" && (
          <ActionConfig
            subType={subType as ActionSubType}
            config={config}
            onChange={handleConfigChange}
          />
        )}

        {nodeType === "CONDITION" && (
          <ConditionConfig config={config} onChange={handleConfigChange} />
        )}

        {nodeType === "DELAY" && (
          <DelayConfig
            subType={subType}
            config={config}
            onChange={handleConfigChange}
          />
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t">
        <Button
          variant="destructive"
          className="w-full"
          onClick={() => onDelete(selectedNode.id)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Node loeschen
        </Button>
      </div>
    </div>
  );
}

// Trigger Configuration
interface TriggerConfigProps {
  subType: TriggerSubType;
  config: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

function TriggerConfig({ subType, config, onChange }: TriggerConfigProps) {
  switch (subType) {
    case "NO_ACTIVITY":
    case "EMAIL_NOT_OPENED":
      return (
        <div className="space-y-2">
          <Label>Tage ohne Aktivitaet</Label>
          <Input
            type="number"
            min={1}
            max={365}
            value={(config.daysOfInactivity as number) || 3}
            onChange={(e) =>
              onChange("daysOfInactivity", parseInt(e.target.value) || 3)
            }
          />
          <p className="text-xs text-muted-foreground">
            Trigger wird ausgeloest nach dieser Anzahl Tagen
          </p>
        </div>
      );

    case "STAGE_CHANGED":
      return (
        <div className="space-y-2">
          <Label>Stage-Filter (optional)</Label>
          <Input
            placeholder="Stage-ID (leer = alle)"
            value={(config.stageId as string) || ""}
            onChange={(e) => onChange("stageId", e.target.value || undefined)}
          />
          <p className="text-xs text-muted-foreground">
            Nur bei Wechsel zu dieser Stage triggern
          </p>
        </div>
      );

    default:
      return (
        <p className="text-sm text-muted-foreground">
          Dieser Trigger hat keine zusaetzlichen Einstellungen.
        </p>
      );
  }
}

// Action Configuration
interface ActionConfigProps {
  subType: ActionSubType;
  config: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

function ActionConfig({ subType, config, onChange }: ActionConfigProps) {
  switch (subType) {
    case "SEND_EMAIL":
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Betreff</Label>
            <Input
              value={(config.subject as string) || ""}
              onChange={(e) => onChange("subject", e.target.value)}
              placeholder="E-Mail Betreff"
            />
          </div>
          <div className="space-y-2">
            <Label>Nachricht</Label>
            <Textarea
              value={(config.body as string) || ""}
              onChange={(e) => onChange("body", e.target.value)}
              placeholder="E-Mail Inhalt..."
              rows={5}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Variablen: {"{{vorname}}"}, {"{{nachname}}"}, {"{{firma}}"}
          </p>
        </div>
      );

    case "CREATE_TASK":
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Aufgaben-Titel</Label>
            <Input
              value={(config.taskTitle as string) || ""}
              onChange={(e) => onChange("taskTitle", e.target.value)}
              placeholder="Aufgaben-Titel"
            />
          </div>
          <div className="space-y-2">
            <Label>Beschreibung</Label>
            <Textarea
              value={(config.taskDescription as string) || ""}
              onChange={(e) => onChange("taskDescription", e.target.value)}
              placeholder="Aufgaben-Beschreibung..."
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Prioritaet</Label>
            <Select
              value={(config.taskPriority as string) || "MEDIUM"}
              onValueChange={(value) => onChange("taskPriority", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">Niedrig</SelectItem>
                <SelectItem value="MEDIUM">Mittel</SelectItem>
                <SelectItem value="HIGH">Hoch</SelectItem>
                <SelectItem value="URGENT">Dringend</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      );

    case "CREATE_REMINDER":
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Erinnerung-Titel</Label>
            <Input
              value={(config.reminderTitle as string) || ""}
              onChange={(e) => onChange("reminderTitle", e.target.value)}
              placeholder="Erinnerung-Titel"
            />
          </div>
          <div className="space-y-2">
            <Label>Minuten bis zur Erinnerung</Label>
            <Input
              type="number"
              min={1}
              value={(config.reminderMinutes as number) || 60}
              onChange={(e) =>
                onChange("reminderMinutes", parseInt(e.target.value) || 60)
              }
            />
          </div>
        </div>
      );

    case "ADD_NOTE":
      return (
        <div className="space-y-2">
          <Label>Notiz-Inhalt</Label>
          <Textarea
            value={(config.noteContent as string) || ""}
            onChange={(e) => onChange("noteContent", e.target.value)}
            placeholder="Notiz-Inhalt..."
            rows={5}
          />
        </div>
      );

    case "NOTIFY_USER":
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Benachrichtigungs-Titel</Label>
            <Input
              value={(config.notificationTitle as string) || ""}
              onChange={(e) => onChange("notificationTitle", e.target.value)}
              placeholder="Titel"
            />
          </div>
          <div className="space-y-2">
            <Label>Nachricht</Label>
            <Textarea
              value={(config.notificationMessage as string) || ""}
              onChange={(e) => onChange("notificationMessage", e.target.value)}
              placeholder="Nachricht..."
              rows={3}
            />
          </div>
        </div>
      );

    case "MOVE_STAGE":
      return (
        <div className="space-y-2">
          <Label>Ziel-Stage ID</Label>
          <Input
            value={(config.stageId as string) || ""}
            onChange={(e) => onChange("stageId", e.target.value)}
            placeholder="Stage-ID"
          />
          <p className="text-xs text-muted-foreground">
            Deal wird in diese Stage verschoben
          </p>
        </div>
      );

    default:
      return (
        <p className="text-sm text-muted-foreground">
          Keine zusaetzlichen Einstellungen verfuegbar.
        </p>
      );
  }
}

// Condition Configuration
interface ConditionConfigProps {
  config: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

function ConditionConfig({ config, onChange }: ConditionConfigProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Feld</Label>
        <Select
          value={(config.field as string) || ""}
          onValueChange={(value) => onChange("field", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Feld auswaehlen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="email">E-Mail</SelectItem>
            <SelectItem value="phone">Telefon</SelectItem>
            <SelectItem value="company">Firma</SelectItem>
            <SelectItem value="dealValue">Deal-Wert</SelectItem>
            <SelectItem value="probability">Wahrscheinlichkeit</SelectItem>
            <SelectItem value="stage">Stage</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Operator</Label>
        <Select
          value={(config.operator as string) || "equals"}
          onValueChange={(value) => onChange("operator", value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="equals">ist gleich</SelectItem>
            <SelectItem value="not_equals">ist nicht gleich</SelectItem>
            <SelectItem value="contains">enthaelt</SelectItem>
            <SelectItem value="greater_than">groesser als</SelectItem>
            <SelectItem value="less_than">kleiner als</SelectItem>
            <SelectItem value="is_empty">ist leer</SelectItem>
            <SelectItem value="is_not_empty">ist nicht leer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!["is_empty", "is_not_empty"].includes(
        (config.operator as string) || ""
      ) && (
        <div className="space-y-2">
          <Label>Wert</Label>
          <Input
            value={(config.value as string) || ""}
            onChange={(e) => onChange("value", e.target.value)}
            placeholder="Vergleichswert"
          />
        </div>
      )}
    </div>
  );
}

// Delay Configuration
interface DelayConfigProps {
  subType: string;
  config: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

function DelayConfig({ subType, config, onChange }: DelayConfigProps) {
  if (subType === "WAIT") {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-2">
            <Label>Tage</Label>
            <Input
              type="number"
              min={0}
              value={(config.delayDays as number) || 0}
              onChange={(e) =>
                onChange("delayDays", parseInt(e.target.value) || 0)
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Stunden</Label>
            <Input
              type="number"
              min={0}
              max={23}
              value={(config.delayHours as number) || 0}
              onChange={(e) =>
                onChange("delayHours", parseInt(e.target.value) || 0)
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Minuten</Label>
            <Input
              type="number"
              min={0}
              max={59}
              value={(config.delayMinutes as number) || 0}
              onChange={(e) =>
                onChange("delayMinutes", parseInt(e.target.value) || 0)
              }
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Workflow wartet diese Zeit bevor er fortfaehrt
        </p>
      </div>
    );
  }

  if (subType === "WAIT_UNTIL") {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Uhrzeit</Label>
          <Input
            type="time"
            value={(config.waitUntilTime as string) || "09:00"}
            onChange={(e) => onChange("waitUntilTime", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Datum (optional)</Label>
          <Input
            type="date"
            value={(config.waitUntilDate as string) || ""}
            onChange={(e) =>
              onChange("waitUntilDate", e.target.value || undefined)
            }
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Ohne Datum: Wartet bis zur naechsten Uhrzeit
        </p>
      </div>
    );
  }

  return null;
}
