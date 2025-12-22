"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileSpreadsheet,
  X,
  Check,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Database,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Link,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  CSVParseResult,
  ColumnMapping,
  ImportResult,
} from "@/types/import";
import {
  ColumnMapper,
  initializeColumnMappings,
  ColumnMappingWithMeta,
} from "@/components/import/column-mapper";
import { ImportPreview } from "@/components/import/import-preview";
import { validateCSVData, checkDuplicateHeaders } from "@/lib/import/column-detection";
import {
  TemplateSelector,
  TemplateDetails,
} from "@/components/import/template-selector";
import {
  TABLE_TEMPLATES,
  getTemplateById,
  mapCsvToTemplate,
  TableTemplate,
} from "@/lib/import/templates";

type ImportStep = "upload" | "template" | "mapping" | "configure" | "importing" | "complete";

interface Project {
  id: string;
  name: string;
}

export default function ImportPage() {
  const router = useRouter();

  // Step management
  const [currentStep, setCurrentStep] = useState<ImportStep>("upload");

  // Upload step - Haupt-CSV (Leads)
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Upload step - Detail-CSV (Rezensionen) - OPTIONAL
  const [reviewsFile, setReviewsFile] = useState<File | null>(null);
  const [reviewsCsvData, setReviewsCsvData] = useState<CSVParseResult | null>(null);
  const [isUploadingReviews, setIsUploadingReviews] = useState(false);

  // Linking configuration
  const [mainIdColumn, setMainIdColumn] = useState<string>("");
  const [reviewsIdColumn, setReviewsIdColumn] = useState<string>("");
  const [reviewsTextColumn, setReviewsTextColumn] = useState<string>("");

  // CSV data
  const [csvData, setCsvData] = useState<CSVParseResult | null>(null);
  const [columnMappings, setColumnMappings] = useState<ColumnMappingWithMeta[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<Array<{
    row: number;
    column: string;
    value: string;
    error: string;
  }>>([]);

  // Configuration step
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [newProjectName, setNewProjectName] = useState<string>("");
  const [tableName, setTableName] = useState<string>("");
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

  // Import step
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Template selection
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const selectedTemplate = selectedTemplateId ? getTemplateById(selectedTemplateId) : null;

  // Load projects
  useEffect(() => {
    if (currentStep === "configure") {
      loadProjects();
    }
  }, [currentStep]);

  const loadProjects = async () => {
    setIsLoadingProjects(true);
    try {
      const response = await fetch("/api/projects");
      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || []);
      } else {
        toast.error("Fehler beim Laden der Projekte");
      }
    } catch (error) {
      console.error("Error loading projects:", error);
      toast.error("Fehler beim Laden der Projekte");
    } finally {
      setIsLoadingProjects(false);
    }
  };

  // Dropzone
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setFile(file);
      // Auto-generate table name from filename
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      setTableName(nameWithoutExt);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.ms-excel": [".csv", ".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    },
    maxFiles: 1,
  });

  const removeFile = () => {
    setFile(null);
    setCsvData(null);
    setColumnMappings([]);
    setCurrentStep("upload");
  };

  const removeReviewsFile = () => {
    setReviewsFile(null);
    setReviewsCsvData(null);
  };

  // Dropzone für Reviews-CSV
  const onDropReviews = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setReviewsFile(acceptedFiles[0]);
    }
  }, []);

  const {
    getRootProps: getReviewsRootProps,
    getInputProps: getReviewsInputProps,
    isDragActive: isReviewsDragActive,
  } = useDropzone({
    onDrop: onDropReviews,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.ms-excel": [".csv", ".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    },
    maxFiles: 1,
  });

  // Step 1: Upload and parse CSV
  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to upload file");
      }

      setCsvData(result.data);

      // Auto-detect ID column (place_id, id, ID, etc.)
      const idColumnCandidates = ["place_id", "id", "ID", "Id", "placeId", "place-id"];
      const foundIdCol = result.data.headers.find((h: string) =>
        idColumnCandidates.some((c) => h.toLowerCase() === c.toLowerCase())
      );
      if (foundIdCol) {
        setMainIdColumn(foundIdCol);
      }

      // Parse reviews CSV if present
      if (reviewsFile) {
        await parseReviewsCsv();
      }

      toast.success(result.message || "CSV-Datei erfolgreich eingelesen");
      // Gehe zum Template-Auswahl-Step
      setCurrentStep("template");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(
        error instanceof Error ? error.message : "Fehler beim Hochladen der Datei"
      );
    } finally {
      setIsUploading(false);
    }
  };

  // Parse Reviews CSV
  const parseReviewsCsv = async () => {
    if (!reviewsFile) return;

    setIsUploadingReviews(true);
    try {
      const formData = new FormData();
      formData.append("file", reviewsFile);

      const response = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to parse reviews CSV");
      }

      setReviewsCsvData(result.data);

      // Auto-detect columns in reviews CSV
      const idColumnCandidates = ["place_id", "id", "ID", "Id", "placeId", "place-id"];
      const textColumnCandidates = ["review_text", "text", "comment", "review", "bewertung", "rezension", "content"];

      const foundIdCol = result.data.headers.find((h: string) =>
        idColumnCandidates.some((c) => h.toLowerCase() === c.toLowerCase())
      );
      const foundTextCol = result.data.headers.find((h: string) =>
        textColumnCandidates.some((c) => h.toLowerCase().includes(c.toLowerCase()))
      );

      if (foundIdCol) setReviewsIdColumn(foundIdCol);
      if (foundTextCol) setReviewsTextColumn(foundTextCol);

      toast.success("Bewertungs-CSV erfolgreich eingelesen");
    } catch (error) {
      console.error("Reviews upload error:", error);
      toast.error(
        error instanceof Error ? error.message : "Fehler beim Einlesen der Bewertungen"
      );
    } finally {
      setIsUploadingReviews(false);
    }
  };

  // Merge reviews into main CSV data as JSON
  const mergeReviewsIntoLeads = useCallback(() => {
    if (!csvData || !reviewsCsvData || !mainIdColumn || !reviewsIdColumn || !reviewsTextColumn) {
      return csvData;
    }

    const mainIdIndex = csvData.headers.indexOf(mainIdColumn);
    const reviewsIdIndex = reviewsCsvData.headers.indexOf(reviewsIdColumn);
    const reviewsTextIndex = reviewsCsvData.headers.indexOf(reviewsTextColumn);

    if (mainIdIndex === -1 || reviewsIdIndex === -1 || reviewsTextIndex === -1) {
      return csvData;
    }

    // Build a map of ID -> array of review objects
    const reviewsMap = new Map<string, { text: string; index: number }[]>();
    let globalIndex = 0;
    for (const row of reviewsCsvData.rows) {
      const id = row[reviewsIdIndex]?.trim();
      const text = row[reviewsTextIndex]?.trim();
      if (id && text) {
        if (!reviewsMap.has(id)) {
          reviewsMap.set(id, []);
        }
        reviewsMap.get(id)!.push({ text, index: ++globalIndex });
      }
    }

    // Check if "Review Text" column already exists
    let reviewTextColIndex = csvData.headers.indexOf("Review Text");
    const newHeaders = [...csvData.headers];
    if (reviewTextColIndex === -1) {
      newHeaders.push("Review Text");
      reviewTextColIndex = newHeaders.length - 1;
    }

    // Helper function to create JSON for reviews
    const createReviewJson = (reviews: { text: string; index: number }[]): string => {
      if (reviews.length === 0) return "";

      // Create compact JSON structure
      const jsonData = {
        count: reviews.length,
        reviews: reviews.map((r, i) => ({
          id: i + 1,
          text: r.text
        }))
      };

      return JSON.stringify(jsonData);
    };

    // Merge reviews into main rows
    const newRows = csvData.rows.map((row) => {
      const id = row[mainIdIndex]?.trim();
      const reviews = reviewsMap.get(id) || [];
      const newRow = [...row];

      // Ensure row has enough columns
      while (newRow.length < newHeaders.length) {
        newRow.push("");
      }

      // Store reviews as JSON
      newRow[reviewTextColIndex] = createReviewJson(reviews);
      return newRow;
    });

    // Update preview rows too
    const newPreviewRows = csvData.previewRows.map((row) => {
      const id = row[mainIdIndex]?.trim();
      const reviews = reviewsMap.get(id) || [];
      const newRow = [...row];

      while (newRow.length < newHeaders.length) {
        newRow.push("");
      }

      newRow[reviewTextColIndex] = createReviewJson(reviews);
      return newRow;
    });

    return {
      ...csvData,
      headers: newHeaders,
      rows: newRows,
      previewRows: newPreviewRows,
    };
  }, [csvData, reviewsCsvData, mainIdColumn, reviewsIdColumn, reviewsTextColumn]);

  // Step 1.5: Apply template and go to mapping
  const handleApplyTemplate = () => {
    if (!csvData || !selectedTemplateId) {
      toast.error("Bitte wähle eine Vorlage aus");
      return;
    }

    // Merge reviews if available
    const mergedData = mergeReviewsIntoLeads() || csvData;
    setCsvData(mergedData);

    const template = getTemplateById(selectedTemplateId);
    if (!template) return;

    if (selectedTemplateId === "custom") {
      // Benutzerdefiniert: Alle CSV-Spalten übernehmen
      const mappings = initializeColumnMappings(
        mergedData.headers,
        mergedData.previewRows
      );
      setColumnMappings(mappings);
    } else {
      // Template verwenden: Nur definierte Spalten
      // NEU: Übergebe previewRows für intelligente Inhaltserkennung!
      const templateMapping = mapCsvToTemplate(
        mergedData.headers,
        template,
        mergedData.previewRows // Sample-Daten für Analyse
      );
      const mappings: ColumnMappingWithMeta[] = [];

      let position = 0;
      for (const templateCol of template.columns) {
        const mapping = templateMapping.get(templateCol.name);

        if (mapping) {
          // CSV-Spalte gefunden - mit intelligenter Erkennung
          mappings.push({
            csvColumn: mapping.csvHeader,
            csvIndex: mapping.csvIndex,
            columnName: templateCol.name,
            columnType: templateCol.type,
            position: position++,
            include: true,
            confidence: mapping.confidence || 1,
            detectionReason: mapping.reason || `Mapped from template: ${templateCol.csvHeaders.join(", ")}`,
          });
        } else {
          // Keine CSV-Spalte gefunden - Leere Spalte anlegen
          mappings.push({
            csvColumn: `__empty_${templateCol.name}`,
            csvIndex: -1, // Keine CSV-Quelle
            columnName: templateCol.name,
            columnType: templateCol.type,
            position: position++,
            include: true,
            confidence: 1,
            detectionReason: templateCol.aiGenerated
              ? "AI Generated column (empty)"
              : "Manual column (empty)",
          });
        }
      }

      setColumnMappings(mappings);
    }

    setCurrentStep("mapping");
  };

  // Step 2: Proceed to configuration with validation
  const handleProceedToConfig = () => {
    const includedColumns = columnMappings.filter((m) => m.include);
    if (includedColumns.length === 0) {
      toast.error("Bitte wähle mindestens eine Spalte aus");
      return;
    }

    // Validiere die Daten vor dem Fortfahren
    if (csvData) {
      const columnTypes = includedColumns.map((m) => m.columnType);
      const includedHeaders = includedColumns.map((m) => m.csvColumn);

      // Validiere nur die ausgewählten Spalten
      const validation = validateCSVData(
        includedHeaders,
        csvData.previewRows.map((row) =>
          includedColumns.map((m) => row[m.csvIndex] || "")
        ),
        columnTypes
      );

      setValidationWarnings(validation.warnings);
      setValidationErrors(validation.errors);

      // Zeige Warnungen aber blockiere nicht
      if (validation.warnings.length > 0) {
        validation.warnings.forEach((warning) => {
          toast.warning(warning);
        });
      }

      // Bei kritischen Fehlern informieren, aber fortfahren erlauben
      if (validation.errors.length > 0) {
        toast.error(
          `${validation.errors.length} validation issues found. You can still proceed, but data may not import correctly.`
        );
      }
    }

    setCurrentStep("configure");
  };

  // Step 3: Start import
  const handleStartImport = async () => {
    if (!csvData) return;

    // Validate configuration
    if (!selectedProjectId && !newProjectName) {
      toast.error("Bitte wähle ein Projekt aus oder erstelle ein neues");
      return;
    }

    if (!tableName.trim()) {
      toast.error("Bitte gib einen Tabellennamen ein");
      return;
    }

    setCurrentStep("importing");
    setImportProgress(10);

    try {
      const response = await fetch("/api/import/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: selectedProjectId || undefined,
          projectName: newProjectName || undefined,
          tableName: tableName.trim(),
          columnMappings: columnMappings.filter((m) => m.include),
          rows: csvData.rows,
        }),
      });

      setImportProgress(50);

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to import data");
      }

      setImportProgress(100);
      setImportResult(result);
      setCurrentStep("complete");
      toast.success(`${result.rowsImported} Zeilen erfolgreich importiert!`);
    } catch (error) {
      console.error("Import error:", error);
      toast.error(
        error instanceof Error ? error.message : "Fehler beim Import"
      );
      setCurrentStep("configure");
    }
  };

  const handleViewTable = () => {
    if (importResult?.projectId && importResult?.tableId) {
      router.push(
        `/projects/${importResult.projectId}/tables/${importResult.tableId}`
      );
    }
  };

  const handleImportAnother = () => {
    setFile(null);
    setCsvData(null);
    setColumnMappings([]);
    setSelectedProjectId("");
    setNewProjectName("");
    setTableName("");
    setImportResult(null);
    setSelectedTemplateId(null);
    setValidationWarnings([]);
    setValidationErrors([]);
    // Reviews state zurücksetzen
    setReviewsFile(null);
    setReviewsCsvData(null);
    setMainIdColumn("");
    setReviewsIdColumn("");
    setReviewsTextColumn("");
    setCurrentStep("upload");
  };

  const renderStepIndicator = () => {
    const steps = [
      { id: "upload", label: "Upload" },
      { id: "template", label: "Vorlage" },
      { id: "mapping", label: "Spalten" },
      { id: "configure", label: "Konfiguration" },
      { id: "importing", label: "Import" },
      { id: "complete", label: "Fertig" },
    ];

    const currentIndex = steps.findIndex((s) => s.id === currentStep);

    return (
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 font-semibold transition-colors",
                    index <= currentIndex
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted bg-background text-muted-foreground"
                  )}
                >
                  {index < currentIndex ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    index + 1
                  )}
                </div>
                <span
                  className={cn(
                    "mt-2 text-sm",
                    index <= currentIndex
                      ? "font-medium text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "mx-2 h-0.5 flex-1 transition-colors",
                    index < currentIndex ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Daten importieren</h1>
        <p className="text-muted-foreground">
          Lade CSV- oder Excel-Dateien hoch und importiere sie in LeadTool
        </p>
      </div>

      {renderStepIndicator()}

      {/* Step 1: Upload */}
      {currentStep === "upload" && (
        <div className="space-y-6">
          {/* Haupt-CSV (Leads) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Leads Datei (Hauptdatei)
              </CardTitle>
              <CardDescription>
                Deine Haupt-Datei (CSV oder Excel) mit Lead-Daten (Firmen, Kontakte, etc.)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!file ? (
                <div
                  {...getRootProps()}
                  className={cn(
                    "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors",
                    isDragActive
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/25 hover:border-primary"
                  )}
                >
                  <input {...getInputProps()} />
                  <Upload className="h-12 w-12 text-muted-foreground" />
                  <p className="mt-4 text-center text-sm text-muted-foreground">
                    {isDragActive
                      ? "Datei hier ablegen..."
                      : "CSV/Excel-Datei hierher ziehen oder klicken zum Auswählen"}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Unterstützte Formate: .csv, .xlsx, .xls (max 10MB)
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-lg border border-green-500/50 bg-green-50/50 p-4 dark:bg-green-950/20">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-8 w-8 text-green-500" />
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={removeFile}
                    disabled={isUploading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reviews CSV (Optional) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Reviews Datei (Optional)
                <Badge variant="outline" className="ml-2">Optional</Badge>
              </CardTitle>
              <CardDescription>
                Detail-Datei (CSV/Excel) mit Rezensionen/Bewertungstexten. Diese werden über eine ID mit den Leads verknüpft.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!reviewsFile ? (
                <div
                  {...getReviewsRootProps()}
                  className={cn(
                    "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors",
                    isReviewsDragActive
                      ? "border-blue-500 bg-blue-500/5"
                      : "border-muted-foreground/25 hover:border-blue-500"
                  )}
                >
                  <input {...getReviewsInputProps()} />
                  <MessageSquare className="h-10 w-10 text-muted-foreground" />
                  <p className="mt-3 text-center text-sm text-muted-foreground">
                    {isReviewsDragActive
                      ? "Reviews-Datei hier ablegen..."
                      : "Reviews-Datei hierher ziehen (optional)"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Enthält ID-Spalte und Bewertungstexte
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border border-blue-500/50 bg-blue-50/50 p-4 dark:bg-blue-950/20">
                    <div className="flex items-center gap-3">
                      <MessageSquare className="h-8 w-8 text-blue-500" />
                      <div>
                        <p className="font-medium">{reviewsFile.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(reviewsFile.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={removeReviewsFile}
                      disabled={isUploading || isUploadingReviews}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Linking Info */}
                  <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
                    <Link className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium">Verknüpfung über ID</p>
                      <p className="text-muted-foreground">
                        Die Reviews werden über die ID-Spalte (z.B. place_id) mit den Leads verknüpft.
                        Alle Bewertungen eines Leads werden zusammengefasst.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          {file && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  <Button
                    onClick={handleUpload}
                    disabled={isUploading || isUploadingReviews}
                    className="flex-1"
                  >
                    {isUploading || isUploadingReviews ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Datei wird analysiert...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        {reviewsFile ? "Beide Dateien analysieren" : "Datei analysieren"} & Weiter
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      removeFile();
                      removeReviewsFile();
                    }}
                    disabled={isUploading || isUploadingReviews}
                  >
                    Abbrechen
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Step 1.5: Template Selection */}
      {currentStep === "template" && csvData && (
        <div className="space-y-6">
          <TemplateSelector
            selectedTemplate={selectedTemplateId}
            onSelectTemplate={setSelectedTemplateId}
          />

          {selectedTemplate && selectedTemplate.columns.length > 0 && (
            <TemplateDetails template={selectedTemplate} />
          )}

          {/* Reviews Linking Configuration */}
          {reviewsCsvData && (
            <Card className="border-blue-500/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Link className="h-4 w-4 text-blue-500" />
                  Reviews verknüpfen
                </CardTitle>
                <CardDescription>
                  Wähle die Spalten für die Verknüpfung zwischen Leads und Reviews
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Leads ID Column */}
                  <div className="space-y-2">
                    <Label htmlFor="mainIdCol">ID-Spalte (Leads CSV)</Label>
                    <Select value={mainIdColumn} onValueChange={setMainIdColumn}>
                      <SelectTrigger id="mainIdCol">
                        <SelectValue placeholder="Wähle ID-Spalte" />
                      </SelectTrigger>
                      <SelectContent>
                        {csvData.headers.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Reviews ID Column */}
                  <div className="space-y-2">
                    <Label htmlFor="reviewsIdCol">ID-Spalte (Reviews CSV)</Label>
                    <Select value={reviewsIdColumn} onValueChange={setReviewsIdColumn}>
                      <SelectTrigger id="reviewsIdCol">
                        <SelectValue placeholder="Wähle ID-Spalte" />
                      </SelectTrigger>
                      <SelectContent>
                        {reviewsCsvData.headers.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Review Text Column */}
                  <div className="space-y-2">
                    <Label htmlFor="reviewsTextCol">Text-Spalte (Reviews CSV)</Label>
                    <Select value={reviewsTextColumn} onValueChange={setReviewsTextColumn}>
                      <SelectTrigger id="reviewsTextCol">
                        <SelectValue placeholder="Wähle Text-Spalte" />
                      </SelectTrigger>
                      <SelectContent>
                        {reviewsCsvData.headers.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Info */}
                <div className="flex items-start gap-2 rounded-lg bg-blue-50/50 p-3 text-sm dark:bg-blue-950/20">
                  <MessageSquare className="h-4 w-4 text-blue-500 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-muted-foreground">
                      <strong>{reviewsCsvData.totalRows}</strong> Reviews werden mit den Leads zusammengeführt.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Format: JSON-komprimiert in einer Spalte &quot;Review Text&quot;
                      <br />
                      <code className="bg-muted px-1 rounded text-[10px]">
                        {`{"count":3,"reviews":[{"id":1,"text":"..."},...]}`}
                      </code>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Datei Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Datei Info</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Spalten:</span>{" "}
                  <Badge variant="secondary">{csvData.headers.length}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Zeilen:</span>{" "}
                  <Badge variant="secondary">{csvData.totalRows}</Badge>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {csvData.headers.slice(0, 10).map((header) => (
                  <Badge key={header} variant="outline" className="text-xs">
                    {header}
                  </Badge>
                ))}
                {csvData.headers.length > 10 && (
                  <Badge variant="outline" className="text-xs">
                    +{csvData.headers.length - 10} mehr
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setCurrentStep("upload")}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Zurück
            </Button>
            <Button
              onClick={handleApplyTemplate}
              disabled={!selectedTemplateId || (reviewsCsvData !== null && (!mainIdColumn || !reviewsIdColumn || !reviewsTextColumn))}
            >
              {reviewsCsvData ? "Reviews zusammenführen & Weiter" : "Weiter"}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Column Mapping */}
      {currentStep === "mapping" && csvData && (
        <div className="space-y-6">
          <ColumnMapper
            headers={csvData.headers}
            previewRows={csvData.previewRows}
            mappings={columnMappings}
            onMappingsChange={setColumnMappings}
          />

          <ImportPreview
            headers={csvData.headers}
            previewRows={csvData.previewRows}
            totalRows={csvData.totalRows}
            mappings={columnMappings}
          />

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setCurrentStep("template")}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Zurück
            </Button>
            <Button onClick={handleProceedToConfig}>
              Weiter
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Configure */}
      {currentStep === "configure" && csvData && (
        <Card>
          <CardHeader>
            <CardTitle>Configure Import</CardTitle>
            <CardDescription>
              Select a project and table name for your imported data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Project</Label>
                <Select
                  value={selectedProjectId}
                  onValueChange={(value) => {
                    setSelectedProjectId(value);
                    if (value) setNewProjectName("");
                  }}
                  disabled={isLoadingProjects}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select existing project or create new" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or create new project
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="newProject">New Project Name</Label>
                <Input
                  id="newProject"
                  value={newProjectName}
                  onChange={(e) => {
                    setNewProjectName(e.target.value);
                    if (e.target.value) setSelectedProjectId("");
                  }}
                  placeholder="Enter new project name"
                  disabled={!!selectedProjectId}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tableName">Table Name *</Label>
                <Input
                  id="tableName"
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  placeholder="Enter table name"
                  required
                />
              </div>
            </div>

            {/* Validation Warnings */}
            {validationWarnings.length > 0 && (
              <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-950/20">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                  <div className="flex-1 text-sm">
                    <div className="font-medium text-yellow-800 dark:text-yellow-200">
                      Warnings ({validationWarnings.length})
                    </div>
                    <ul className="mt-2 list-disc list-inside space-y-1 text-yellow-700 dark:text-yellow-300">
                      {validationWarnings.map((warning, i) => (
                        <li key={i}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <div className="rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/20">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  <div className="flex-1 text-sm">
                    <div className="font-medium text-red-800 dark:text-red-200">
                      Validierungsfehler ({validationErrors.length})
                    </div>
                    <div className="mt-2 max-h-32 overflow-y-auto">
                      <ul className="space-y-1 text-red-700 dark:text-red-300">
                        {validationErrors.slice(0, 10).map((err, i) => (
                          <li key={i} className="text-xs">
                            Zeile {err.row}, {err.column}: {err.error} ({err.value})
                          </li>
                        ))}
                        {validationErrors.length > 10 && (
                          <li className="text-xs font-medium">
                            ... und {validationErrors.length - 10} weitere Fehler
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-lg bg-muted p-4">
              <div className="flex items-start gap-3">
                <Database className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1 text-sm">
                  <div className="font-medium">Import Summary</div>
                  <div className="mt-2 space-y-1 text-muted-foreground">
                    <div>
                      Columns: {columnMappings.filter((m) => m.include).length}
                    </div>
                    <div>Rows: {csvData.totalRows}</div>
                    <div>
                      Project:{" "}
                      {selectedProjectId
                        ? projects.find((p) => p.id === selectedProjectId)
                            ?.name
                        : newProjectName || "Not selected"}
                    </div>
                    <div>Table: {tableName || "Not set"}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setCurrentStep("mapping")}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleStartImport}>
                <Upload className="mr-2 h-4 w-4" />
                Start Import
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Importing */}
      {currentStep === "importing" && (
        <Card>
          <CardHeader>
            <CardTitle>Importing Data</CardTitle>
            <CardDescription>
              Please wait while we import your data...
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-16 w-16 animate-spin text-primary" />
              <p className="mt-4 text-lg font-medium">Importing data...</p>
              <p className="text-sm text-muted-foreground">
                This may take a few moments
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{importProgress}%</span>
              </div>
              <Progress value={importProgress} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Complete */}
      {currentStep === "complete" && importResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {importResult.success ? (
                <>
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                  Import Successful
                </>
              ) : (
                <>
                  <AlertCircle className="h-6 w-6 text-red-500" />
                  Import Failed
                </>
              )}
            </CardTitle>
            <CardDescription>
              {importResult.success
                ? "Your data has been imported successfully"
                : "There was an error importing your data"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {importResult.success ? (
              <>
                <div className="rounded-lg border bg-green-50 p-6 dark:bg-green-950/20">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Rows Imported</span>
                      <Badge variant="secondary" className="text-lg">
                        {importResult.rowsImported}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Table Created</span>
                      <Badge variant="outline">{tableName}</Badge>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button onClick={handleViewTable} className="flex-1">
                    <Database className="mr-2 h-4 w-4" />
                    View Table
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleImportAnother}
                    className="flex-1"
                  >
                    Import Another File
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-lg border bg-red-50 p-6 dark:bg-red-950/20">
                  <p className="text-sm text-red-900 dark:text-red-100">
                    {importResult.error || "An unknown error occurred"}
                  </p>
                </div>

                <Button onClick={handleImportAnother} className="w-full">
                  Try Again
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
