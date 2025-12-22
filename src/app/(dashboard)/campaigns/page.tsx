"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { CreateCampaignDialog } from "@/components/campaigns/create-campaign-dialog";
import {
  Plus,
  Search,
  MoreHorizontal,
  Play,
  Pause,
  Trash2,
  Mail,
  Users,
  MousePointerClick,
  Reply,
  AlertTriangle,
  Eye,
  Settings,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useOrganization } from "@/lib/organization-context";

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: "DRAFT" | "SCHEDULED" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
  recipientCount: number;
  sentCount: number;
  openCount: number;
  clickCount: number;
  replyCount: number;
  bounceCount: number;
  organization: { id: string; name: string };
  user: { id: string; name: string | null; email: string };
  _count: {
    sequences: number;
    recipients: number;
    sentEmails: number;
  };
  createdAt: string;
  updatedAt: string;
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-500",
  SCHEDULED: "bg-blue-500",
  ACTIVE: "bg-green-500",
  PAUSED: "bg-yellow-500",
  COMPLETED: "bg-purple-500",
  CANCELLED: "bg-red-500",
};

const statusLabels: Record<string, string> = {
  DRAFT: "Entwurf",
  SCHEDULED: "Geplant",
  ACTIVE: "Aktiv",
  PAUSED: "Pausiert",
  COMPLETED: "Abgeschlossen",
  CANCELLED: "Abgebrochen",
};

export default function CampaignsPage() {
  const router = useRouter();
  const { currentOrg } = useOrganization();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (currentOrg?.id) {
        params.set("organizationId", currentOrg.id);
      }
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }

      const response = await fetch(`/api/campaigns?${params.toString()}`);
      if (!response.ok) throw new Error("Fehler beim Laden der Kampagnen");
      const data = await response.json();
      setCampaigns(data);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      toast.error("Fehler beim Laden der Kampagnen");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, [currentOrg?.id, statusFilter]);

  const filteredCampaigns = campaigns.filter((campaign) =>
    campaign.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStartCampaign = async (campaignId: string) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/start`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Fehler beim Starten der Kampagne");
      toast.success("Kampagne gestartet");
      fetchCampaigns();
    } catch (error) {
      console.error("Error starting campaign:", error);
      toast.error("Fehler beim Starten der Kampagne");
    }
  };

  const handlePauseCampaign = async (campaignId: string) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/pause`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Fehler beim Pausieren der Kampagne");
      toast.success("Kampagne pausiert");
      fetchCampaigns();
    } catch (error) {
      console.error("Error pausing campaign:", error);
      toast.error("Fehler beim Pausieren der Kampagne");
    }
  };

  const handleResumeCampaign = async (campaignId: string) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/resume`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Fehler beim Fortsetzen der Kampagne");
      toast.success("Kampagne fortgesetzt");
      fetchCampaigns();
    } catch (error) {
      console.error("Error resuming campaign:", error);
      toast.error("Fehler beim Fortsetzen der Kampagne");
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!confirm("Kampagne wirklich loeschen?")) return;

    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Fehler beim Loeschen der Kampagne");
      toast.success("Kampagne geloescht");
      fetchCampaigns();
    } catch (error) {
      console.error("Error deleting campaign:", error);
      toast.error("Fehler beim Loeschen der Kampagne");
    }
  };

  const calculateOpenRate = (campaign: Campaign) => {
    if (campaign.sentCount === 0) return 0;
    return Math.round((campaign.openCount / campaign.sentCount) * 100);
  };

  const calculateClickRate = (campaign: Campaign) => {
    if (campaign.sentCount === 0) return 0;
    return Math.round((campaign.clickCount / campaign.sentCount) * 100);
  };

  const calculateReplyRate = (campaign: Campaign) => {
    if (campaign.sentCount === 0) return 0;
    return Math.round((campaign.replyCount / campaign.sentCount) * 100);
  };

  // Stats cards
  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE").length;
  const totalSent = campaigns.reduce((sum, c) => sum + c.sentCount, 0);
  const totalOpens = campaigns.reduce((sum, c) => sum + c.openCount, 0);
  const avgOpenRate = totalSent > 0 ? Math.round((totalOpens / totalSent) * 100) : 0;

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">E-Mail Kampagnen</h1>
          <p className="text-muted-foreground">
            Erstellen und verwalten Sie automatisierte E-Mail-Sequenzen
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Neue Kampagne
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kampagnen</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCampaigns}</div>
            <p className="text-xs text-muted-foreground">
              {activeCampaigns} aktiv
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gesendet</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSent.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">E-Mails insgesamt</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Geoeffnet</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOpens.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {avgOpenRate}% Oeffnungsrate
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Antworten</CardTitle>
            <Reply className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {campaigns.reduce((sum, c) => sum + c.replyCount, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Antworten erhalten</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Kampagne suchen..."
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
            <SelectItem value="DRAFT">Entwurf</SelectItem>
            <SelectItem value="SCHEDULED">Geplant</SelectItem>
            <SelectItem value="ACTIVE">Aktiv</SelectItem>
            <SelectItem value="PAUSED">Pausiert</SelectItem>
            <SelectItem value="COMPLETED">Abgeschlossen</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={fetchCampaigns}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Campaigns Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kampagne</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Empfaenger</TableHead>
                <TableHead className="text-center">Gesendet</TableHead>
                <TableHead className="text-center">Geoeffnet</TableHead>
                <TableHead className="text-center">Geklickt</TableHead>
                <TableHead className="text-center">Antworten</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filteredCampaigns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10">
                    <div className="text-muted-foreground">
                      {campaigns.length === 0
                        ? "Keine Kampagnen vorhanden. Erstellen Sie Ihre erste Kampagne!"
                        : "Keine Kampagnen gefunden."}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredCampaigns.map((campaign) => (
                  <TableRow
                    key={campaign.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/campaigns/${campaign.id}`)}
                  >
                    <TableCell>
                      <div>
                        <div className="font-medium">{campaign.name}</div>
                        {campaign.description && (
                          <div className="text-sm text-muted-foreground truncate max-w-[300px]">
                            {campaign.description}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground mt-1">
                          {campaign._count.sequences} Schritte
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`${statusColors[campaign.status]} text-white`}
                      >
                        {statusLabels[campaign.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        {campaign.recipientCount}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        {campaign.sentCount}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center">
                        <span>{campaign.openCount}</span>
                        <span className="text-xs text-muted-foreground">
                          {calculateOpenRate(campaign)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center">
                        <span>{campaign.clickCount}</span>
                        <span className="text-xs text-muted-foreground">
                          {calculateClickRate(campaign)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center">
                        <span>{campaign.replyCount}</span>
                        <span className="text-xs text-muted-foreground">
                          {calculateReplyRate(campaign)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/campaigns/${campaign.id}`);
                            }}
                          >
                            <Settings className="mr-2 h-4 w-4" />
                            Bearbeiten
                          </DropdownMenuItem>
                          {campaign.status === "DRAFT" && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartCampaign(campaign.id);
                              }}
                            >
                              <Play className="mr-2 h-4 w-4" />
                              Starten
                            </DropdownMenuItem>
                          )}
                          {campaign.status === "ACTIVE" && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePauseCampaign(campaign.id);
                              }}
                            >
                              <Pause className="mr-2 h-4 w-4" />
                              Pausieren
                            </DropdownMenuItem>
                          )}
                          {campaign.status === "PAUSED" && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleResumeCampaign(campaign.id);
                              }}
                            >
                              <Play className="mr-2 h-4 w-4" />
                              Fortsetzen
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCampaign(campaign.id);
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Loeschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CreateCampaignDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => {
          fetchCampaigns();
          setCreateDialogOpen(false);
        }}
      />
    </div>
  );
}
