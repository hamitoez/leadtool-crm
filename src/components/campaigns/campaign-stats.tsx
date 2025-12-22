"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  RefreshCw,
  Send,
  Eye,
  MousePointerClick,
  Reply,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { toast } from "sonner";

interface Campaign {
  id: string;
  name: string;
  status: string;
  recipientCount: number;
  sentCount: number;
  openCount: number;
  clickCount: number;
  replyCount: number;
  bounceCount: number;
  dailyLimit: number;
}

interface CampaignStatsProps {
  campaignId: string;
  campaign: Campaign;
}

interface StatsData {
  totals: {
    recipients: number;
    sent: number;
    opened: number;
    clicked: number;
    replied: number;
    bounced: number;
  };
  rates: {
    openRate: number;
    clickRate: number;
    replyRate: number;
    bounceRate: number;
  };
  sequenceStats: Array<{
    stepNumber: number;
    subject: string;
    sent: number;
  }>;
  recipientsByStatus: Array<{
    status: string;
    count: number;
  }>;
}

export function CampaignStats({ campaignId, campaign }: CampaignStatsProps) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/campaigns/${campaignId}/stats`);
      if (!response.ok) throw new Error("Fehler beim Laden");
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error("Error fetching stats:", error);
      toast.error("Fehler beim Laden der Statistiken");
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const openRate = campaign.sentCount > 0
    ? Math.round((campaign.openCount / campaign.sentCount) * 100)
    : 0;
  const clickRate = campaign.sentCount > 0
    ? Math.round((campaign.clickCount / campaign.sentCount) * 100)
    : 0;
  const replyRate = campaign.sentCount > 0
    ? Math.round((campaign.replyCount / campaign.sentCount) * 100)
    : 0;
  const bounceRate = campaign.sentCount > 0
    ? Math.round((campaign.bounceCount / campaign.sentCount) * 100)
    : 0;

  const getProgressColor = (rate: number, type: "good" | "bad") => {
    if (type === "good") {
      if (rate >= 40) return "bg-green-500";
      if (rate >= 20) return "bg-yellow-500";
      return "bg-red-500";
    } else {
      if (rate <= 2) return "bg-green-500";
      if (rate <= 5) return "bg-yellow-500";
      return "bg-red-500";
    }
  };

  const getRateTrend = (rate: number, benchmark: number) => {
    if (rate > benchmark + 5) {
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    } else if (rate < benchmark - 5) {
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    }
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Kampagnen-Statistiken</h3>
          <p className="text-sm text-muted-foreground">
            Detaillierte Auswertung der Kampagnen-Performance.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStats}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Aktualisieren
        </Button>
      </div>

      {/* Main Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-blue-500" />
                Oeffnungsrate
              </span>
              {getRateTrend(openRate, 25)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{openRate}%</div>
            <Progress
              value={openRate}
              className="mt-2 h-2"
            />
            <p className="text-xs text-muted-foreground mt-2">
              {campaign.openCount} von {campaign.sentCount} geoeffnet
            </p>
            <p className="text-xs text-muted-foreground">
              Benchmark: 20-40%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span className="flex items-center gap-2">
                <MousePointerClick className="h-4 w-4 text-green-500" />
                Klickrate
              </span>
              {getRateTrend(clickRate, 5)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{clickRate}%</div>
            <Progress
              value={clickRate * 5}
              className="mt-2 h-2"
            />
            <p className="text-xs text-muted-foreground mt-2">
              {campaign.clickCount} Klicks
            </p>
            <p className="text-xs text-muted-foreground">
              Benchmark: 2-5%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Reply className="h-4 w-4 text-purple-500" />
                Antwortrate
              </span>
              {getRateTrend(replyRate, 3)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{replyRate}%</div>
            <Progress
              value={replyRate * 10}
              className="mt-2 h-2"
            />
            <p className="text-xs text-muted-foreground mt-2">
              {campaign.replyCount} Antworten
            </p>
            <p className="text-xs text-muted-foreground">
              Benchmark: 1-5%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Bounce-Rate
              </span>
              {getRateTrend(10 - bounceRate, 8)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{bounceRate}%</div>
            <Progress
              value={bounceRate * 10}
              className="mt-2 h-2"
            />
            <p className="text-xs text-muted-foreground mt-2">
              {campaign.bounceCount} Bounces
            </p>
            <p className="text-xs text-muted-foreground">
              Ziel: unter 2%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kampagnen-Fortschritt</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Empfaenger erreicht</span>
                <span className="text-sm text-muted-foreground">
                  {campaign.sentCount} / {campaign.recipientCount}
                </span>
              </div>
              <Progress
                value={
                  campaign.recipientCount > 0
                    ? (campaign.sentCount / campaign.recipientCount) * 100
                    : 0
                }
                className="h-3"
              />
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 border-t">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {campaign.replyCount}
                </div>
                <p className="text-xs text-muted-foreground">Positive Reaktionen</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">
                  {campaign.recipientCount - campaign.sentCount}
                </div>
                <p className="text-xs text-muted-foreground">Noch ausstehend</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {campaign.bounceCount}
                </div>
                <p className="text-xs text-muted-foreground">Nicht zustellbar</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sequence Performance */}
      {stats?.sequenceStats && stats.sequenceStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Performance nach Schritt</CardTitle>
            <CardDescription>
              Vergleich der einzelnen E-Mail-Schritte
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">Schritt</TableHead>
                  <TableHead>Betreff</TableHead>
                  <TableHead className="text-center">Gesendet</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.sequenceStats.map((seq) => (
                  <TableRow key={seq.stepNumber}>
                    <TableCell>
                      <Badge variant="outline">{seq.stepNumber}</Badge>
                    </TableCell>
                    <TableCell className="font-medium max-w-[300px] truncate">
                      {seq.subject}
                    </TableCell>
                    <TableCell className="text-center">{seq.sent}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Recipient Status */}
      {stats?.recipientsByStatus && stats.recipientsByStatus.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Empfaenger nach Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {stats.recipientsByStatus.map((status) => (
                <div key={status.status} className="text-center p-3 border rounded-lg">
                  <div className="text-2xl font-bold">{status.count}</div>
                  <p className="text-xs text-muted-foreground capitalize">
                    {status.status.toLowerCase()}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {campaign.sentCount === 0 && (
        <Card>
          <CardContent className="py-10 text-center">
            <Send className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h4 className="font-medium mb-2">Noch keine E-Mails gesendet</h4>
            <p className="text-sm text-muted-foreground">
              Starten Sie die Kampagne, um Statistiken zu sehen.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
