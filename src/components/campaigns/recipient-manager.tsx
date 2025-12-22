"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Trash2,
  Upload,
  Users,
  Search,
  Loader2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Mail,
  Reply,
  AlertTriangle,
  Download,
} from "lucide-react";
import { toast } from "sonner";

interface Recipient {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  status: string;
  currentStep: number;
  variables: Record<string, string>;
  startedAt: string | null;
  completedAt: string | null;
  repliedAt: string | null;
  bouncedAt: string | null;
}

interface Project {
  id: string;
  name: string;
  table: {
    id: string;
    _count: { rows: number };
  } | null;
}

interface RecipientManagerProps {
  campaignId: string;
  organizationId: string;
  isEditable: boolean;
  onUpdate: () => void;
}

const statusColors: Record<string, string> = {
  PENDING: "bg-gray-500",
  ACTIVE: "bg-blue-500",
  COMPLETED: "bg-green-500",
  REPLIED: "bg-purple-500",
  BOUNCED: "bg-red-500",
  UNSUBSCRIBED: "bg-orange-500",
  PAUSED: "bg-yellow-500",
};

const statusLabels: Record<string, string> = {
  PENDING: "Wartend",
  ACTIVE: "Aktiv",
  COMPLETED: "Abgeschlossen",
  REPLIED: "Geantwortet",
  BOUNCED: "Bounced",
  UNSUBSCRIBED: "Abgemeldet",
  PAUSED: "Pausiert",
};

export function RecipientManager({
  campaignId,
  organizationId,
  isEditable,
  onUpdate,
}: RecipientManagerProps) {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [importLoading, setImportLoading] = useState(false);

  // Add single recipient form
  const [newEmail, setNewEmail] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newCompany, setNewCompany] = useState("");

  const fetchRecipients = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }

      const response = await fetch(
        `/api/campaigns/${campaignId}/recipients?${params.toString()}`
      );
      if (!response.ok) throw new Error("Fehler beim Laden");
      const data = await response.json();
      setRecipients(data);
    } catch (error) {
      console.error("Error fetching recipients:", error);
      toast.error("Fehler beim Laden der Empfaenger");
    } finally {
      setLoading(false);
    }
  }, [campaignId, statusFilter]);

  const fetchProjects = async () => {
    try {
      const response = await fetch(`/api/projects?organizationId=${organizationId}`);
      if (response.ok) {
        const data = await response.json();
        setProjects(data.filter((p: Project) => p.table && p.table._count.rows > 0));
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
    }
  };

  useEffect(() => {
    fetchRecipients();
  }, [fetchRecipients]);

  useEffect(() => {
    if (showImportDialog) {
      fetchProjects();
    }
  }, [showImportDialog]);

  const filteredRecipients = recipients.filter((r) =>
    r.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.company?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddRecipient = async () => {
    if (!newEmail.trim()) {
      toast.error("Bitte geben Sie eine E-Mail-Adresse ein");
      return;
    }

    // Simple email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      toast.error("Ungueltige E-Mail-Adresse");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/recipients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: [
            {
              email: newEmail,
              firstName: newFirstName || undefined,
              lastName: newLastName || undefined,
              company: newCompany || undefined,
            },
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Fehler beim Hinzufuegen");
      }

      toast.success("Empfaenger hinzugefuegt");
      setNewEmail("");
      setNewFirstName("");
      setNewLastName("");
      setNewCompany("");
      setShowAddDialog(false);
      fetchRecipients();
      onUpdate();
    } catch (error) {
      console.error("Error adding recipient:", error);
      toast.error(error instanceof Error ? error.message : "Fehler beim Hinzufuegen");
    } finally {
      setLoading(false);
    }
  };

  const handleImportFromProject = async () => {
    if (!selectedProject) {
      toast.error("Bitte waehlen Sie ein Projekt aus");
      return;
    }

    setImportLoading(true);
    try {
      const response = await fetch(
        `/api/campaigns/${campaignId}/recipients/import`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: selectedProject,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Fehler beim Import");
      }

      const result = await response.json();
      toast.success(`${result.imported} Empfaenger importiert`);
      setShowImportDialog(false);
      setSelectedProject("");
      fetchRecipients();
      onUpdate();
    } catch (error) {
      console.error("Error importing recipients:", error);
      toast.error(error instanceof Error ? error.message : "Fehler beim Import");
    } finally {
      setImportLoading(false);
    }
  };

  const handleDeleteRecipients = async (ids: string[]) => {
    if (ids.length === 0) return;
    if (!confirm(`${ids.length} Empfaenger wirklich loeschen?`)) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/recipients`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Fehler beim Loeschen");
      }

      toast.success(`${ids.length} Empfaenger geloescht`);
      setSelectedIds([]);
      fetchRecipients();
      onUpdate();
    } catch (error) {
      console.error("Error deleting recipients:", error);
      toast.error(error instanceof Error ? error.message : "Fehler beim Loeschen");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredRecipients.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredRecipients.map((r) => r.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "REPLIED":
        return <Reply className="h-4 w-4 text-purple-500" />;
      case "BOUNCED":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "ACTIVE":
        return <Mail className="h-4 w-4 text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  // Stats
  const stats = {
    total: recipients.length,
    pending: recipients.filter((r) => r.status === "PENDING").length,
    active: recipients.filter((r) => r.status === "ACTIVE").length,
    completed: recipients.filter((r) => r.status === "COMPLETED").length,
    replied: recipients.filter((r) => r.status === "REPLIED").length,
    bounced: recipients.filter((r) => r.status === "BOUNCED").length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Empfaenger</h3>
          <p className="text-sm text-muted-foreground">
            Verwalten Sie die Empfaenger dieser Kampagne.
          </p>
        </div>
        {isEditable && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowImportDialog(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Importieren
            </Button>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Hinzufuegen
            </Button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Gesamt</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-gray-600">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">Wartend</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-blue-600">{stats.active}</div>
            <p className="text-xs text-muted-foreground">Aktiv</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">Abgeschlossen</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-purple-600">{stats.replied}</div>
            <p className="text-xs text-muted-foreground">Geantwortet</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-red-600">{stats.bounced}</div>
            <p className="text-xs text-muted-foreground">Bounced</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status filtern" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="PENDING">Wartend</SelectItem>
            <SelectItem value="ACTIVE">Aktiv</SelectItem>
            <SelectItem value="COMPLETED">Abgeschlossen</SelectItem>
            <SelectItem value="REPLIED">Geantwortet</SelectItem>
            <SelectItem value="BOUNCED">Bounced</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={fetchRecipients}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
        {selectedIds.length > 0 && isEditable && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => handleDeleteRecipients(selectedIds)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {selectedIds.length} loeschen
          </Button>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {isEditable && (
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={
                        filteredRecipients.length > 0 &&
                        selectedIds.length === filteredRecipients.length
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                )}
                <TableHead>E-Mail</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Firma</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Schritt</TableHead>
                {isEditable && <TableHead className="w-[50px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={isEditable ? 7 : 5} className="text-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filteredRecipients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isEditable ? 7 : 5} className="text-center py-10">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      {recipients.length === 0
                        ? "Noch keine Empfaenger. Fuegen Sie Empfaenger hinzu oder importieren Sie aus einem Projekt."
                        : "Keine Empfaenger gefunden."}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecipients.map((recipient) => (
                  <TableRow key={recipient.id}>
                    {isEditable && (
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(recipient.id)}
                          onCheckedChange={() => toggleSelect(recipient.id)}
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-medium">{recipient.email}</TableCell>
                    <TableCell>
                      {recipient.firstName || recipient.lastName
                        ? `${recipient.firstName || ""} ${recipient.lastName || ""}`.trim()
                        : "-"}
                    </TableCell>
                    <TableCell>{recipient.company || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        {getStatusIcon(recipient.status)}
                        <Badge
                          className={`${statusColors[recipient.status]} text-white`}
                        >
                          {statusLabels[recipient.status] || recipient.status}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {recipient.currentStep > 0 ? recipient.currentStep : "-"}
                    </TableCell>
                    {isEditable && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteRecipients([recipient.id])}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Recipient Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Empfaenger hinzufuegen</DialogTitle>
            <DialogDescription>
              Fuegen Sie einen einzelnen Empfaenger zur Kampagne hinzu.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail *</Label>
              <Input
                id="email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="max@beispiel.de"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Vorname</Label>
                <Input
                  id="firstName"
                  value={newFirstName}
                  onChange={(e) => setNewFirstName(e.target.value)}
                  placeholder="Max"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nachname</Label>
                <Input
                  id="lastName"
                  value={newLastName}
                  onChange={(e) => setNewLastName(e.target.value)}
                  placeholder="Mustermann"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Firma</Label>
              <Input
                id="company"
                value={newCompany}
                onChange={(e) => setNewCompany(e.target.value)}
                placeholder="ACME GmbH"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleAddRecipient} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Hinzufuegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Empfaenger importieren</DialogTitle>
            <DialogDescription>
              Importieren Sie Empfaenger aus einem LeadTool-Projekt.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Projekt auswaehlen</Label>
              {projects.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground border rounded-lg">
                  <Users className="h-8 w-8 mx-auto mb-2" />
                  <p>Keine Projekte mit Leads gefunden.</p>
                </div>
              ) : (
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger>
                    <SelectValue placeholder="Projekt waehlen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name} ({project.table?._count.rows || 0} Leads)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {selectedProject && (
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm">
                  Es werden alle Leads mit gueltiger E-Mail-Adresse importiert.
                  Bereits vorhandene E-Mails werden uebersprungen.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleImportFromProject}
              disabled={importLoading || !selectedProject}
            >
              {importLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Download className="mr-2 h-4 w-4" />
              Importieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
