"use client";

import { useState, useEffect, useRef } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Sparkles,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  Settings2,
  Wand2,
  AlertCircle,
  CheckCircle2,
  GripVertical,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RowData, ColumnConfig } from "@/types/table";

interface AIComplimentGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Einzelner Lead
  row?: RowData;
  columns?: ColumnConfig[];
  complimentCellId?: string;
  // Bulk Mode
  rows?: RowData[];
  onComplimentGenerated?: (rowId: string, compliment: string) => void;
  onBulkComplete?: (results: Map<string, string>) => void;
}

type Tone = "professional" | "friendly" | "casual";
type Length = "short" | "medium" | "long";
type Focus = "website" | "reviews" | "business" | "general";
type Preset = "webdesign" | "restaurant" | "localBusiness" | "custom";

const TONE_LABELS: Record<Tone, string> = {
  professional: "Professionell",
  friendly: "Freundlich",
  casual: "Locker",
};

const LENGTH_LABELS: Record<Length, string> = {
  short: "Kurz (1-2 Sätze)",
  medium: "Mittel (2-3 Sätze)",
  long: "Lang (3-4 Sätze)",
};

const FOCUS_LABELS: Record<Focus, string> = {
  website: "Website",
  reviews: "Bewertungen",
  business: "Geschäft",
  general: "Allgemein",
};

const PRESET_LABELS: Record<Preset, { label: string; description: string }> = {
  webdesign: {
    label: "Webdesign",
    description: "Fokus auf Website-Design und UX",
  },
  restaurant: {
    label: "Restaurant",
    description: "Fokus auf Bewertungen und Kulinarik",
  },
  localBusiness: {
    label: "Lokales Geschäft",
    description: "Fokus auf lokale Präsenz",
  },
  custom: {
    label: "Benutzerdefiniert",
    description: "Eigene Einstellungen mit Platzhaltern",
  },
};

// Mapping von bekannten Feldnamen zu deutschen Labels
const FIELD_LABELS: Record<string, string> = {
  company: "Firma",
  firstName: "Vorname",
  lastName: "Nachname",
  website: "Website",
  rating: "Bewertung",
  reviews: "Anzahl Reviews",
  reviewKeywords: "Review Keywords",
  reviewText: "Review Text (JSON)",
  category: "Branche",
  address: "Adresse",
  email: "E-Mail",
  phone: "Telefon",
};

export function AIComplimentGenerator({
  open,
  onOpenChange,
  row,
  columns,
  complimentCellId,
  rows,
  onComplimentGenerated,
  onBulkComplete,
}: AIComplimentGeneratorProps) {
  const isBulkMode = rows && rows.length > 0;
  const [activeTab, setActiveTab] = useState<"generate" | "settings">("generate");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Settings
  const [preset, setPreset] = useState<Preset>("webdesign");
  const [tone, setTone] = useState<Tone>("professional");
  const [length, setLength] = useState<Length>("medium");
  const [focus, setFocus] = useState<Focus>("website");
  const [customInstructions, setCustomInstructions] = useState("");

  // State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCompliment, setGeneratedCompliment] = useState("");
  const [confidence, setConfidence] = useState(0);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bulk State
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkResults, setBulkResults] = useState<Map<string, { compliment?: string; error?: string }>>(new Map());

  // API Key aus Datenbank
  const [apiKey, setApiKey] = useState<string>("");
  const [aiProvider, setAiProvider] = useState<string>("anthropic");
  const [hasValidApiKey, setHasValidApiKey] = useState(false);

  // Verfügbare Spalten für Platzhalter
  const [availableColumns, setAvailableColumns] = useState<{ id: string; name: string; fieldKey: string }[]>([]);

  // Load AI settings from API (database)
  useEffect(() => {
    const loadAiSettings = async () => {
      try {
        const response = await fetch("/api/settings");
        if (response.ok) {
          const data = await response.json();
          if (data.user?.settings?.aiProvider && data.user?.settings?.hasApiKey) {
            setAiProvider(data.user.settings.aiProvider);
            setHasValidApiKey(true);
            // The backend will use the API key directly - we just track that we have one
            setApiKey("configured"); // Placeholder to indicate key exists
          }
        }
      } catch {
        // Failed to load settings
      }
    };
    if (open) {
      loadAiSettings();
    }
  }, [open]);

  // Spalten analysieren und für Platzhalter vorbereiten
  useEffect(() => {
    if (!columns) return;

    const colMappings: { id: string; name: string; fieldKey: string }[] = [];

    for (const col of columns) {
      const colNameLower = col.name.toLowerCase();
      let fieldKey = "";

      // Mapping zu Standard-Feldnamen
      if (colNameLower.includes("firma") || colNameLower.includes("company") || colNameLower === "name") {
        fieldKey = "company";
      } else if (colNameLower.includes("vorname") || colNameLower === "first name" || colNameLower === "firstname") {
        fieldKey = "firstName";
      } else if (colNameLower.includes("nachname") || colNameLower === "last name" || colNameLower === "lastname" || colNameLower === "surname") {
        fieldKey = "lastName";
      } else if (colNameLower.includes("website") || colNameLower.includes("url")) {
        fieldKey = "website";
      } else if (colNameLower.includes("rating") || colNameLower.includes("bewertung") || colNameLower.includes("sterne")) {
        fieldKey = "rating";
      } else if (colNameLower.includes("review") && (colNameLower.includes("anzahl") || colNameLower.includes("count") || colNameLower.includes("number"))) {
        fieldKey = "reviews";
      } else if (colNameLower.includes("keyword") || colNameLower.includes("review keyword") || colNameLower.includes("schlagwort")) {
        fieldKey = "reviewKeywords";
      } else if (colNameLower.includes("category") || colNameLower.includes("kategorie") || colNameLower.includes("branche")) {
        fieldKey = "category";
      } else if (colNameLower.includes("address") || colNameLower.includes("adresse")) {
        fieldKey = "address";
      } else if (colNameLower.includes("email") || colNameLower.includes("mail")) {
        fieldKey = "email";
      } else if (colNameLower.includes("phone") || colNameLower.includes("telefon") || colNameLower.includes("tel")) {
        fieldKey = "phone";
      }

      if (fieldKey) {
        colMappings.push({ id: col.id, name: col.name, fieldKey });
      }
    }

    setAvailableColumns(colMappings);
  }, [columns]);

  // Lead-Daten aus Row extrahieren - ERWEITERT
  const extractLeadData = (rowData: RowData) => {
    if (!columns) return {};

    const data: Record<string, string | number | undefined> = {};

    for (const col of columns) {
      const cell = rowData.cells[col.id];
      const value = cell?.value;

      if (value === null || value === undefined || value === "") continue;

      const colNameLower = col.name.toLowerCase();

      // Erweitertes Mapping
      if (colNameLower.includes("firma") || colNameLower.includes("company") || colNameLower === "name") {
        data.company = String(value);
      } else if (colNameLower.includes("vorname") || colNameLower === "first name" || colNameLower === "firstname") {
        data.firstName = String(value);
      } else if (colNameLower.includes("nachname") || colNameLower === "last name" || colNameLower === "lastname" || colNameLower === "surname") {
        data.lastName = String(value);
      } else if (colNameLower.includes("website") || colNameLower.includes("url")) {
        data.website = String(value);
      } else if (colNameLower.includes("rating") || colNameLower.includes("bewertung") || colNameLower.includes("sterne")) {
        data.rating = typeof value === "number" ? value : parseFloat(String(value));
      } else if (colNameLower.includes("review") && (colNameLower.includes("anzahl") || colNameLower.includes("count") || colNameLower.includes("number"))) {
        data.reviews = typeof value === "number" ? value : parseInt(String(value));
      } else if (colNameLower.includes("keyword") || colNameLower.includes("review keyword") || colNameLower.includes("schlagwort")) {
        data.reviewKeywords = String(value);
      } else if (colNameLower === "review text" || colNameLower === "reviewtext" || colNameLower.includes("review_text") || colNameLower.includes("rezension")) {
        // JSON-komprimierte Review-Texte
        data.reviewText = String(value);
      } else if (colNameLower.includes("category") || colNameLower.includes("kategorie") || colNameLower.includes("branche")) {
        data.category = String(value);
      } else if (colNameLower.includes("address") || colNameLower.includes("adresse")) {
        data.address = String(value);
      } else if (colNameLower.includes("email") || colNameLower.includes("mail")) {
        data.email = String(value);
      } else if (colNameLower.includes("phone") || colNameLower.includes("telefon") || colNameLower.includes("tel")) {
        data.phone = String(value);
      }
    }

    return data;
  };

  // Drag Start Handler
  const handleDragStart = (e: React.DragEvent, fieldKey: string) => {
    const placeholder = `{{${fieldKey}}}`;
    e.dataTransfer.setData("text/plain", placeholder);
    e.dataTransfer.effectAllowed = "copy";
  };

  // Handle Drop auf Textarea
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const placeholder = e.dataTransfer.getData("text/plain");
    const textarea = textareaRef.current;

    if (textarea && placeholder) {
      // Berechne Drop-Position basierend auf Maus-Position
      const rect = textarea.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Füge am Ende ein wenn keine genaue Position ermittelt werden kann
      const newValue = customInstructions + (customInstructions ? " " : "") + placeholder;
      setCustomInstructions(newValue);

      // Fokussiere und setze Cursor ans Ende
      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = newValue.length;
        textarea.selectionEnd = newValue.length;
      }, 0);
    }
  };

  // Klick-Handler als Fallback (fügt am Ende an)
  const insertPlaceholder = (fieldKey: string) => {
    const placeholder = `{{${fieldKey}}}`;
    const textarea = textareaRef.current;

    // Füge am Ende des bestehenden Texts an
    const separator = customInstructions && !customInstructions.endsWith(" ") ? " " : "";
    const newValue = customInstructions + separator + placeholder;
    setCustomInstructions(newValue);

    // Fokussiere Textarea und setze Cursor ans Ende
    if (textarea) {
      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = newValue.length;
        textarea.selectionEnd = newValue.length;
      }, 0);
    }
  };

  // Platzhalter durch echte Werte ersetzen
  const replacePlaceholders = (text: string, leadData: Record<string, string | number | undefined>): string => {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = leadData[key];
      if (value !== undefined && value !== null && value !== "") {
        return String(value);
      }
      return match; // Platzhalter behalten wenn kein Wert
    });
  };

  const handleGenerate = async () => {
    if (!row || !columns) return;

    setIsGenerating(true);
    setError(null);
    setGeneratedCompliment("");

    try {
      const leadData = extractLeadData(row);

      // Platzhalter ersetzen
      const processedInstructions = replacePlaceholders(customInstructions, leadData);

      const response = await fetch("/api/ai/generate-compliment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          leadData,
          options: {
            preset: preset !== "custom" ? preset : undefined,
            tone,
            length,
            focus,
            customInstructions: processedInstructions || undefined,
          },
          cellId: complimentCellId,
          apiKey: apiKey || undefined,
          provider: aiProvider,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || "Fehler bei der Generierung");
      }

      setGeneratedCompliment(result.compliment);
      setConfidence(result.confidence);

      if (onComplimentGenerated && row) {
        onComplimentGenerated(row.id, result.compliment);
      }

      toast.success("Kompliment erfolgreich generiert!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unbekannter Fehler";
      setError(message);
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBulkGenerate = async () => {
    if (!rows || rows.length === 0 || !columns) return;

    setIsGenerating(true);
    setError(null);
    setBulkProgress(0);
    setBulkResults(new Map());

    try {
      const leads = rows.map((r) => {
        // Finde die Kompliment-Spalte
        const complimentCol = columns.find(
          (c) => c.name.toLowerCase().includes("kompliment") || c.type === "AI_GENERATED"
        );
        const cellId = complimentCol ? r.cells[complimentCol.id]?.id : undefined;
        const leadData = extractLeadData(r);

        // Platzhalter ersetzen für jeden Lead
        const processedInstructions = replacePlaceholders(customInstructions, leadData);

        return {
          id: r.id,
          cellId,
          data: leadData,
          customInstructions: processedInstructions,
        };
      });

      const response = await fetch("/api/ai/generate-compliment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          leads,
          options: {
            preset: preset !== "custom" ? preset : undefined,
            tone,
            length,
            focus,
            customInstructions: customInstructions || undefined, // Basis-Anweisungen
          },
          apiKey: apiKey || undefined,
          provider: aiProvider,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || "Fehler bei der Bulk-Generierung");
      }

      // Ergebnisse setzen
      const resultsMap = new Map<string, { compliment?: string; error?: string }>();
      for (const [id, data] of Object.entries(result.results)) {
        resultsMap.set(id, data as { compliment?: string; error?: string });
      }
      setBulkResults(resultsMap);
      setBulkProgress(100);

      // Callback für erfolgreiche Komplimente
      if (onBulkComplete) {
        const successMap = new Map<string, string>();
        resultsMap.forEach((val, key) => {
          if (val.compliment) {
            successMap.set(key, val.compliment);
          }
        });
        onBulkComplete(successMap);
      }

      toast.success(
        `${result.summary.success} von ${result.summary.total} Komplimente generiert!`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unbekannter Fehler";
      setError(message);
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedCompliment);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("In Zwischenablage kopiert!");
  };

  const leadData = row && columns ? extractLeadData(row) : {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" />
            KI-Kompliment Generator
          </DialogTitle>
          <DialogDescription>
            {isBulkMode
              ? `Generiere personalisierte Komplimente für ${rows?.length} Leads`
              : `Generiere ein personalisiertes Kompliment für ${leadData.firstName || leadData.company || "diesen Lead"}`}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "generate" | "settings")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="generate" className="gap-2">
              <Wand2 className="h-4 w-4" />
              Generieren
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings2 className="h-4 w-4" />
              Einstellungen
            </TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="space-y-4">
            {/* Lead Info - ERWEITERT */}
            {!isBulkMode && row && (
              <div className="rounded-lg border bg-muted/50 p-3">
                <div className="text-sm font-medium mb-2">Lead-Informationen:</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {leadData.firstName && (
                    <div>
                      <span className="text-muted-foreground">Vorname:</span>{" "}
                      <span className="font-medium">{String(leadData.firstName)}</span>
                    </div>
                  )}
                  {leadData.lastName && (
                    <div>
                      <span className="text-muted-foreground">Nachname:</span>{" "}
                      <span className="font-medium">{String(leadData.lastName)}</span>
                    </div>
                  )}
                  {leadData.company && (
                    <div>
                      <span className="text-muted-foreground">Firma:</span>{" "}
                      <span className="font-medium">{String(leadData.company)}</span>
                    </div>
                  )}
                  {leadData.website && (
                    <div>
                      <span className="text-muted-foreground">Website:</span>{" "}
                      <span className="truncate">{String(leadData.website).substring(0, 30)}...</span>
                    </div>
                  )}
                  {leadData.rating && (
                    <div>
                      <span className="text-muted-foreground">Rating:</span>{" "}
                      <span className="font-medium">{leadData.rating} ⭐</span>
                    </div>
                  )}
                  {leadData.reviews && (
                    <div>
                      <span className="text-muted-foreground">Reviews:</span>{" "}
                      <span className="font-medium">{leadData.reviews}</span>
                    </div>
                  )}
                  {leadData.reviewKeywords && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Keywords:</span>{" "}
                      <span className="text-xs bg-violet-100 dark:bg-violet-900/30 px-2 py-0.5 rounded">
                        {String(leadData.reviewKeywords).substring(0, 80)}...
                      </span>
                    </div>
                  )}
                  {leadData.category && (
                    <div>
                      <span className="text-muted-foreground">Branche:</span>{" "}
                      {String(leadData.category)}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Bulk Progress */}
            {isBulkMode && isGenerating && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Generiere Komplimente...</span>
                  <span>{bulkProgress}%</span>
                </div>
                <Progress value={bulkProgress} />
              </div>
            )}

            {/* Bulk Results */}
            {isBulkMode && bulkResults.size > 0 && !isGenerating && (
              <ScrollArea className="h-[200px] rounded-lg border p-3">
                <div className="space-y-2">
                  {Array.from(bulkResults.entries()).map(([id, result]) => {
                    const rowData = rows?.find((r) => r.id === id);
                    const data = rowData ? extractLeadData(rowData) : {};
                    const displayName = data.firstName
                      ? `${data.firstName} ${data.lastName || ""}`.trim()
                      : data.company || id;

                    return (
                      <div
                        key={id}
                        className={cn(
                          "flex items-start gap-2 rounded p-2",
                          result.error ? "bg-red-50 dark:bg-red-950/20" : "bg-green-50 dark:bg-green-950/20"
                        )}
                      >
                        {result.error ? (
                          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{displayName}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {result.error || result.compliment?.substring(0, 100) + "..."}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}

            {/* Generated Compliment */}
            {!isBulkMode && generatedCompliment && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Generiertes Kompliment:</Label>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      Konfidenz: {Math.round(confidence * 100)}%
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCopy}
                      className="h-7"
                    >
                      {copied ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="rounded-lg border bg-violet-50 p-4 dark:bg-violet-950/20">
                  <p className="text-sm whitespace-pre-wrap">{generatedCompliment}</p>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="rounded-lg border border-red-300 bg-red-50 p-3 dark:bg-red-950/20">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">{error}</span>
                </div>
              </div>
            )}

            {/* No API Key Warning */}
            {!apiKey && (
              <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-3 dark:bg-yellow-950/20">
                <div className="flex items-start gap-2 text-yellow-700 dark:text-yellow-400">
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                  <div className="text-sm">
                    <strong>API Key fehlt:</strong> Bitte konfiguriere deinen API Key in den{" "}
                    <a href="/settings" className="underline">Einstellungen</a>.
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            {/* Preset */}
            <div className="space-y-2">
              <Label>Vorlage</Label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(PRESET_LABELS) as Preset[]).map((p) => (
                  <div
                    key={p}
                    onClick={() => setPreset(p)}
                    className={cn(
                      "cursor-pointer rounded-lg border p-3 transition-colors",
                      preset === p
                        ? "border-violet-500 bg-violet-50 dark:bg-violet-950/20"
                        : "hover:border-muted-foreground/50"
                    )}
                  >
                    <div className="font-medium text-sm">{PRESET_LABELS[p].label}</div>
                    <div className="text-xs text-muted-foreground">
                      {PRESET_LABELS[p].description}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Settings */}
            {preset === "custom" && (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Ton</Label>
                    <Select value={tone} onValueChange={(v) => setTone(v as Tone)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(TONE_LABELS) as Tone[]).map((t) => (
                          <SelectItem key={t} value={t}>
                            {TONE_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Länge</Label>
                    <Select value={length} onValueChange={(v) => setLength(v as Length)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(LENGTH_LABELS) as Length[]).map((l) => (
                          <SelectItem key={l} value={l}>
                            {LENGTH_LABELS[l]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Fokus</Label>
                    <Select value={focus} onValueChange={(v) => setFocus(v as Focus)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(FOCUS_LABELS) as Focus[]).map((f) => (
                          <SelectItem key={f} value={f}>
                            {FOCUS_LABELS[f]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Platzhalter für Spalten - Drag & Drop */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    Verfügbare Spalten-Platzhalter
                    <Badge variant="outline" className="text-[10px]">Drag & Drop oder Klicken</Badge>
                  </Label>
                  <div className="flex flex-wrap gap-2 p-3 rounded-lg border bg-muted/30">
                    {availableColumns.length > 0 ? (
                      availableColumns.map((col) => (
                        <div
                          key={col.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, col.fieldKey)}
                          onClick={() => insertPlaceholder(col.fieldKey)}
                          className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium",
                            "bg-violet-100 text-violet-700 hover:bg-violet-200",
                            "dark:bg-violet-900/40 dark:text-violet-300 dark:hover:bg-violet-900/60",
                            "transition-colors cursor-grab active:cursor-grabbing select-none"
                          )}
                        >
                          <GripVertical className="h-3 w-3 opacity-50" />
                          <span>{FIELD_LABELS[col.fieldKey] || col.name}</span>
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Keine passenden Spalten gefunden
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Ziehe einen Platzhalter ins Textfeld oder klicke darauf.
                  </p>
                </div>

                {/* Benutzerdefinierte Anweisungen */}
                <div className="space-y-2">
                  <Label>Benutzerdefinierte Anweisungen</Label>
                  <Textarea
                    ref={textareaRef}
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    placeholder={`z.B. "Schreibe ein Kompliment für {{firstName}} {{lastName}} von {{company}}. Erwähne die {{rating}} Sterne Bewertung und beziehe dich auf die Keywords: {{reviewKeywords}}"`}
                    rows={4}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Beispiel: &quot;Hallo {`{{firstName}}`}, ich habe gesehen dass {`{{company}}`} eine {`{{rating}}`}-Sterne Bewertung hat...&quot;
                  </p>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Schließen
          </Button>
          {generatedCompliment && !isBulkMode && (
            <Button
              variant="outline"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isGenerating && "animate-spin")} />
              Neu generieren
            </Button>
          )}
          <Button
            onClick={isBulkMode ? handleBulkGenerate : handleGenerate}
            disabled={isGenerating || !apiKey}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generiere...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                {isBulkMode ? `${rows?.length} Komplimente generieren` : "Kompliment generieren"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
