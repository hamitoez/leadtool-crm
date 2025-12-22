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
import { toast } from "sonner";
import {
  Key,
  Plus,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  rateLimit: number;
  isActive: boolean;
  expiresAt: string | null;
  lastUsedAt: string | null;
  requestCount: number;
  createdAt: string;
}

interface NewApiKeyResponse extends ApiKey {
  key: string;
  message: string;
}

export function ApiKeysSettings() {
  const { currentOrg, isAdmin } = useOrganization();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [showNewKeyDialog, setShowNewKeyDialog] = useState(false);
  const [newKeyData, setNewKeyData] = useState<NewApiKeyResponse | null>(null);
  const [showKey, setShowKey] = useState(false);

  const fetchApiKeys = async () => {
    if (!currentOrg?.id) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/api-keys?organizationId=${currentOrg.id}`);
      if (res.ok) {
        const data = await res.json();
        setApiKeys(data);
      }
    } catch (error) {
      console.error("Error fetching API keys:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentOrg?.id && isAdmin) {
      fetchApiKeys();
    }
  }, [currentOrg?.id, isAdmin]);

  const handleCreateKey = async () => {
    if (!currentOrg?.id || !newKeyName.trim()) return;

    try {
      setCreating(true);
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: currentOrg.id,
          name: newKeyName.trim(),
        }),
      });

      if (res.ok) {
        const data: NewApiKeyResponse = await res.json();
        setNewKeyData(data);
        setNewKeyName("");
        fetchApiKeys();
        toast.success("API-Key erstellt");
      } else {
        const error = await res.json();
        toast.error(error.error || "Fehler beim Erstellen");
      }
    } catch {
      toast.error("Fehler beim Erstellen des API-Keys");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (keyId: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/api-keys/${keyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });

      if (res.ok) {
        setApiKeys((prev) =>
          prev.map((k) => (k.id === keyId ? { ...k, isActive } : k))
        );
        toast.success(isActive ? "API-Key aktiviert" : "API-Key deaktiviert");
      }
    } catch {
      toast.error("Fehler beim Aktualisieren");
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    try {
      const res = await fetch(`/api/api-keys/${keyId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setApiKeys((prev) => prev.filter((k) => k.id !== keyId));
        toast.success("API-Key gelöscht");
      }
    } catch {
      toast.error("Fehler beim Löschen");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("In Zwischenablage kopiert");
  };

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API-Keys
          </CardTitle>
          <CardDescription>
            Sie benötigen Admin-Rechte, um API-Keys zu verwalten.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              API-Keys
            </CardTitle>
            <CardDescription>
              Verwalten Sie API-Keys für externe Integrationen
            </CardDescription>
          </div>
          <Dialog open={showNewKeyDialog} onOpenChange={setShowNewKeyDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Neuer API-Key
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Neuen API-Key erstellen</DialogTitle>
                <DialogDescription>
                  Erstellen Sie einen API-Key für externe Integrationen wie
                  Zapier, Make.com oder eigene Anwendungen.
                </DialogDescription>
              </DialogHeader>

              {newKeyData ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                      <div className="text-sm text-amber-800">
                        <p className="font-medium">Wichtig!</p>
                        <p>
                          Speichern Sie diesen API-Key sicher. Er wird nur
                          einmal angezeigt und kann nicht wiederhergestellt
                          werden.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>API-Key</Label>
                    <div className="flex gap-2">
                      <Input
                        type={showKey ? "text" : "password"}
                        value={newKeyData.key}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setShowKey(!showKey)}
                      >
                        {showKey ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(newKeyData.key)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      onClick={() => {
                        setNewKeyData(null);
                        setShowNewKeyDialog(false);
                        setShowKey(false);
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Fertig
                    </Button>
                  </DialogFooter>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="keyName">Name</Label>
                      <Input
                        id="keyName"
                        placeholder="z.B. Zapier Integration"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setShowNewKeyDialog(false)}
                    >
                      Abbrechen
                    </Button>
                    <Button
                      onClick={handleCreateKey}
                      disabled={creating || !newKeyName.trim()}
                    >
                      {creating ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Key className="h-4 w-4 mr-2" />
                      )}
                      Erstellen
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : apiKeys.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Keine API-Keys vorhanden</p>
            <p className="text-sm">
              Erstellen Sie einen API-Key, um externe Integrationen zu
              ermöglichen.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Zuletzt verwendet</TableHead>
                <TableHead>Anfragen</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apiKeys.map((apiKey) => (
                <TableRow key={apiKey.id}>
                  <TableCell className="font-medium">{apiKey.name}</TableCell>
                  <TableCell>
                    <code className="text-sm bg-muted px-2 py-1 rounded">
                      {apiKey.keyPrefix}
                    </code>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={apiKey.isActive}
                        onCheckedChange={(checked) =>
                          handleToggleActive(apiKey.id, checked)
                        }
                      />
                      <Badge
                        variant={apiKey.isActive ? "default" : "secondary"}
                      >
                        {apiKey.isActive ? "Aktiv" : "Inaktiv"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    {apiKey.lastUsedAt ? (
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(apiKey.lastUsedAt), {
                          addSuffix: true,
                          locale: de,
                        })}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Nie</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{apiKey.requestCount}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            API-Key löschen?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Der API-Key &quot;{apiKey.name}&quot; wird
                            unwiderruflich gelöscht. Alle Integrationen, die
                            diesen Key verwenden, funktionieren nicht mehr.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteKey(apiKey.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Löschen
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* API Documentation Link */}
        <div className="mt-6 pt-6 border-t">
          <h4 className="font-medium mb-2">API-Dokumentation</h4>
          <p className="text-sm text-muted-foreground mb-3">
            Nutzen Sie die REST API, um Leads, Deals und Aktivitäten zu
            verwalten.
          </p>
          <div className="space-y-2 text-sm font-mono bg-muted p-4 rounded-lg">
            <p>
              <span className="text-green-600">GET</span> /api/v1/leads
            </p>
            <p>
              <span className="text-blue-600">POST</span> /api/v1/leads
            </p>
            <p>
              <span className="text-green-600">GET</span> /api/v1/deals
            </p>
            <p>
              <span className="text-blue-600">POST</span> /api/v1/deals
            </p>
            <p>
              <span className="text-green-600">GET</span> /api/v1/activities
            </p>
            <p>
              <span className="text-blue-600">POST</span> /api/v1/activities
            </p>
            <p>
              <span className="text-green-600">GET</span> /api/v1/pipelines
            </p>
          </div>
          <p className="text-sm text-muted-foreground mt-3">
            Authentifizierung: <code className="bg-muted px-1 rounded">Authorization: Bearer YOUR_API_KEY</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
