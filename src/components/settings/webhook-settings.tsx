"use client";

import { useState, useEffect } from "react";
import { useOrganization } from "@/lib/organization-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import {
  Webhook,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  Eye,
  Settings2,
  History,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

const WEBHOOK_EVENTS = [
  { value: "LEAD_CREATED", label: "Lead erstellt", category: "Leads" },
  { value: "LEAD_UPDATED", label: "Lead aktualisiert", category: "Leads" },
  { value: "LEAD_DELETED", label: "Lead gelöscht", category: "Leads" },
  { value: "DEAL_CREATED", label: "Deal erstellt", category: "Deals" },
  { value: "DEAL_UPDATED", label: "Deal aktualisiert", category: "Deals" },
  { value: "DEAL_DELETED", label: "Deal gelöscht", category: "Deals" },
  { value: "DEAL_STAGE_CHANGED", label: "Deal Stage gewechselt", category: "Deals" },
  { value: "DEAL_WON", label: "Deal gewonnen", category: "Deals" },
  { value: "DEAL_LOST", label: "Deal verloren", category: "Deals" },
  { value: "ACTIVITY_CREATED", label: "Aktivität erstellt", category: "Aktivitäten" },
  { value: "ACTIVITY_COMPLETED", label: "Aktivität abgeschlossen", category: "Aktivitäten" },
  { value: "PIPELINE_CREATED", label: "Pipeline erstellt", category: "Pipelines" },
  { value: "STAGE_CREATED", label: "Stage erstellt", category: "Pipelines" },
];

interface WebhookData {
  id: string;
  name: string;
  url: string;
  secret: string | null;
  events: string[];
  headers: Record<string, string>;
  isActive: boolean;
  maxRetries: number;
  retryDelay: number;
  successCount: number;
  failureCount: number;
  lastTriggeredAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  createdAt: string;
  _count?: { logs: number };
}

interface WebhookLog {
  id: string;
  event: string;
  status: string;
  responseStatus: number | null;
  responseTime: number | null;
  error: string | null;
  createdAt: string;
}

export function WebhookSettings() {
  const { currentOrg, isAdmin } = useOrganization();
  const [webhooks, setWebhooks] = useState<WebhookData[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showLogsSheet, setShowLogsSheet] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookData | null>(null);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formSecret, setFormSecret] = useState("");
  const [formEvents, setFormEvents] = useState<string[]>([]);

  const fetchWebhooks = async () => {
    if (!currentOrg?.id) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/webhooks?organizationId=${currentOrg.id}`);
      if (res.ok) {
        const data = await res.json();
        setWebhooks(data);
      }
    } catch (error) {
      console.error("Error fetching webhooks:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentOrg?.id && isAdmin) {
      fetchWebhooks();
    }
  }, [currentOrg?.id, isAdmin]);

  const handleCreate = async () => {
    if (!currentOrg?.id || !formName.trim() || !formUrl.trim() || formEvents.length === 0) {
      toast.error("Bitte alle Pflichtfelder ausfüllen");
      return;
    }

    try {
      setCreating(true);
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: currentOrg.id,
          name: formName.trim(),
          url: formUrl.trim(),
          secret: formSecret.trim() || undefined,
          events: formEvents,
        }),
      });

      if (res.ok) {
        toast.success("Webhook erstellt");
        setShowCreateDialog(false);
        setFormName("");
        setFormUrl("");
        setFormSecret("");
        setFormEvents([]);
        fetchWebhooks();
      } else {
        const error = await res.json();
        toast.error(error.error || "Fehler beim Erstellen");
      }
    } catch {
      toast.error("Fehler beim Erstellen des Webhooks");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (webhookId: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/webhooks/${webhookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });

      if (res.ok) {
        setWebhooks((prev) =>
          prev.map((w) => (w.id === webhookId ? { ...w, isActive } : w))
        );
        toast.success(isActive ? "Webhook aktiviert" : "Webhook deaktiviert");
      }
    } catch {
      toast.error("Fehler beim Aktualisieren");
    }
  };

  const handleDelete = async (webhookId: string) => {
    try {
      const res = await fetch(`/api/webhooks/${webhookId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setWebhooks((prev) => prev.filter((w) => w.id !== webhookId));
        toast.success("Webhook gelöscht");
      }
    } catch {
      toast.error("Fehler beim Löschen");
    }
  };

  const handleTest = async (webhookId: string) => {
    try {
      setTesting(webhookId);
      const res = await fetch(`/api/webhooks/${webhookId}`, {
        method: "POST",
      });

      const result = await res.json();
      if (result.success) {
        toast.success(`Test erfolgreich (${result.responseTime}ms)`);
      } else {
        toast.error(`Test fehlgeschlagen: ${result.error || `Status ${result.responseStatus}`}`);
      }
      fetchWebhooks();
    } catch {
      toast.error("Fehler beim Testen");
    } finally {
      setTesting(null);
    }
  };

  const handleViewLogs = async (webhook: WebhookData) => {
    setSelectedWebhook(webhook);
    setShowLogsSheet(true);
    setLogsLoading(true);

    try {
      const res = await fetch(`/api/webhooks/${webhook.id}/logs?limit=50`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
      }
    } catch {
      toast.error("Fehler beim Laden der Logs");
    } finally {
      setLogsLoading(false);
    }
  };

  const toggleEvent = (event: string) => {
    setFormEvents((prev) =>
      prev.includes(event)
        ? prev.filter((e) => e !== event)
        : [...prev, event]
    );
  };

  const groupedEvents = WEBHOOK_EVENTS.reduce((acc, event) => {
    if (!acc[event.category]) {
      acc[event.category] = [];
    }
    acc[event.category].push(event);
    return acc;
  }, {} as Record<string, typeof WEBHOOK_EVENTS>);

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Webhooks
          </CardTitle>
          <CardDescription>
            Sie benötigen Admin-Rechte, um Webhooks zu verwalten.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="h-5 w-5" />
                Webhooks
              </CardTitle>
              <CardDescription>
                Senden Sie Events an externe URLs (Zapier, Make.com, etc.)
              </CardDescription>
            </div>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Neuer Webhook
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Neuen Webhook erstellen</DialogTitle>
                  <DialogDescription>
                    Konfigurieren Sie einen Webhook, um Events an externe Dienste zu senden.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="webhookName">Name *</Label>
                    <Input
                      id="webhookName"
                      placeholder="z.B. Zapier Integration"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="webhookUrl">URL *</Label>
                    <Input
                      id="webhookUrl"
                      type="url"
                      placeholder="https://hooks.zapier.com/..."
                      value={formUrl}
                      onChange={(e) => setFormUrl(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="webhookSecret">Secret (optional)</Label>
                    <Input
                      id="webhookSecret"
                      type="password"
                      placeholder="Für HMAC-Signatur"
                      value={formSecret}
                      onChange={(e) => setFormSecret(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Wenn gesetzt, wird jeder Request mit einer SHA256-Signatur im Header X-Webhook-Signature signiert.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Events *</Label>
                    <Accordion type="multiple" className="w-full">
                      {Object.entries(groupedEvents).map(([category, events]) => (
                        <AccordionItem key={category} value={category}>
                          <AccordionTrigger className="text-sm">
                            {category}
                            <Badge variant="secondary" className="ml-2">
                              {events.filter((e) => formEvents.includes(e.value)).length}/{events.length}
                            </Badge>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-2 pl-2">
                              {events.map((event) => (
                                <div key={event.value} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={event.value}
                                    checked={formEvents.includes(event.value)}
                                    onCheckedChange={() => toggleEvent(event.value)}
                                  />
                                  <label
                                    htmlFor={event.value}
                                    className="text-sm cursor-pointer"
                                  >
                                    {event.label}
                                  </label>
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateDialog(false)}
                  >
                    Abbrechen
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={creating || !formName.trim() || !formUrl.trim() || formEvents.length === 0}
                  >
                    {creating ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Webhook className="h-4 w-4 mr-2" />
                    )}
                    Erstellen
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : webhooks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Webhook className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Keine Webhooks vorhanden</p>
              <p className="text-sm">
                Erstellen Sie einen Webhook, um Events an externe Dienste zu senden.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Erfolg/Fehler</TableHead>
                  <TableHead>Zuletzt</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.map((webhook) => (
                  <TableRow key={webhook.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{webhook.name}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {webhook.url}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {webhook.events.length} Events
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={webhook.isActive}
                          onCheckedChange={(checked) =>
                            handleToggleActive(webhook.id, checked)
                          }
                        />
                        <Badge variant={webhook.isActive ? "default" : "secondary"}>
                          {webhook.isActive ? "Aktiv" : "Inaktiv"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="h-3 w-3" />
                          {webhook.successCount}
                        </span>
                        <span className="text-muted-foreground">/</span>
                        <span className="flex items-center gap-1 text-red-600">
                          <XCircle className="h-3 w-3" />
                          {webhook.failureCount}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {webhook.lastTriggeredAt ? (
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(webhook.lastTriggeredAt), {
                            addSuffix: true,
                            locale: de,
                          })}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Nie</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleTest(webhook.id)}
                          disabled={testing === webhook.id}
                          title="Testen"
                        >
                          {testing === webhook.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewLogs(webhook)}
                          title="Logs"
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" title="Löschen">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Webhook löschen?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Der Webhook &quot;{webhook.name}&quot; wird unwiderruflich gelöscht.
                                Alle zugehörigen Logs werden ebenfalls gelöscht.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(webhook.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Löschen
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Dokumentation */}
          <div className="mt-6 pt-6 border-t">
            <h4 className="font-medium mb-2">Webhook-Payload Format</h4>
            <div className="text-sm font-mono bg-muted p-4 rounded-lg space-y-1">
              <p>{`{`}</p>
              <p className="pl-4">{`"event": "DEAL_CREATED",`}</p>
              <p className="pl-4">{`"timestamp": "2025-12-22T10:30:00Z",`}</p>
              <p className="pl-4">{`"data": { ... }`}</p>
              <p>{`}`}</p>
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              <strong>Headers:</strong> Content-Type: application/json, X-Webhook-Event, X-Webhook-ID, X-Webhook-Signature (wenn Secret gesetzt)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Logs Sheet */}
      <Sheet open={showLogsSheet} onOpenChange={setShowLogsSheet}>
        <SheetContent className="w-[500px] sm:w-[600px]">
          <SheetHeader>
            <SheetTitle>Webhook Logs</SheetTitle>
            <SheetDescription>
              {selectedWebhook?.name} - Letzte Ausführungen
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {logsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Keine Logs vorhanden</p>
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {log.status === "success" ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : log.status === "retrying" ? (
                        <Loader2 className="h-5 w-5 text-yellow-600 animate-spin" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                      <div>
                        <div className="font-medium text-sm">{log.event}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(log.createdAt), {
                            addSuffix: true,
                            locale: de,
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      {log.responseStatus && (
                        <Badge
                          variant={log.responseStatus >= 200 && log.responseStatus < 300 ? "default" : "destructive"}
                        >
                          {log.responseStatus}
                        </Badge>
                      )}
                      {log.responseTime && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {log.responseTime}ms
                        </div>
                      )}
                      {log.error && (
                        <div className="text-xs text-red-600 mt-1 max-w-[200px] truncate">
                          {log.error}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
