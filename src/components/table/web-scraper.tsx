"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Globe,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Mail,
  Phone,
  MapPin,
  User,
  ExternalLink,
  RefreshCw,
  Settings2,
  Zap,
  StopCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RowData, ColumnConfig } from "@/types/table";

interface WebScraperProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: RowData[];
  columns: ColumnConfig[];
  onScrapeComplete?: (results: Map<string, ScrapeResult>) => void;
}

export interface ScrapeResult {
  success: boolean;
  url: string;
  emails: string[];
  phones: string[];
  addresses: string[];
  social: Record<string, string>;
  persons: Array<{ name?: string; position?: string; email?: string; phone?: string }>;
  error?: string;
  firstName?: string;
  lastName?: string;
}

interface ColumnMapping {
  email?: string;
  phone?: string;
  address?: string;
  firstName?: string;
  lastName?: string;
  contactName?: string;
  contactPosition?: string;
}

export function WebScraper({
  open,
  onOpenChange,
  rows,
  columns,
  onScrapeComplete,
}: WebScraperProps) {
  // Column Mappings
  const [columnMappings, setColumnMappings] = useState<ColumnMapping>({});
  const [websiteColumnId, setWebsiteColumnId] = useState<string>("");

  // State
  const [isScraperAvailable, setIsScraperAvailable] = useState<boolean | null>(null);
  const [isScraping, setIsScraping] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentUrl, setCurrentUrl] = useState("");
  const [results, setResults] = useState<Map<string, ScrapeResult>>(new Map());
  const [showSettings, setShowSettings] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [maxConcurrent, setMaxConcurrent] = useState(100);
  const [hasApiKey, setHasApiKey] = useState(false);

  // Load API key status
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch("/api/settings");
        if (response.ok) {
          const data = await response.json();
          setHasApiKey(!!data.user?.settings?.hasApiKey);
        }
      } catch {
        // Ignore
      }
    };
    loadSettings();
  }, []);

  // Find website column and other relevant columns on mount
  useEffect(() => {
    const websiteCol = columns.find(
      (c) =>
        c.name.toLowerCase().includes("website") ||
        c.name.toLowerCase().includes("url") ||
        c.type === "URL"
    );
    if (websiteCol) {
      setWebsiteColumnId(websiteCol.id);
    }

    // Auto-map columns
    const mappings: ColumnMapping = {};
    for (const col of columns) {
      const name = col.name.toLowerCase();
      if (name.includes("email") || name.includes("mail") || col.type === "EMAIL") {
        mappings.email = col.id;
      } else if (name.includes("phone") || name.includes("telefon") || name.includes("tel") || col.type === "PHONE") {
        mappings.phone = col.id;
      } else if (name.includes("address") || name.includes("adresse")) {
        mappings.address = col.id;
      } else if (name.includes("vorname") || name === "first name" || name === "firstname") {
        mappings.firstName = col.id;
      } else if (name.includes("nachname") || name === "last name" || name === "lastname" || name === "surname") {
        mappings.lastName = col.id;
      } else if (name.includes("ansprechpartner") || name.includes("contact") || name === "name" || name === "fullname") {
        if (!mappings.contactName) {
          mappings.contactName = col.id;
        }
      } else if (name.includes("position") || name.includes("titel") || name.includes("role") || name.includes("job")) {
        mappings.contactPosition = col.id;
      }
    }
    setColumnMappings(mappings);
  }, [columns]);

  // Check if scraper service is available
  useEffect(() => {
    if (open) {
      checkScraperHealth();
    }
  }, [open]);

  const checkScraperHealth = async () => {
    try {
      const response = await fetch("/api/scrape", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setIsScraperAvailable(data.status === "ok");
      } else {
        setIsScraperAvailable(false);
      }
    } catch {
      setIsScraperAvailable(false);
    }
  };

  // Get URLs from rows
  const getUrlsFromRows = useCallback(() => {
    if (!websiteColumnId) return [];

    return rows
      .map((row) => {
        const cell = row.cells[websiteColumnId];
        const url = cell?.value;
        if (typeof url === "string" && url.trim()) {
          let fullUrl = url.trim();
          if (!fullUrl.startsWith("http://") && !fullUrl.startsWith("https://")) {
            fullUrl = "https://" + fullUrl;
          }
          return { rowId: row.id, url: fullUrl };
        }
        return null;
      })
      .filter((item): item is { rowId: string; url: string } => item !== null);
  }, [rows, websiteColumnId]);

  const urlsToScrape = getUrlsFromRows();

  // Cancel scraping job
  const handleCancelScraping = async () => {
    if (!jobId) return;

    try {
      const response = await fetch(`/api/scrape/job/${jobId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "cancel" }),
      });

      if (response.ok) {
        toast.info("Scraping wird abgebrochen...");
        setIsScraping(false);
        setJobId(null);
      }
    } catch {
      toast.error("Fehler beim Abbrechen");
    }
  };

  const handleStartScraping = async () => {
    if (urlsToScrape.length === 0) {
      toast.error("Keine URLs zum Scrapen gefunden");
      return;
    }

    setIsScraping(true);
    setProgress(0);
    setResults(new Map());
    setJobId(null);

    // Use bulk scraping for multiple URLs
    if (urlsToScrape.length > 1) {
      await handleBulkScraping();
    } else {
      await handleSingleScraping();
    }
  };

  // Bulk scraping
  const handleBulkScraping = async () => {
    try {
      const startResponse = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          urls: urlsToScrape,
          columnMappings,
          maxConcurrent,
        }),
      });

      const startData = await startResponse.json();

      if (!startData.success || !startData.jobId) {
        toast.error(startData.error || "Fehler beim Starten des Scraping-Jobs");
        setIsScraping(false);
        return;
      }

      setJobId(startData.jobId);
      toast.info(`${urlsToScrape.length} URLs werden parallel gescraped (${maxConcurrent} gleichzeitig)...`);

      // Poll for progress
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`/api/scrape/job/${startData.jobId}`, {
            credentials: "include",
          });

          if (!statusResponse.ok) {
            clearInterval(pollInterval);
            setIsScraping(false);
            return;
          }

          const status = await statusResponse.json();

          setProgress(status.progress || 0);
          setCurrentUrl(`${status.completed}/${status.total} URLs verarbeitet`);

          // Update results
          if (status.results && status.results.length > 0) {
            const newResults = new Map<string, ScrapeResult>();
            status.results.forEach((result: ScrapeResult) => {
              const urlEntry = urlsToScrape.find(u => u.url === result.url);
              if (urlEntry) {
                newResults.set(urlEntry.rowId, result);
              }
            });
            setResults(newResults);
          }

          // Check if completed
          if (status.status === "completed" || status.status === "cancelled" || status.status === "failed") {
            clearInterval(pollInterval);
            setIsScraping(false);
            setJobId(null);
            setCurrentUrl("");
            setProgress(100);

            if (status.status === "completed") {
              const successCount = status.results?.filter((r: ScrapeResult) => r.success).length || 0;
              toast.success(`${successCount} von ${status.total} Websites erfolgreich gescraped`);

              if (onScrapeComplete && status.results) {
                const finalResults = new Map<string, ScrapeResult>();
                status.results.forEach((result: ScrapeResult) => {
                  const urlEntry = urlsToScrape.find(u => u.url === result.url);
                  if (urlEntry) {
                    finalResults.set(urlEntry.rowId, result);
                  }
                });
                onScrapeComplete(finalResults);
              }
            } else if (status.status === "cancelled") {
              toast.info(`Scraping abgebrochen nach ${status.completed}/${status.total} URLs`);
            } else {
              toast.error("Scraping fehlgeschlagen");
            }
          }
        } catch {
          // Continue polling
        }
      }, 1000);

    } catch {
      toast.error("Fehler beim Scraping");
      setIsScraping(false);
    }
  };

  // Single URL scraping
  const handleSingleScraping = async () => {
    const { rowId, url } = urlsToScrape[0];
    setCurrentUrl(url);

    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          url,
          rowId,
          columnMappings,
        }),
      });

      const data = await response.json();
      const newResults = new Map<string, ScrapeResult>();

      if (data.success && data.data) {
        newResults.set(rowId, data.data);
        toast.success("Website erfolgreich gescraped");
      } else {
        newResults.set(rowId, {
          success: false,
          url,
          emails: [],
          phones: [],
          addresses: [],
          social: {},
          persons: [],
          error: data.message || "Scraping fehlgeschlagen",
        });
        toast.error("Scraping fehlgeschlagen");
      }

      setResults(newResults);
      setProgress(100);

      if (onScrapeComplete) {
        onScrapeComplete(newResults);
      }
    } catch {
      toast.error("Fehler beim Scraping");
    } finally {
      setIsScraping(false);
      setCurrentUrl("");
    }
  };

  const successCount = Array.from(results.values()).filter((r) => r.success).length;
  const errorCount = Array.from(results.values()).filter((r) => !r.success).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-500" />
            Impressum Scraper
          </DialogTitle>
          <DialogDescription>
            Extrahiere automatisch Kontaktdaten (Vorname, Nachname, E-Mail) von {urlsToScrape.length} Websites
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Scraper Status */}
          {isScraperAvailable === false && (
            <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 dark:bg-yellow-950/20">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">
                    Scraper Service nicht erreichbar
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    Starte den Python Scraper:
                  </p>
                  <code className="text-xs bg-yellow-100 dark:bg-yellow-900 px-2 py-1 rounded mt-2 block">
                    cd /var/www/leadtool/scraper && python -m scraper.server
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={checkScraperHealth}
                    className="mt-3"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Erneut prüfen
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* API Key Warning */}
          {!hasApiKey && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:bg-amber-950/20">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    Kein OpenAI API Key konfiguriert
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    Für beste Ergebnisse (97-99% Genauigkeit) wird ein OpenAI API Key benötigt.
                    Ohne API Key werden nur E-Mails per Regex gefunden.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onOpenChange(false);
                      window.location.href = "/settings";
                    }}
                    className="mt-3"
                  >
                    <Settings2 className="h-4 w-4 mr-2" />
                    API Key konfigurieren
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* API Key Status */}
          {hasApiKey && (
            <div className="rounded-lg border border-green-300 bg-green-50 p-3 dark:bg-green-950/20">
              <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm font-medium">
                  GPT-4o Extraktion aktiv (97-99% Genauigkeit)
                </span>
              </div>
            </div>
          )}

          {/* Settings Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{urlsToScrape.length} URLs</Badge>
              {results.size > 0 && (
                <>
                  <Badge variant="default" className="bg-green-500">{successCount} erfolgreich</Badge>
                  {errorCount > 0 && (
                    <Badge variant="destructive">{errorCount} fehlgeschlagen</Badge>
                  )}
                </>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings2 className="h-4 w-4 mr-2" />
              Einstellungen
            </Button>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="rounded-lg border p-4 space-y-4 bg-muted/50">
              <div className="grid grid-cols-2 gap-4">
                {/* Website Column Selection */}
                <div className="space-y-2">
                  <Label>Website-Spalte</Label>
                  <Select value={websiteColumnId} onValueChange={setWebsiteColumnId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Spalte auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map((col) => (
                        <SelectItem key={col.id} value={col.id}>
                          {col.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Email Column Mapping */}
                <div className="space-y-2">
                  <Label>E-Mail speichern in</Label>
                  <Select
                    value={columnMappings.email || "_none"}
                    onValueChange={(v) => setColumnMappings((m) => ({ ...m, email: v === "_none" ? undefined : v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Spalte auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Keine</SelectItem>
                      {columns.map((col) => (
                        <SelectItem key={col.id} value={col.id}>
                          {col.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* First Name Column Mapping */}
                <div className="space-y-2">
                  <Label>Vorname speichern in</Label>
                  <Select
                    value={columnMappings.firstName || "_none"}
                    onValueChange={(v) => setColumnMappings((m) => ({ ...m, firstName: v === "_none" ? undefined : v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Spalte auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Keine</SelectItem>
                      {columns.map((col) => (
                        <SelectItem key={col.id} value={col.id}>
                          {col.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Last Name Column Mapping */}
                <div className="space-y-2">
                  <Label>Nachname speichern in</Label>
                  <Select
                    value={columnMappings.lastName || "_none"}
                    onValueChange={(v) => setColumnMappings((m) => ({ ...m, lastName: v === "_none" ? undefined : v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Spalte auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Keine</SelectItem>
                      {columns.map((col) => (
                        <SelectItem key={col.id} value={col.id}>
                          {col.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Phone Column Mapping */}
                <div className="space-y-2">
                  <Label>Telefon speichern in</Label>
                  <Select
                    value={columnMappings.phone || "_none"}
                    onValueChange={(v) => setColumnMappings((m) => ({ ...m, phone: v === "_none" ? undefined : v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Spalte auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Keine</SelectItem>
                      {columns.map((col) => (
                        <SelectItem key={col.id} value={col.id}>
                          {col.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Address Column Mapping */}
                <div className="space-y-2">
                  <Label>Adresse speichern in</Label>
                  <Select
                    value={columnMappings.address || "_none"}
                    onValueChange={(v) => setColumnMappings((m) => ({ ...m, address: v === "_none" ? undefined : v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Spalte auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Keine</SelectItem>
                      {columns.map((col) => (
                        <SelectItem key={col.id} value={col.id}>
                          {col.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Concurrency Settings */}
              <div className="flex items-center gap-4 pt-2 border-t">
                <Label className="text-sm">Parallele Verbindungen:</Label>
                <Select
                  value={String(maxConcurrent)}
                  onValueChange={(v) => setMaxConcurrent(Number(v))}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="150">150</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">
                  (Mehr = schneller, aber höhere Serverlast)
                </span>
              </div>
            </div>
          )}

          {/* Progress */}
          {isScraping && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-500 animate-pulse" />
                  Scraping läuft...
                </span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
              {currentUrl && (
                <p className="text-xs text-muted-foreground truncate">
                  {currentUrl}
                </p>
              )}
              {jobId && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleCancelScraping}
                  className="w-full mt-2"
                >
                  <StopCircle className="h-4 w-4 mr-2" />
                  Scraping abbrechen
                </Button>
              )}
            </div>
          )}

          {/* Results */}
          {results.size > 0 && !isScraping && (
            <ScrollArea className="h-[300px] rounded-lg border">
              <div className="p-3 space-y-2">
                {Array.from(results.entries()).map(([rowId, result]) => {
                  const row = rows.find((r) => r.id === rowId);
                  const companyCell = row?.cells[Object.keys(row.cells)[0]];
                  const companyName = companyCell?.value || result.url;

                  return (
                    <div
                      key={rowId}
                      className={cn(
                        "rounded-lg border p-3",
                        result.success
                          ? "bg-green-50 dark:bg-green-950/20 border-green-200"
                          : "bg-red-50 dark:bg-red-950/20 border-red-200"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {result.success ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-red-600" />
                          )}
                          <span className="font-medium text-sm truncate max-w-[200px]">
                            {String(companyName)}
                          </span>
                        </div>
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>

                      {result.success ? (
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                          {(result.firstName || result.lastName) && (
                            <div className="flex items-center gap-1 col-span-2">
                              <User className="h-3 w-3 text-violet-500" />
                              <span className="truncate">
                                {result.firstName} {result.lastName}
                              </span>
                            </div>
                          )}
                          {result.emails.length > 0 && (
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3 text-blue-500" />
                              <span className="truncate">{result.emails[0]}</span>
                            </div>
                          )}
                          {result.phones.length > 0 && (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3 text-green-500" />
                              <span className="truncate">{result.phones[0]}</span>
                            </div>
                          )}
                          {result.addresses.length > 0 && (
                            <div className="flex items-center gap-1 col-span-2">
                              <MapPin className="h-3 w-3 text-red-500" />
                              <span className="truncate">{result.addresses[0]}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                          {result.error || "Keine Daten gefunden"}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          {/* No URLs Warning */}
          {urlsToScrape.length === 0 && (
            <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 dark:bg-yellow-950/20">
              <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">
                  Keine Websites gefunden. Stelle sicher, dass eine Website-Spalte mit URLs vorhanden ist.
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Schließen
          </Button>
          <Button
            onClick={handleStartScraping}
            disabled={isScraping || urlsToScrape.length === 0 || isScraperAvailable === false}
          >
            {isScraping ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Scraping...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                {urlsToScrape.length} URLs scrapen
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
