"use client";

import { useState, useEffect, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Loader2,
  Save,
  X,
  Calendar,
  Hash,
  Type,
  Link as LinkIcon,
  Mail,
  Phone,
  User,
  Building,
  MapPin,
  List,
  Sparkles,
  CheckSquare,
  ExternalLink,
  Copy,
  Check,
  Wand2,
  MessageSquare,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Send,
  Zap,
  Languages,
  FileText,
  PenLine,
  Star,
  Globe,
  Quote,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { ColumnConfig, RowData, CellValue } from "@/types/table";
import { cn } from "@/lib/utils";

interface RowDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: RowData | null;
  columns: ColumnConfig[];
  onCellUpdate?: (cellId: string, value: CellValue) => Promise<void>;
  onClose?: () => void;
}

const columnTypeIcons: Record<string, typeof Type> = {
  TEXT: Type,
  URL: LinkIcon,
  EMAIL: Mail,
  PHONE: Phone,
  NUMBER: Hash,
  DATE: Calendar,
  SELECT: List,
  MULTI_SELECT: List,
  PERSON: User,
  COMPANY: Building,
  ADDRESS: MapPin,
  STATUS: CheckSquare,
  AI_GENERATED: Sparkles,
};

const columnTypeColors: Record<string, { bg: string; text: string; border: string }> = {
  TEXT: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300", border: "border-slate-200 dark:border-slate-700" },
  URL: { bg: "bg-blue-50 dark:bg-blue-950", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800" },
  EMAIL: { bg: "bg-emerald-50 dark:bg-emerald-950", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800" },
  PHONE: { bg: "bg-violet-50 dark:bg-violet-950", text: "text-violet-700 dark:text-violet-300", border: "border-violet-200 dark:border-violet-800" },
  NUMBER: { bg: "bg-amber-50 dark:bg-amber-950", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800" },
  DATE: { bg: "bg-pink-50 dark:bg-pink-950", text: "text-pink-700 dark:text-pink-300", border: "border-pink-200 dark:border-pink-800" },
  SELECT: { bg: "bg-cyan-50 dark:bg-cyan-950", text: "text-cyan-700 dark:text-cyan-300", border: "border-cyan-200 dark:border-cyan-800" },
  MULTI_SELECT: { bg: "bg-indigo-50 dark:bg-indigo-950", text: "text-indigo-700 dark:text-indigo-300", border: "border-indigo-200 dark:border-indigo-800" },
  PERSON: { bg: "bg-orange-50 dark:bg-orange-950", text: "text-orange-700 dark:text-orange-300", border: "border-orange-200 dark:border-orange-800" },
  COMPANY: { bg: "bg-red-50 dark:bg-red-950", text: "text-red-700 dark:text-red-300", border: "border-red-200 dark:border-red-800" },
  ADDRESS: { bg: "bg-teal-50 dark:bg-teal-950", text: "text-teal-700 dark:text-teal-300", border: "border-teal-200 dark:border-teal-800" },
  STATUS: { bg: "bg-lime-50 dark:bg-lime-950", text: "text-lime-700 dark:text-lime-300", border: "border-lime-200 dark:border-lime-800" },
  AI_GENERATED: { bg: "bg-purple-50 dark:bg-purple-950", text: "text-purple-700 dark:text-purple-300", border: "border-purple-200 dark:border-purple-800" },
};

// Quick AI Actions
const AI_QUICK_ACTIONS = [
  { id: "improve", label: "Verbessern", icon: Wand2, prompt: "Verbessere diesen Text und mache ihn professioneller:" },
  { id: "shorten", label: "Kürzen", icon: FileText, prompt: "Kürze diesen Text auf das Wesentliche:" },
  { id: "expand", label: "Erweitern", icon: PenLine, prompt: "Erweitere diesen Text mit mehr Details:" },
  { id: "translate_en", label: "→ Englisch", icon: Languages, prompt: "Übersetze ins Englische:" },
  { id: "translate_de", label: "→ Deutsch", icon: Languages, prompt: "Übersetze ins Deutsche:" },
];

export function RowDetailsSheet({
  open,
  onOpenChange,
  row,
  columns,
  onCellUpdate,
  onClose,
}: RowDetailsSheetProps) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // AI State
  const [aiPrompt, setAiPrompt] = useState<string>("");
  const [aiFieldId, setAiFieldId] = useState<string | null>(null);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["main"]));

  // Review expansion state
  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(new Set());

  // API Key
  const [apiKey, setApiKey] = useState<string>("");
  const [aiProvider, setAiProvider] = useState<string>("anthropic");

  const promptInputRef = useRef<HTMLTextAreaElement>(null);

  // Load API Key
  useEffect(() => {
    const savedConfig = localStorage.getItem("ai_provider_config");
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        setApiKey(config.apiKey || "");
        setAiProvider(config.provider || "anthropic");
      } catch {
        // Fallback
      }
    }
  }, []);

  // Reset state when sheet closes
  useEffect(() => {
    if (!open) {
      setEditingField(null);
      setEditValue("");
      setAiPrompt("");
      setAiFieldId(null);
    }
  }, [open]);

  const toggleSection = (section: string) => {
    const newSections = new Set(expandedSections);
    if (newSections.has(section)) {
      newSections.delete(section);
    } else {
      newSections.add(section);
    }
    setExpandedSections(newSections);
  };

  const handleStartEdit = (columnId: string, currentValue: CellValue) => {
    setEditingField(columnId);
    setEditValue(formatValueForEdit(currentValue));
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValue("");
  };

  const handleSaveEdit = async (columnId: string) => {
    if (!row || !onCellUpdate) return;

    const cell = row.cells[columnId];
    if (!cell) return;

    setIsSaving(true);
    try {
      const column = columns.find((c) => c.id === columnId);
      const parsedValue = parseValueForSave(editValue, column?.type || "TEXT");
      await onCellUpdate(cell.id, parsedValue);
      setEditingField(null);
      setEditValue("");
      toast.success("Feld aktualisiert");
    } catch (error) {
      toast.error("Fehler beim Speichern");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = async (value: string, fieldId: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2000);
      toast.success("Kopiert");
    } catch {
      toast.error("Kopieren fehlgeschlagen");
    }
  };

  // AI Generation
  const handleAiGenerate = async (columnId: string, prompt: string) => {
    if (!apiKey) {
      toast.error("Bitte konfiguriere deinen API Key in den Einstellungen");
      return;
    }

    if (!prompt.trim()) {
      toast.error("Bitte gib einen Prompt ein");
      return;
    }

    const cell = row?.cells[columnId];
    const currentValue = cell?.value ? String(cell.value) : "";

    // Build context from row data
    const context = columns.map(col => {
      const cellData = row?.cells[col.id];
      const val = cellData?.value;
      if (val) {
        return `${col.name}: ${String(val)}`;
      }
      return null;
    }).filter(Boolean).join("\n");

    const fullPrompt = `Kontext über diesen Lead/Eintrag:
${context}

Aktueller Wert des Feldes "${columns.find(c => c.id === columnId)?.name}": ${currentValue || "(leer)"}

Aufgabe: ${prompt}

Antworte NUR mit dem generierten Text, ohne Erklärungen oder Einleitungen.`;

    setIsAiGenerating(true);
    setAiFieldId(columnId);

    try {
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: fullPrompt,
          apiKey,
          provider: aiProvider,
        }),
      });

      if (!response.ok) {
        throw new Error("AI Generation fehlgeschlagen");
      }

      const data = await response.json();
      const generatedText = data.text || data.content || "";

      if (generatedText) {
        setEditingField(columnId);
        setEditValue(generatedText);
        setAiPrompt("");
        toast.success("KI-Text generiert! Prüfe und speichere.");
      }
    } catch (error) {
      toast.error("KI-Generierung fehlgeschlagen");
    } finally {
      setIsAiGenerating(false);
      setAiFieldId(null);
    }
  };

  const handleQuickAction = (columnId: string, actionPrompt: string) => {
    const cell = row?.cells[columnId];
    const currentValue = cell?.value ? String(cell.value) : "";

    if (!currentValue && !actionPrompt.includes("generiere")) {
      toast.error("Feld ist leer - keine Aktion möglich");
      return;
    }

    handleAiGenerate(columnId, `${actionPrompt} "${currentValue}"`);
  };

  const formatValueForEdit = (value: CellValue): string => {
    if (value === null || value === undefined) return "";
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "object") return JSON.stringify(value, null, 2);
    return String(value);
  };

  const parseValueForSave = (value: string, type: string): CellValue => {
    if (!value.trim()) return null;

    switch (type) {
      case "NUMBER":
        const num = parseFloat(value);
        return isNaN(num) ? null : num;
      case "MULTI_SELECT":
        return value.split(",").map((v) => v.trim()).filter(Boolean);
      default:
        return value.trim();
    }
  };

  const formatDisplayValue = (value: CellValue, type: string): string => {
    if (value === null || value === undefined) return "";
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  // Parse JSON review text
  interface ParsedReview {
    id: number;
    text: string;
  }
  interface ParsedReviewData {
    count: number;
    reviews: ParsedReview[];
  }

  const parseReviewJson = (value: string): ParsedReviewData | null => {
    if (!value) return null;
    try {
      const parsed = JSON.parse(value);
      if (parsed.reviews && Array.isArray(parsed.reviews)) {
        return parsed as ParsedReviewData;
      }
    } catch {
      // Not JSON, return null
    }
    return null;
  };

  const isReviewTextField = (columnName: string): boolean => {
    const name = columnName.toLowerCase();
    return name.includes("review text") ||
           name.includes("review_text") ||
           name.includes("reviewtext") ||
           name.includes("rezension");
  };

  const toggleReviewExpansion = (columnId: string) => {
    const newExpanded = new Set(expandedReviews);
    if (newExpanded.has(columnId)) {
      newExpanded.delete(columnId);
    } else {
      newExpanded.add(columnId);
    }
    setExpandedReviews(newExpanded);
  };

  // Render review text as formatted cards
  const renderReviewContent = (column: ColumnConfig, value: CellValue) => {
    const stringValue = value ? String(value) : "";
    const parsedReviews = parseReviewJson(stringValue);
    const isExpanded = expandedReviews.has(column.id);

    if (!parsedReviews || parsedReviews.reviews.length === 0) {
      // Not JSON or empty, show as normal text
      return (
        <span className="text-sm text-muted-foreground italic">
          {stringValue || "Keine Reviews vorhanden"}
        </span>
      );
    }

    const reviewsToShow = isExpanded ? parsedReviews.reviews : parsedReviews.reviews.slice(0, 3);
    const hasMore = parsedReviews.reviews.length > 3;

    return (
      <div className="space-y-3">
        {/* Header with count */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Quote className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium">
              {parsedReviews.count} {parsedReviews.count === 1 ? "Bewertung" : "Bewertungen"}
            </span>
          </div>
          {hasMore && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                toggleReviewExpansion(column.id);
              }}
            >
              {isExpanded ? (
                <>
                  <EyeOff className="h-3 w-3 mr-1" />
                  Weniger
                </>
              ) : (
                <>
                  <Eye className="h-3 w-3 mr-1" />
                  Alle {parsedReviews.count}
                </>
              )}
            </Button>
          )}
        </div>

        {/* Review cards */}
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {reviewsToShow.map((review, index) => (
            <div
              key={review.id || index}
              className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm"
            >
              <div className="flex items-start gap-2">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                    {review.id || index + 1}
                  </span>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed flex-1">
                  "{review.text}"
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Show more indicator */}
        {!isExpanded && hasMore && (
          <p className="text-xs text-muted-foreground text-center">
            + {parsedReviews.count - 3} weitere Bewertungen
          </p>
        )}
      </div>
    );
  };

  // Get company name for header
  const getCompanyName = () => {
    const companyCol = columns.find(c => c.type === "COMPANY" || c.name.toLowerCase().includes("company") || c.name.toLowerCase().includes("firma"));
    if (companyCol && row?.cells[companyCol.id]?.value) {
      return String(row.cells[companyCol.id].value);
    }
    return `Eintrag #${row?.position !== undefined ? row.position + 1 : ""}`;
  };

  // Get rating if exists
  const getRating = () => {
    const ratingCol = columns.find(c => c.name.toLowerCase().includes("rating") || c.name.toLowerCase().includes("bewertung"));
    if (ratingCol && row?.cells[ratingCol.id]?.value) {
      return Number(row.cells[ratingCol.id].value);
    }
    return null;
  };

  // Get website if exists
  const getWebsite = () => {
    const websiteCol = columns.find(c => c.type === "URL" || c.name.toLowerCase().includes("website"));
    if (websiteCol && row?.cells[websiteCol.id]?.value) {
      return String(row.cells[websiteCol.id].value);
    }
    return null;
  };

  const renderFieldCard = (column: ColumnConfig) => {
    const cell = row?.cells[column.id];
    const value = cell?.value ?? null;
    const displayValue = formatDisplayValue(value, column.type);
    const Icon = columnTypeIcons[column.type] || Type;
    const colors = columnTypeColors[column.type] || columnTypeColors.TEXT;
    const isEditing = editingField === column.id;
    const isGeneratingThis = isAiGenerating && aiFieldId === column.id;

    return (
      <Card
        key={column.id}
        className={cn(
          "transition-all duration-200 hover:shadow-md",
          isEditing && "ring-2 ring-primary",
          colors.border,
          "border"
        )}
      >
        <CardContent className="p-4">
          {/* Field Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", colors.bg)}>
                <Icon className={cn("h-4 w-4", colors.text)} />
              </div>
              <div>
                <Label className="font-semibold text-sm">{column.name}</Label>
                <p className="text-xs text-muted-foreground">{column.type.replace("_", " ")}</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1">
              {/* Copy Button */}
              {value && !isEditing && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleCopy(displayValue, column.id)}
                      >
                        {copiedField === column.id ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Kopieren</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {/* AI Menu */}
              {!isEditing && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className={cn(
                        "h-8 w-8",
                        isGeneratingThis && "animate-pulse"
                      )}
                      disabled={isGeneratingThis}
                    >
                      {isGeneratingThis ? (
                        <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                      ) : (
                        <Sparkles className="h-4 w-4 text-purple-600" />
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80" align="end">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-purple-600" />
                        <h4 className="font-semibold">KI-Assistent</h4>
                      </div>

                      {/* Quick Actions */}
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground font-medium">Schnellaktionen</p>
                        <div className="flex flex-wrap gap-1">
                          {AI_QUICK_ACTIONS.map((action) => (
                            <Button
                              key={action.id}
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => handleQuickAction(column.id, action.prompt)}
                              disabled={isAiGenerating}
                            >
                              <action.icon className="h-3 w-3 mr-1" />
                              {action.label}
                            </Button>
                          ))}
                        </div>
                      </div>

                      <Separator />

                      {/* Custom Prompt */}
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground font-medium">Eigener Prompt</p>
                        <Textarea
                          ref={promptInputRef}
                          placeholder="z.B. 'Schreibe ein Kompliment basierend auf den Bewertungen' oder 'Generiere eine Zusammenfassung'"
                          value={aiPrompt}
                          onChange={(e) => setAiPrompt(e.target.value)}
                          className="min-h-[80px] text-sm"
                        />
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => handleAiGenerate(column.id, aiPrompt)}
                          disabled={isAiGenerating || !aiPrompt.trim()}
                        >
                          {isAiGenerating ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4 mr-2" />
                          )}
                          Generieren
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>

          {/* Field Value / Edit Mode */}
          {isEditing ? (
            <div className="space-y-3">
              {column.type === "TEXT" || displayValue.length > 50 ? (
                <Textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="min-h-[120px] font-mono text-sm"
                  autoFocus
                />
              ) : (
                <Input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  type={column.type === "NUMBER" ? "number" : "text"}
                  autoFocus
                />
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleSaveEdit(column.id)}
                  disabled={isSaving}
                  className="flex-1"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Speichern
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                >
                  <X className="h-4 w-4 mr-1" />
                  Abbrechen
                </Button>
              </div>
            </div>
          ) : (
            <div
              className={cn(
                "p-3 rounded-lg cursor-pointer transition-colors min-h-[48px]",
                colors.bg,
                "hover:opacity-80"
              )}
              onClick={() => handleStartEdit(column.id, value)}
            >
              {/* Special rendering */}
              {column.type === "URL" && value ? (
                <a
                  href={String(value)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline flex items-center gap-1 text-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Globe className="h-4 w-4" />
                  {displayValue}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : column.type === "EMAIL" && value ? (
                <a
                  href={`mailto:${value}`}
                  className="text-emerald-600 hover:underline flex items-center gap-1 text-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Mail className="h-4 w-4" />
                  {displayValue}
                </a>
              ) : column.type === "PHONE" && value ? (
                <a
                  href={`tel:${value}`}
                  className="text-violet-600 hover:underline flex items-center gap-1 text-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Phone className="h-4 w-4" />
                  {displayValue}
                </a>
              ) : column.type === "MULTI_SELECT" && Array.isArray(value) ? (
                <div className="flex flex-wrap gap-1">
                  {value.map((v, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {String(v)}
                    </Badge>
                  ))}
                </div>
              ) : column.type === "SELECT" && value ? (
                <Badge variant="secondary">{displayValue}</Badge>
              ) : column.type === "AI_GENERATED" ? (
                <div className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
                  <span className={cn(
                    "text-sm whitespace-pre-wrap",
                    !value && "text-muted-foreground italic"
                  )}>
                    {displayValue || "Klicken zum Generieren mit KI..."}
                  </span>
                </div>
              ) : isReviewTextField(column.name) && value ? (
                // Special rendering for Review Text (JSON)
                <div onClick={(e) => e.stopPropagation()}>
                  {renderReviewContent(column, value)}
                </div>
              ) : (
                <span className={cn(
                  "text-sm whitespace-pre-wrap break-words",
                  !value && "text-muted-foreground italic"
                )}>
                  {displayValue || "Klicken zum Bearbeiten..."}
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (!row) return null;

  const companyName = getCompanyName();
  const rating = getRating();
  const website = getWebsite();

  // Group columns by type
  const mainColumns = columns.filter(c =>
    ["COMPANY", "PERSON", "EMAIL", "PHONE", "URL"].includes(c.type) ||
    c.name.toLowerCase().includes("vorname") ||
    c.name.toLowerCase().includes("nachname")
  );
  const dataColumns = columns.filter(c =>
    ["NUMBER", "SELECT", "STATUS", "DATE", "ADDRESS"].includes(c.type) ||
    c.name.toLowerCase().includes("rating") ||
    c.name.toLowerCase().includes("review")
  );
  const textColumns = columns.filter(c =>
    c.type === "TEXT" && !mainColumns.includes(c) && !dataColumns.includes(c)
  );
  const aiColumns = columns.filter(c => c.type === "AI_GENERATED");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col">
        {/* Header */}
        <div className="p-6 pb-4 border-b bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <SheetTitle className="text-2xl font-bold">{companyName}</SheetTitle>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                {rating !== null && (
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-medium">{rating}</span>
                  </div>
                )}
                {website && (
                  <a
                    href={website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-primary transition-colors"
                  >
                    <Globe className="h-4 w-4" />
                    <span>Website</span>
                  </a>
                )}
                <span>•</span>
                <span>
                  Erstellt {row.createdAt && formatDistanceToNow(new Date(row.createdAt), { addSuffix: true, locale: de })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-6">
            {/* Contact Info Section */}
            {mainColumns.length > 0 && (
              <Collapsible
                open={expandedSections.has("contact")}
                onOpenChange={() => toggleSection("contact")}
                defaultOpen
              >
                <CollapsibleTrigger className="flex items-center gap-2 w-full text-left mb-3 group">
                  {expandedSections.has("contact") ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    Kontaktdaten
                  </h3>
                  <Badge variant="secondary" className="text-xs">
                    {mainColumns.length}
                  </Badge>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3">
                  {mainColumns.map(renderFieldCard)}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Data Section */}
            {dataColumns.length > 0 && (
              <Collapsible
                open={expandedSections.has("data")}
                onOpenChange={() => toggleSection("data")}
                defaultOpen
              >
                <CollapsibleTrigger className="flex items-center gap-2 w-full text-left mb-3 group">
                  {expandedSections.has("data") ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    Daten & Bewertungen
                  </h3>
                  <Badge variant="secondary" className="text-xs">
                    {dataColumns.length}
                  </Badge>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3">
                  {dataColumns.map(renderFieldCard)}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* AI Generated Section */}
            {aiColumns.length > 0 && (
              <Collapsible
                open={expandedSections.has("ai")}
                onOpenChange={() => toggleSection("ai")}
                defaultOpen
              >
                <CollapsibleTrigger className="flex items-center gap-2 w-full text-left mb-3 group">
                  {expandedSections.has("ai") ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-500" />
                    KI-Generiert
                  </h3>
                  <Badge variant="secondary" className="text-xs">
                    {aiColumns.length}
                  </Badge>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3">
                  {aiColumns.map(renderFieldCard)}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Text Fields Section */}
            {textColumns.length > 0 && (
              <Collapsible
                open={expandedSections.has("text")}
                onOpenChange={() => toggleSection("text")}
                defaultOpen
              >
                <CollapsibleTrigger className="flex items-center gap-2 w-full text-left mb-3 group">
                  {expandedSections.has("text") ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    Weitere Felder
                  </h3>
                  <Badge variant="secondary" className="text-xs">
                    {textColumns.length}
                  </Badge>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3">
                  {textColumns.map(renderFieldCard)}
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t bg-muted/30">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>ID: {row.id.slice(0, 8)}...</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {columns.length} Felder
              </Badge>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
