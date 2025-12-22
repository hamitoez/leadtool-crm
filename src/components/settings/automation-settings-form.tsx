"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Zap,
  Plus,
  Pencil,
  Trash2,
  Play,
  Pause,
  Loader2,
  MoreHorizontal,
  Mail,
  CheckSquare,
  Bell,
  ArrowRight,
  FileText,
  User,
  Clock,
  History,
} from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

interface FollowUpRule {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  trigger: string;
  triggerConfig: Record<string, unknown>;
  action: string;
  actionConfig: Record<string, unknown>;
  delayMinutes: number;
  executionCount: number;
  lastExecutedAt: string | null;
  createdAt: string;
}

const triggerLabels: Record<string, { label: string; description: string }> = {
  DEAL_CREATED: { label: "Neuer Deal", description: "Wenn ein neuer Deal erstellt wird" },
  STAGE_CHANGED: { label: "Stage geaendert", description: "Wenn ein Deal die Stage wechselt" },
  NO_ACTIVITY: { label: "Keine Aktivitaet", description: "Wenn X Tage keine Aktivitaet war" },
  EMAIL_OPENED: { label: "E-Mail geoeffnet", description: "Wenn eine E-Mail geoeffnet wird" },
  EMAIL_NOT_OPENED: { label: "E-Mail nicht geoeffnet", description: "Wenn eine E-Mail nicht geoeffnet wird" },
  EMAIL_CLICKED: { label: "Link geklickt", description: "Wenn ein Link in einer E-Mail geklickt wird" },
  TASK_OVERDUE: { label: "Aufgabe ueberfaellig", description: "Wenn eine Aufgabe ueberfaellig ist" },
  MEETING_SCHEDULED: { label: "Meeting geplant", description: "Wenn ein Meeting geplant wird" },
  MEETING_COMPLETED: { label: "Meeting abgeschlossen", description: "Wenn ein Meeting abgeschlossen wird" },
  CALL_COMPLETED: { label: "Anruf abgeschlossen", description: "Wenn ein Anruf beendet wird" },
  MANUAL: { label: "Manuell", description: "Manuell ausgeloest" },
};

const actionLabels: Record<string, { label: string; icon: typeof Mail }> = {
  SEND_EMAIL: { label: "E-Mail senden", icon: Mail },
  CREATE_TASK: { label: "Aufgabe erstellen", icon: CheckSquare },
  CREATE_REMINDER: { label: "Erinnerung erstellen", icon: Bell },
  MOVE_STAGE: { label: "Stage aendern", icon: ArrowRight },
  ADD_NOTE: { label: "Notiz hinzufuegen", icon: FileText },
  NOTIFY_USER: { label: "Benutzer benachrichtigen", icon: User },
};

export function AutomationSettingsForm() {
  const [rules, setRules] = useState<FollowUpRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteRuleId, setDeleteRuleId] = useState<string | null>(null);

  // Create/Edit Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<FollowUpRule | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [trigger, setTrigger] = useState("NO_ACTIVITY");
  const [action, setAction] = useState("CREATE_REMINDER");
  const [delayMinutes, setDelayMinutes] = useState(0);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/automation/rules");
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules || []);
      }
    } catch (error) {
      console.error("Error loading rules:", error);
      toast.error("Fehler beim Laden der Automatisierungen");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (rule?: FollowUpRule) => {
    if (rule) {
      setSelectedRule(rule);
      setName(rule.name);
      setDescription(rule.description || "");
      setTrigger(rule.trigger);
      setAction(rule.action);
      setDelayMinutes(rule.delayMinutes);
    } else {
      setSelectedRule(null);
      setName("");
      setDescription("");
      setTrigger("NO_ACTIVITY");
      setAction("CREATE_REMINDER");
      setDelayMinutes(0);
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Bitte geben Sie einen Namen ein");
      return;
    }

    setSaving(true);

    try {
      const url = selectedRule
        ? `/api/automation/rules/${selectedRule.id}`
        : "/api/automation/rules";
      const method = selectedRule ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          trigger,
          action,
          delayMinutes,
          triggerConfig: trigger === "NO_ACTIVITY" ? { daysOfInactivity: 3 } : {},
          actionConfig: {},
        }),
      });

      if (!res.ok) throw new Error("Fehler beim Speichern");

      toast.success(selectedRule ? "Regel aktualisiert" : "Regel erstellt");
      setDialogOpen(false);
      loadRules();
    } catch (error) {
      toast.error("Fehler beim Speichern der Regel");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (rule: FollowUpRule) => {
    try {
      const res = await fetch(`/api/automation/rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !rule.isActive }),
      });

      if (!res.ok) throw new Error("Fehler beim Aktualisieren");

      toast.success(rule.isActive ? "Regel deaktiviert" : "Regel aktiviert");
      loadRules();
    } catch (error) {
      toast.error("Fehler beim Aktualisieren der Regel");
    }
  };

  const handleDelete = async () => {
    if (!deleteRuleId) return;

    try {
      const res = await fetch(`/api/automation/rules/${deleteRuleId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Fehler beim Loeschen");

      toast.success("Regel geloescht");
      setDeleteRuleId(null);
      loadRules();
    } catch (error) {
      toast.error("Fehler beim Loeschen der Regel");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Automatisierungen
            </CardTitle>
            <CardDescription>
              Automatische Aktionen basierend auf Triggern
            </CardDescription>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Regel erstellen
          </Button>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Noch keine Automatisierungen erstellt</p>
              <p className="text-sm">
                Erstellen Sie Regeln, um wiederkehrende Aufgaben zu automatisieren
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => {
                const ActionIcon = actionLabels[rule.action]?.icon || Zap;

                return (
                  <div
                    key={rule.id}
                    className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${
                      rule.isActive ? "" : "opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          rule.isActive
                            ? "bg-green-100 dark:bg-green-900/30"
                            : "bg-gray-100 dark:bg-gray-800"
                        }`}
                      >
                        <ActionIcon
                          className={`h-5 w-5 ${
                            rule.isActive ? "text-green-600" : "text-gray-500"
                          }`}
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{rule.name}</span>
                          <Badge variant={rule.isActive ? "default" : "secondary"}>
                            {rule.isActive ? "Aktiv" : "Inaktiv"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {triggerLabels[rule.trigger]?.label || rule.trigger} →{" "}
                          {actionLabels[rule.action]?.label || rule.action}
                          {rule.delayMinutes > 0 && (
                            <span className="ml-1">
                              (nach {rule.delayMinutes} Min)
                            </span>
                          )}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <History className="h-3 w-3" />
                            {rule.executionCount}x ausgefuehrt
                          </span>
                          {rule.lastExecutedAt && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Zuletzt{" "}
                              {formatDistanceToNow(new Date(rule.lastExecutedAt), {
                                addSuffix: true,
                                locale: de,
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={rule.isActive}
                        onCheckedChange={() => handleToggleActive(rule)}
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenDialog(rule)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Bearbeiten
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeleteRuleId(rule.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Loeschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              {selectedRule ? "Regel bearbeiten" : "Neue Automatisierung"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="z.B. Follow-up nach 3 Tagen"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Beschreibung</Label>
              <Textarea
                id="description"
                placeholder="Beschreibung der Regel..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Trigger (Wenn...)</Label>
              <Select value={trigger} onValueChange={setTrigger}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(triggerLabels).map(([key, { label, description }]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex flex-col">
                        <span>{label}</span>
                        <span className="text-xs text-muted-foreground">{description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Aktion (Dann...)</Label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(actionLabels).map(([key, { label, icon: Icon }]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span>{label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="delay">Verzoegerung (Minuten)</Label>
              <Input
                id="delay"
                type="number"
                min={0}
                value={delayMinutes}
                onChange={(e) => setDelayMinutes(parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">
                Warten Sie diese Anzahl Minuten, bevor die Aktion ausgefuehrt wird
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird gespeichert...
                </>
              ) : selectedRule ? (
                "Speichern"
              ) : (
                "Erstellen"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteRuleId} onOpenChange={() => setDeleteRuleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regel loeschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Automatisierung wird unwiderruflich geloescht.
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
