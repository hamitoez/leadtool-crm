"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  AlertTriangle,
  ExternalLink,
  Trash2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  User,
  Mail,
  Phone,
  Building2,
  XCircle,
  AlertCircle,
  FileQuestion,
  Copy,
  Check,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ScrapeLog {
  id: string;
  url: string;
  status: string;
  error: string | null;
  foundData: Record<string, unknown>;
  pagesScraped: string[];
  confidence: number;
  processingTime: number | null;
  createdAt: string;
}

interface ScrapeLogSectionProps {
  projectId: string;
}

const STATUS_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  NO_NAME_FOUND: {
    label: "Kein Name gefunden",
    icon: <User className="h-4 w-4" />,
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  },
  PARTIAL_DATA: {
    label: "Teilweise Daten",
    icon: <AlertCircle className="h-4 w-4" />,
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  },
  SCRAPE_ERROR: {
    label: "Scrape Fehler",
    icon: <XCircle className="h-4 w-4" />,
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  },
  PAGE_NOT_FOUND: {
    label: "Seite nicht erreichbar",
    icon: <FileQuestion className="h-4 w-4" />,
    color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  },
  NO_IMPRESSUM: {
    label: "Kein Impressum",
    icon: <FileQuestion className="h-4 w-4" />,
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  },
};

export function ScrapeLogSection({ projectId }: ScrapeLogSectionProps) {
  const [logs, setLogs] = useState<ScrapeLog[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleting, setDeleting] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const fetchLogs = useCallback(async (countsOnly = false, filter = statusFilter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ projectId });
      if (filter !== "all") {
        params.append("status", filter);
      }
      // When only fetching counts, limit to 1 to reduce data transfer
      params.append("limit", countsOnly ? "1" : "100");

      const res = await fetch(`/api/scrape-log?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (!countsOnly) {
          setLogs(data.data || []);
        }
        setCounts(data.counts || {});
        setTotal(data.pagination?.total || 0);
      }
    } catch (error) {
      console.error("Error fetching scrape logs:", error);
    } finally {
      setLoading(false);
    }
  }, [projectId, statusFilter]);

  // Fetch counts on mount to determine if section should be shown
  useEffect(() => {
    const loadCounts = async () => {
      try {
        const params = new URLSearchParams({ projectId, limit: "1" });
        const res = await fetch(`/api/scrape-log?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setCounts(data.counts || {});
          setTotal(data.pagination?.total || 0);
        }
      } catch (error) {
        console.error("Error fetching scrape log counts:", error);
      } finally {
        setLoading(false);
      }
    };
    loadCounts();
  }, [projectId]);

  // Fetch full logs when section is opened or filter changes
  useEffect(() => {
    if (isOpen) {
      fetchLogs(false, statusFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, statusFilter]);

  const handleDeleteAll = async () => {
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/scrape-log?projectId=${projectId}&all=true`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setLogs([]);
        setCounts({});
        setTotal(0);
      }
    } catch (error) {
      console.error("Error deleting logs:", error);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteOne = async (logId: string) => {
    try {
      const res = await fetch(
        `/api/scrape-log?projectId=${projectId}&id=${logId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setLogs((prev) => prev.filter((l) => l.id !== logId));
        setTotal((prev) => prev - 1);
      }
    } catch (error) {
      console.error("Error deleting log:", error);
    }
  };

  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);

  if (totalCount === 0 && !isOpen) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-orange-200 dark:border-orange-800">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <CardTitle className="text-lg">
                  Fehlgeschlagene Scrapes
                </CardTitle>
                {totalCount > 0 && (
                  <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                    {totalCount}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isOpen ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            {/* Filter & Actions */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Status filtern" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Status ({totalCount})</SelectItem>
                    {Object.entries(STATUS_LABELS).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>
                        {label} ({counts[key] || 0})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchLogs(false)}
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
                  Aktualisieren
                </Button>
              </div>

              {logs.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={deleting}>
                      <Trash2 className="h-4 w-4 mr-1" />
                      Alle löschen
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Alle Logs löschen?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Diese Aktion kann nicht rückgängig gemacht werden. Alle {total} fehlgeschlagenen Scrape-Einträge werden permanent gelöscht.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteAll}>
                        Alle löschen
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>

            {/* Status Summary */}
            <div className="flex flex-wrap gap-2 mb-4">
              {Object.entries(counts).map(([status, count]) => {
                const statusInfo = STATUS_LABELS[status];
                if (!statusInfo || count === 0) return null;
                return (
                  <Badge key={status} className={statusInfo.color}>
                    {statusInfo.icon}
                    <span className="ml-1">{statusInfo.label}: {count}</span>
                  </Badge>
                );
              })}
            </div>

            {/* Logs Table */}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Keine fehlgeschlagenen Scrapes</p>
              </div>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>URL</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Fehler</TableHead>
                      <TableHead>Datum</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => {
                      const statusInfo = STATUS_LABELS[log.status] || {
                        label: log.status,
                        icon: <AlertCircle className="h-4 w-4" />,
                        color: "bg-gray-100 text-gray-800",
                      };
                      const foundData = log.foundData || {};
                      const isExpanded = expandedRows.has(log.id);

                      // Generate explanation based on status and found data
                      const getStatusExplanation = (): { short: string; full: string } => {
                        if (log.error) {
                          return { short: log.error, full: log.error };
                        }

                        const missing: string[] = [];
                        const found: string[] = [];

                        if (!foundData.companyName) missing.push("Firmenname");
                        else found.push(`Firma: ${foundData.companyName}`);

                        if (!foundData.email) missing.push("E-Mail");
                        else found.push(`E-Mail: ${foundData.email}`);

                        if (!foundData.phone) missing.push("Telefon");
                        else found.push(`Tel: ${foundData.phone}`);

                        if (!foundData.address) missing.push("Adresse");
                        else found.push(`Adresse: ${foundData.address}`);

                        switch (log.status) {
                          case "NO_NAME_FOUND":
                            return {
                              short: "Kein Ansprechpartner auf der Website gefunden",
                              full: `Kein Ansprechpartner gefunden.\n\nGefunden: ${found.length > 0 ? found.join(", ") : "Keine Daten"}\nFehlt: ${missing.join(", ")}`
                            };
                          case "PARTIAL_DATA":
                            return {
                              short: `Fehlende Felder: ${missing.join(", ")}`,
                              full: `Nicht alle Kontaktdaten gefunden.\n\nGefunden:\n${found.length > 0 ? "• " + found.join("\n• ") : "Keine Daten"}\n\nFehlt:\n• ${missing.join("\n• ")}`
                            };
                          case "NO_IMPRESSUM":
                            return {
                              short: "Keine Impressum-Seite auf der Website gefunden",
                              full: "Keine Impressum-Seite gefunden. Die Website hat möglicherweise kein Impressum oder es ist unter einem anderen Namen verlinkt."
                            };
                          case "PAGE_NOT_FOUND":
                            return {
                              short: "Website nicht erreichbar oder existiert nicht",
                              full: "Die Website konnte nicht geladen werden. Mögliche Gründe:\n• Domain existiert nicht mehr\n• Server nicht erreichbar\n• SSL-Zertifikat ungültig\n• Timeout beim Laden"
                            };
                          default:
                            return {
                              short: "Unbekannter Status",
                              full: `Status: ${log.status}\nGefunden: ${found.length > 0 ? found.join(", ") : "Keine Daten"}`
                            };
                        }
                      };

                      const explanation = getStatusExplanation();
                      const hasDetails = true; // Always show expand option

                      return (
                        <React.Fragment key={log.id}>
                          <TableRow
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => toggleRow(log.id)}
                          >
                            <TableCell className="max-w-[200px]">
                              <a
                                href={log.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 truncate"
                              >
                                {(() => {
                                  try {
                                    return new URL(log.url).hostname;
                                  } catch {
                                    return log.url;
                                  }
                                })()}
                                <ExternalLink className="h-3 w-3 flex-shrink-0" />
                              </a>
                            </TableCell>
                            <TableCell>
                              <Badge className={statusInfo.color}>
                                {statusInfo.icon}
                                <span className="ml-1">{statusInfo.label}</span>
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[400px]">
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  {isExpanded ? (
                                    <ChevronUp className="h-4 w-4 flex-shrink-0" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 flex-shrink-0" />
                                  )}
                                  <span className="text-sm truncate max-w-[300px]">
                                    {explanation.short}
                                  </span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyToClipboard(explanation.full, log.id);
                                  }}
                                  className="h-7 px-2 flex-shrink-0"
                                >
                                  {copiedId === log.id ? (
                                    <Check className="h-3 w-3 text-green-500" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {new Date(log.createdAt).toLocaleString("de-DE", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteOne(log.id);
                                }}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow key={`${log.id}-details`} className={log.error ? "bg-red-50/50 dark:bg-red-950/20" : "bg-orange-50/50 dark:bg-orange-950/20"}>
                              <TableCell colSpan={5} className="py-3">
                                <div className="flex items-start gap-3">
                                  {log.error ? (
                                    <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                                  ) : (
                                    <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className={`text-sm font-medium mb-1 ${log.error ? "text-red-700 dark:text-red-400" : "text-orange-700 dark:text-orange-400"}`}>
                                      {log.error ? "Fehlermeldung:" : "Details:"}
                                    </div>
                                    <pre className="text-sm text-muted-foreground bg-muted p-3 rounded-md overflow-x-auto whitespace-pre-wrap break-words font-mono select-all">
                                      {explanation.full}
                                    </pre>
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      copyToClipboard(explanation.full, log.id);
                                    }}
                                    className="flex-shrink-0"
                                  >
                                    {copiedId === log.id ? (
                                      <>
                                        <Check className="h-4 w-4 mr-1 text-green-500" />
                                        Kopiert
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="h-4 w-4 mr-1" />
                                        Kopieren
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
