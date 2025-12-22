"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Play,
  Pause,
  Settings,
  Users,
  BarChart3,
  Mail,
  Loader2,
  Send,
  Eye,
  MousePointerClick,
  Reply,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { SequenceEditor } from "@/components/campaigns/sequence-editor";
import { RecipientManager } from "@/components/campaigns/recipient-manager";
import { CampaignStats } from "@/components/campaigns/campaign-stats";
import { CampaignSettings } from "@/components/campaigns/campaign-settings";

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: "DRAFT" | "SCHEDULED" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
  accountIds: string[];
  dailyLimit: number;
  sendingDays: string[];
  sendingHoursStart: number;
  sendingHoursEnd: number;
  timezone: string;
  stopOnReply: boolean;
  stopOnBounce: boolean;
  trackOpens: boolean;
  trackClicks: boolean;
  recipientCount: number;
  sentCount: number;
  openCount: number;
  clickCount: number;
  replyCount: number;
  bounceCount: number;
  organization: { id: string; name: string };
  user: { id: string; name: string | null; email: string };
  sequences: CampaignSequence[];
  _count: {
    sequences: number;
    recipients: number;
    sentEmails: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface CampaignSequence {
  id: string;
  stepNumber: number;
  subject: string;
  body: string;
  delayDays: number;
  delayHours: number;
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

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.campaignId as string;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("sequences");

  const fetchCampaign = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/campaigns/${campaignId}`);
      if (!response.ok) {
        if (response.status === 404) {
          toast.error("Kampagne nicht gefunden");
          router.push("/campaigns");
          return;
        }
        throw new Error("Fehler beim Laden der Kampagne");
      }
      const data = await response.json();
      setCampaign(data);
    } catch (error) {
      console.error("Error fetching campaign:", error);
      toast.error("Fehler beim Laden der Kampagne");
    } finally {
      setLoading(false);
    }
  }, [campaignId, router]);

  useEffect(() => {
    fetchCampaign();
  }, [fetchCampaign]);

  const handleStartCampaign = async () => {
    if (!campaign) return;

    // Validate before starting
    if (campaign._count.sequences === 0) {
      toast.error("Bitte fuegen Sie mindestens einen E-Mail-Schritt hinzu");
      return;
    }
    if (campaign._count.recipients === 0) {
      toast.error("Bitte fuegen Sie mindestens einen Empfaenger hinzu");
      return;
    }

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/start`, {
        method: "POST",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Fehler beim Starten");
      }
      toast.success("Kampagne gestartet");
      fetchCampaign();
    } catch (error) {
      console.error("Error starting campaign:", error);
      toast.error(error instanceof Error ? error.message : "Fehler beim Starten");
    }
  };

  const handlePauseCampaign = async () => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/pause`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Fehler beim Pausieren");
      toast.success("Kampagne pausiert");
      fetchCampaign();
    } catch (error) {
      console.error("Error pausing campaign:", error);
      toast.error("Fehler beim Pausieren der Kampagne");
    }
  };

  const handleResumeCampaign = async () => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/resume`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Fehler beim Fortsetzen");
      toast.success("Kampagne fortgesetzt");
      fetchCampaign();
    } catch (error) {
      console.error("Error resuming campaign:", error);
      toast.error("Fehler beim Fortsetzen der Kampagne");
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!campaign) {
    return null;
  }

  const canStart = campaign.status === "DRAFT" &&
    campaign._count.sequences > 0 &&
    campaign._count.recipients > 0;

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/campaigns")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{campaign.name}</h1>
              <Badge className={`${statusColors[campaign.status]} text-white`}>
                {statusLabels[campaign.status]}
              </Badge>
            </div>
            {campaign.description && (
              <p className="text-muted-foreground mt-1">{campaign.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {campaign.status === "DRAFT" && (
            <Button onClick={handleStartCampaign} disabled={!canStart}>
              <Play className="mr-2 h-4 w-4" />
              Kampagne starten
            </Button>
          )}
          {campaign.status === "ACTIVE" && (
            <Button variant="outline" onClick={handlePauseCampaign}>
              <Pause className="mr-2 h-4 w-4" />
              Pausieren
            </Button>
          )}
          {campaign.status === "PAUSED" && (
            <Button onClick={handleResumeCampaign}>
              <Play className="mr-2 h-4 w-4" />
              Fortsetzen
            </Button>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Empfaenger
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaign.recipientCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Send className="h-4 w-4 text-muted-foreground" />
              Gesendet
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaign.sentCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              Geoeffnet
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaign.openCount}</div>
            <p className="text-xs text-muted-foreground">
              {campaign.sentCount > 0
                ? `${Math.round((campaign.openCount / campaign.sentCount) * 100)}%`
                : "0%"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MousePointerClick className="h-4 w-4 text-muted-foreground" />
              Geklickt
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaign.clickCount}</div>
            <p className="text-xs text-muted-foreground">
              {campaign.sentCount > 0
                ? `${Math.round((campaign.clickCount / campaign.sentCount) * 100)}%`
                : "0%"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Reply className="h-4 w-4 text-muted-foreground" />
              Antworten
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaign.replyCount}</div>
            <p className="text-xs text-muted-foreground">
              {campaign.sentCount > 0
                ? `${Math.round((campaign.replyCount / campaign.sentCount) * 100)}%`
                : "0%"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Validation Warnings */}
      {campaign.status === "DRAFT" && (
        <div className="space-y-2">
          {campaign._count.sequences === 0 && (
            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">
                Fuegen Sie mindestens einen E-Mail-Schritt hinzu, um die Kampagne zu starten.
              </span>
            </div>
          )}
          {campaign._count.recipients === 0 && (
            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">
                Fuegen Sie mindestens einen Empfaenger hinzu, um die Kampagne zu starten.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="sequences" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            E-Mail Sequence
            <Badge variant="secondary" className="ml-1">
              {campaign._count.sequences}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="recipients" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Empfaenger
            <Badge variant="secondary" className="ml-1">
              {campaign._count.recipients}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Statistiken
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Einstellungen
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sequences" className="mt-6">
          <SequenceEditor
            campaignId={campaignId}
            sequences={campaign.sequences}
            isEditable={campaign.status === "DRAFT"}
            onUpdate={fetchCampaign}
          />
        </TabsContent>

        <TabsContent value="recipients" className="mt-6">
          <RecipientManager
            campaignId={campaignId}
            organizationId={campaign.organization.id}
            isEditable={campaign.status === "DRAFT"}
            onUpdate={fetchCampaign}
          />
        </TabsContent>

        <TabsContent value="stats" className="mt-6">
          <CampaignStats campaignId={campaignId} campaign={campaign} />
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <CampaignSettings
            campaign={campaign}
            isEditable={campaign.status === "DRAFT"}
            onUpdate={fetchCampaign}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
