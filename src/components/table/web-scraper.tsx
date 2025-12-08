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
import { Switch } from "@/components/ui/switch";
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
  // AI-extracted fields
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
  linkedin?: string;
  facebook?: string;
  instagram?: string;
}

export function WebScraper({
  open,
  onOpenChange,
  rows,
  columns,
  onScrapeComplete,
}: WebScraperProps) {
  // Settings - Selenium + AI by default for best results
  const [useSelenium, setUseSelenium] = useState(true);
  const [useCrawl4ai, setUseCrawl4ai] = useState(false);
  const [useAI, setUseAI] = useState(true);  // AI enabled by default for name extraction

  // AI Provider from Settings
  const [aiProvider, setAiProvider] = useState<string>("deepseek");
  const [aiApiKey, setAiApiKey] = useState<string>("");
  const [hasValidApiKey, setHasValidApiKey] = useState(false);

  // Load AI config from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;

    const saved = localStorage.getItem("ai_provider_config");
    if (saved) {
      try {
        const config = JSON.parse(saved);
        if (config.provider && config.apiKey) {
          setAiProvider(config.provider);
          setAiApiKey(config.apiKey);
          setHasValidApiKey(true);
        }
      } catch {
        // Invalid config
      }
    }
  }, []);

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
      } else if (name.includes("linkedin")) {
        mappings.linkedin = col.id;
      } else if (name.includes("facebook")) {
        mappings.facebook = col.id;
      } else if (name.includes("instagram")) {
        mappings.instagram = col.id;
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
          // Add protocol if missing
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

  const handleStartScraping = async () => {
    if (urlsToScrape.length === 0) {
      toast.error("Keine URLs zum Scrapen gefunden");
      return;
    }

    setIsScraping(true);
    setProgress(0);
    setResults(new Map());

    const newResults = new Map<string, ScrapeResult>();

    try {
      for (let i = 0; i < urlsToScrape.length; i++) {
        const { rowId, url } = urlsToScrape[i];
        setCurrentUrl(url);
        setProgress(Math.round((i / urlsToScrape.length) * 100));

        try {
          const response = await fetch("/api/scrape", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              url,
              useSelenium,
              useCrawl4ai,
              useAI: useAI && hasValidApiKey, // Only enable AI if we have a valid key
              apiKey: hasValidApiKey ? aiApiKey : undefined,
              provider: aiProvider,
              rowId,
              columnMappings,
            }),
          });

          const data = await response.json();

          if (data.success && data.data) {
            newResults.set(rowId, data.data);
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
          }
        } catch (error) {
          newResults.set(rowId, {
            success: false,
            url,
            emails: [],
            phones: [],
            addresses: [],
            social: {},
            persons: [],
            error: error instanceof Error ? error.message : "Unbekannter Fehler",
          });
        }

        setResults(new Map(newResults));
      }

      setProgress(100);
      setCurrentUrl("");

      // Count successes
      const successCount = Array.from(newResults.values()).filter((r) => r.success).length;
      toast.success(`${successCount} von ${urlsToScrape.length} Websites erfolgreich gescraped`);

      if (onScrapeComplete) {
        onScrapeComplete(newResults);
      }
    } catch (error) {
      toast.error("Fehler beim Scraping");
    } finally {
      setIsScraping(false);
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
            Web Scraper - Kontaktdaten extrahieren
          </DialogTitle>
          <DialogDescription>
            Extrahiere automatisch E-Mails, Telefonnummern und Adressen von {urlsToScrape.length} Websites
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
                    Starte den Python Scraper mit:
                  </p>
                  <code className="text-xs bg-yellow-100 dark:bg-yellow-900 px-2 py-1 rounded mt-2 block">
                    cd scraper && start.bat
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
          {!hasValidApiKey && useAI && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:bg-amber-950/20">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    Kein API Key konfiguriert
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    Für die KI-gestützte Extraktion von Namen aus dem Impressum wird ein API Key benötigt.
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
                    API Key in Settings konfigurieren
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* API Key Status */}
          {hasValidApiKey && (
            <div className="rounded-lg border border-green-300 bg-green-50 p-3 dark:bg-green-950/20">
              <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm font-medium">
                  KI-Extraktion aktiv mit {aiProvider === "deepseek" ? "DeepSeek" : aiProvider === "google" ? "Google Gemini" : aiProvider.charAt(0).toUpperCase() + aiProvider.slice(1)}
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

              {/* Scraping Options */}
              <div className="flex flex-wrap gap-4 pt-2 border-t">
                <div className="flex items-center gap-2">
                  <Switch
                    id="use-selenium"
                    checked={useSelenium}
                    onCheckedChange={setUseSelenium}
                  />
                  <Label htmlFor="use-selenium" className="text-sm">Selenium (JS-Seiten)</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="use-crawl4ai"
                    checked={useCrawl4ai}
                    onCheckedChange={setUseCrawl4ai}
                  />
                  <Label htmlFor="use-crawl4ai" className="text-sm">Crawl4AI</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="use-ai"
                    checked={useAI}
                    onCheckedChange={setUseAI}
                  />
                  <Label htmlFor="use-ai" className="text-sm">KI-Extraktion</Label>
                </div>
              </div>
            </div>
          )}

          {/* Progress */}
          {isScraping && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Scraping läuft...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
              {currentUrl && (
                <p className="text-xs text-muted-foreground truncate">
                  Aktuell: {currentUrl}
                </p>
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
                          {result.persons.length > 0 && (
                            <div className="flex items-center gap-1 col-span-2">
                              <User className="h-3 w-3 text-violet-500" />
                              <span className="truncate">
                                {result.persons[0].name}
                                {result.persons[0].position && ` - ${result.persons[0].position}`}
                              </span>
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
                {urlsToScrape.length} Websites scrapen
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
