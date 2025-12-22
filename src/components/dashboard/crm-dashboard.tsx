"use client";

import { useEffect, useState, useCallback } from "react";
import { useOrganization } from "@/lib/organization-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Euro,
  Target,
  Phone,
  Mail,
  Calendar,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  BarChart3,
  PieChart,
  Activity,
  RefreshCw,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import type { CRMStats } from "@/app/api/dashboard/stats/route";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download } from "lucide-react";

interface CRMDashboardProps {
  userName: string;
}

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function CRMDashboard({ userName }: CRMDashboardProps) {
  const [stats, setStats] = useState<CRMStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentOrg } = useOrganization();

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (currentOrg?.id) {
        params.set("organizationId", currentOrg.id);
      }
      const res = await fetch(`/api/dashboard/stats?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      const data = await res.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }, [currentOrg?.id]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">{error || "Keine Daten verfuegbar"}</p>
        <Button variant="outline" className="mt-4" onClick={fetchStats}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Erneut versuchen
        </Button>
      </div>
    );
  }

  const activityTypeIcon = (type: string) => {
    switch (type) {
      case "CALL":
        return <Phone className="h-4 w-4 text-blue-500" />;
      case "EMAIL":
        return <Mail className="h-4 w-4 text-green-500" />;
      case "MEETING":
        return <Calendar className="h-4 w-4 text-purple-500" />;
      case "NOTE":
        return <FileText className="h-4 w-4 text-yellow-500" />;
      case "TASK":
        return <CheckCircle2 className="h-4 w-4 text-orange-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Willkommen, {userName}</h1>
          <p className="text-muted-foreground">
            Hier ist Ihre CRM-Uebersicht
          </p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem asChild>
                <a href="/api/export?type=deals&format=csv" download>
                  Deals exportieren (CSV)
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="/api/export?type=activities&format=csv" download>
                  Aktivitaeten exportieren (CSV)
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="/api/export?type=leads&format=csv" download>
                  Leads exportieren (CSV)
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="/api/export?type=pipeline-report&format=csv" download>
                  Pipeline-Report (CSV)
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a href="/api/export/pdf?type=dashboard" download className="flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  Dashboard Report (PDF)
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="/api/export/pdf?type=pipeline-report" download className="flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  Pipeline Report (PDF)
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="/api/export/pdf?type=deals" download className="flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  Deals Report (PDF)
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="/api/export/pdf?type=activities" download className="flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  Aktivitaeten Report (PDF)
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={fetchStats}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Aktualisieren
          </Button>
        </div>
      </div>

      {/* Top KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Pipeline Value */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pipeline-Wert</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats.pipeline.totalValue)}
            </div>
            <p className="text-xs text-muted-foreground">
              Gewichtet: {formatCurrency(stats.pipeline.weightedValue)}
            </p>
          </CardContent>
        </Card>

        {/* Win Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              {stats.performance.winRate.toFixed(1)}%
              {stats.performance.winRate >= 30 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.performance.wonDeals} gewonnen / {stats.performance.lostDeals} verloren
            </p>
          </CardContent>
        </Card>

        {/* Open Deals */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Offene Deals</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pipeline.totalDeals}</div>
            <p className="text-xs text-muted-foreground">
              Ø {formatCurrency(stats.pipeline.avgDealSize)} pro Deal
            </p>
          </CardContent>
        </Card>

        {/* Activities This Week */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Aktivitaeten (7 Tage)</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activities.totalThisWeek}</div>
            <div className="flex gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                <Phone className="h-3 w-3 mr-1" />
                {stats.activities.callsThisWeek}
              </Badge>
              <Badge variant="outline" className="text-xs">
                <Mail className="h-3 w-3 mr-1" />
                {stats.activities.emailsThisWeek}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alert Cards */}
      {(stats.activities.tasksOverdue > 0 || stats.activities.tasksDueToday > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {stats.activities.tasksOverdue > 0 && (
            <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
              <CardContent className="flex items-center gap-4 pt-6">
                <AlertCircle className="h-8 w-8 text-red-500" />
                <div>
                  <p className="font-medium text-red-800 dark:text-red-200">
                    {stats.activities.tasksOverdue} ueberfaellige Aufgaben
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-300">
                    Bitte so schnell wie moeglich bearbeiten
                  </p>
                </div>
                <Link href="/tasks" className="ml-auto">
                  <Button variant="outline" size="sm">
                    Anzeigen
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {stats.activities.tasksDueToday > 0 && (
            <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
              <CardContent className="flex items-center gap-4 pt-6">
                <Clock className="h-8 w-8 text-yellow-500" />
                <div>
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">
                    {stats.activities.tasksDueToday} Aufgaben heute faellig
                  </p>
                  <p className="text-sm text-yellow-600 dark:text-yellow-300">
                    Nicht vergessen!
                  </p>
                </div>
                <Link href="/tasks" className="ml-auto">
                  <Button variant="outline" size="sm">
                    Anzeigen
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Main Content - Charts */}
      <Tabs defaultValue="pipeline" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pipeline" className="gap-2">
            <PieChart className="h-4 w-4" />
            Pipeline
          </TabsTrigger>
          <TabsTrigger value="trends" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Trends
          </TabsTrigger>
          <TabsTrigger value="forecast" className="gap-2">
            <Euro className="h-4 w-4" />
            Prognose
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2">
            <Mail className="h-4 w-4" />
            E-Mail Tracking
          </TabsTrigger>
        </TabsList>

        {/* Pipeline Tab */}
        <TabsContent value="pipeline" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Deals per Stage Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Deals pro Stage</CardTitle>
                <CardDescription>Verteilung der offenen Deals</CardDescription>
              </CardHeader>
              <CardContent>
                {stats.pipeline.dealsPerStage.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={stats.pipeline.dealsPerStage}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="stageName" tick={{ fontSize: 12 }} />
                      <YAxis />
                      <Tooltip
                        formatter={(value) => [
                          typeof value === "number" ? value : 0,
                          "Deals",
                        ]}
                      />
                      <Bar dataKey="count" fill="#3b82f6" name="Deals" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    Keine Deals vorhanden
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pipeline Value per Stage */}
            <Card>
              <CardHeader>
                <CardTitle>Wert pro Stage</CardTitle>
                <CardDescription>Pipeline-Wert nach Stage</CardDescription>
              </CardHeader>
              <CardContent>
                {stats.pipeline.dealsPerStage.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsPieChart>
                      <Pie
                        data={stats.pipeline.dealsPerStage.filter((s) => s.value > 0)}
                        dataKey="value"
                        nameKey="stageName"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, value }) =>
                          `${name}: ${formatCurrency(typeof value === "number" ? value : 0)}`
                        }
                      >
                        {stats.pipeline.dealsPerStage.map((entry, index) => (
                          <Cell
                            key={entry.stageId}
                            fill={entry.stageColor || COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => typeof value === "number" ? formatCurrency(value) : "€0"} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    Keine Deals mit Wert vorhanden
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Performance Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Performance</CardTitle>
              <CardDescription>Gewonnene und verlorene Deals</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                  <div className="text-3xl font-bold text-green-600">
                    {stats.performance.wonDeals}
                  </div>
                  <div className="text-sm text-muted-foreground">Gewonnen</div>
                  <div className="text-sm font-medium text-green-600">
                    {formatCurrency(stats.performance.wonValue)}
                  </div>
                </div>
                <div className="text-center p-4 bg-red-50 dark:bg-red-950/20 rounded-lg">
                  <div className="text-3xl font-bold text-red-600">
                    {stats.performance.lostDeals}
                  </div>
                  <div className="text-sm text-muted-foreground">Verloren</div>
                  <div className="text-sm font-medium text-red-600">
                    {formatCurrency(stats.performance.lostValue)}
                  </div>
                </div>
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                  <div className="text-3xl font-bold text-blue-600">
                    {stats.performance.winRate.toFixed(1)}%
                  </div>
                  <div className="text-sm text-muted-foreground">Win Rate</div>
                </div>
                <div className="text-center p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
                  <div className="text-3xl font-bold text-purple-600">
                    {Math.round(stats.performance.avgDaysToClose)}
                  </div>
                  <div className="text-sm text-muted-foreground">Ø Tage bis Abschluss</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Deals Created Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Deals erstellt</CardTitle>
                <CardDescription>Letzte 4 Wochen</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={stats.trends.dealsCreated}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      fillOpacity={0.3}
                      name="Deals"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Activities Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Aktivitaeten</CardTitle>
                <CardDescription>Letzte 4 Wochen</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={stats.trends.activitiesLogged}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#22c55e"
                      strokeWidth={2}
                      name="Aktivitaeten"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Deals Won Trend */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Gewonnene Deals</CardTitle>
                <CardDescription>Anzahl und Wert der letzten 4 Wochen</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={stats.trends.dealsWon}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis yAxisId="left" orientation="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip
                      formatter={(value, name) => [
                        name === "Anzahl" ? (typeof value === "number" ? value : 0) : formatCurrency(typeof value === "number" ? value : 0),
                        String(name),
                      ]}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="count" fill="#22c55e" name="Anzahl" />
                    <Bar yAxisId="right" dataKey="value" fill="#3b82f6" name="Wert" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Forecast Tab */}
        <TabsContent value="forecast" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Erwarteter Umsatz - Dieser Monat</CardTitle>
                <CardDescription>Gewichteter Pipeline-Wert</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-green-600">
                  {formatCurrency(stats.forecast.expectedCloseThisMonth)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Erwarteter Umsatz - Naechster Monat</CardTitle>
                <CardDescription>Gewichteter Pipeline-Wert</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-blue-600">
                  {formatCurrency(stats.forecast.expectedCloseNextMonth)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Pipeline-Prognose</CardTitle>
              <CardDescription>Erwartete Abschluesse nach Monat</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.forecast.pipelineByMonth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip
                    formatter={(value, name) => [
                      name === "Deals" ? (typeof value === "number" ? value : 0) : formatCurrency(typeof value === "number" ? value : 0),
                      String(name),
                    ]}
                  />
                  <Legend />
                  <Bar dataKey="count" fill="#8b5cf6" name="Deals" />
                  <Bar dataKey="weightedValue" fill="#22c55e" name="Gewichteter Wert" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Tracking Tab */}
        <TabsContent value="email" className="space-y-4">
          {/* Email Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gesendet</CardTitle>
                <Mail className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.emailTracking.totalSent}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.emailTracking.sentThisWeek} diese Woche
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Geoeffnet</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.emailTracking.totalOpened}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.emailTracking.openRate.toFixed(1)}% Oeffnungsrate
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Beantwortet</CardTitle>
                <ArrowRight className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.emailTracking.totalReplied}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.emailTracking.replyRate.toFixed(1)}% Antwortrate
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Diese Woche</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.emailTracking.openedThisWeek}</div>
                <p className="text-xs text-muted-foreground">
                  geoeffnet, {stats.emailTracking.repliedThisWeek} beantwortet
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Emails with Tracking */}
          <Card>
            <CardHeader>
              <CardTitle>Aktuelle E-Mails</CardTitle>
              <CardDescription>Tracking-Status Ihrer gesendeten E-Mails</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.emailTracking.recentEmails.length > 0 ? (
                <div className="space-y-3">
                  {stats.emailTracking.recentEmails.map((email) => (
                    <div
                      key={email.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{email.subject}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          An: {email.toEmail}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {email.sentAt &&
                            formatDistanceToNow(new Date(email.sentAt), {
                              addSuffix: true,
                              locale: de,
                            })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {email.openCount > 0 ? (
                          <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                            {email.openCount}x geoeffnet
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Nicht geoeffnet</Badge>
                        )}
                        {email.isReplied && (
                          <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">
                            Beantwortet
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Noch keine gesendeten E-Mails</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Recent Items */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Deals */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Aktuelle Deals</CardTitle>
              <CardDescription>Zuletzt aktualisiert</CardDescription>
            </div>
            <Link href="/pipeline">
              <Button variant="outline" size="sm">
                Alle anzeigen
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {stats.recent.deals.length > 0 ? (
              <div className="space-y-4">
                {stats.recent.deals.map((deal) => (
                  <div
                    key={deal.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: deal.stageColor }}
                      />
                      <div>
                        <p className="font-medium">{deal.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {deal.stageName}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(deal.value)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(deal.updatedAt), {
                          addSuffix: true,
                          locale: de,
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Keine Deals vorhanden
              </p>
            )}
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Letzte Aktivitaeten</CardTitle>
              <CardDescription>Ihre aktuellen Aktionen</CardDescription>
            </div>
            <Link href="/tasks">
              <Button variant="outline" size="sm">
                Alle anzeigen
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {stats.recent.activities.length > 0 ? (
              <div className="space-y-4">
                {stats.recent.activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50"
                  >
                    {activityTypeIcon(activity.type)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{activity.title}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {activity.contactName}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(activity.createdAt), {
                        addSuffix: true,
                        locale: de,
                      })}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Keine Aktivitaeten vorhanden
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
