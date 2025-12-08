"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Download, FileSpreadsheet, FileJson, Users, UserX, Filter } from "lucide-react";
import { RowData, ColumnConfig } from "@/types/table";
import {
  CONTACT_FIELDS,
  ContactFieldConfig,
  findColumnForField,
  rowHasFieldData,
} from "@/lib/export";

export type ExportFilterMode = "all" | "with-selected" | "without-selected";

export interface ExportConfig {
  format: "csv" | "json";
  filterMode: ExportFilterMode;
  selectedFields: string[];
  requireAll: boolean;
}

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: RowData[];
  columns: ColumnConfig[];
  tableName: string;
  onExport: (config: ExportConfig) => void;
}

export function ExportDialog({
  open,
  onOpenChange,
  rows,
  columns,
  tableName,
  onExport,
}: ExportDialogProps) {
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [filterMode, setFilterMode] = useState<ExportFilterMode>("all");
  const [selectedFields, setSelectedFields] = useState<string[]>(["email", "phone"]);
  const [requireAll, setRequireAll] = useState(false);

  // Detect which fields are available in the table
  const availableFields = useMemo(() => {
    return CONTACT_FIELDS.filter((field) => {
      const column = findColumnForField(field, columns);
      return column !== undefined;
    });
  }, [columns]);

  // Calculate row counts for each filter option
  const stats = useMemo(() => {
    const total = rows.length;

    if (selectedFields.length === 0) {
      return { total, withSelected: 0, withoutSelected: total };
    }

    const fieldsToCheck = availableFields.filter((f) => selectedFields.includes(f.id));

    const withSelected = rows.filter((row) => {
      if (requireAll) {
        // AND: all selected fields must have data
        return fieldsToCheck.every((field) => rowHasFieldData(row, field, columns));
      } else {
        // OR: at least one selected field must have data
        return fieldsToCheck.some((field) => rowHasFieldData(row, field, columns));
      }
    }).length;

    return {
      total,
      withSelected,
      withoutSelected: total - withSelected,
    };
  }, [rows, columns, selectedFields, requireAll, availableFields]);

  const handleFieldToggle = (fieldId: string) => {
    setSelectedFields((prev) =>
      prev.includes(fieldId)
        ? prev.filter((id) => id !== fieldId)
        : [...prev, fieldId]
    );
  };

  const handleExport = () => {
    onExport({
      format,
      filterMode,
      selectedFields,
      requireAll,
    });
    onOpenChange(false);
  };

  const getExportCount = () => {
    switch (filterMode) {
      case "all":
        return stats.total;
      case "with-selected":
        return stats.withSelected;
      case "without-selected":
        return stats.withoutSelected;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Tabelle exportieren
          </DialogTitle>
          <DialogDescription>
            Exportiere &quot;{tableName}&quot; mit optionalen Filtern für Kontaktdaten.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Format Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Format</Label>
            <RadioGroup
              value={format}
              onValueChange={(v) => setFormat(v as "csv" | "json")}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="csv" id="csv" />
                <Label htmlFor="csv" className="flex items-center gap-2 cursor-pointer">
                  <FileSpreadsheet className="h-4 w-4" />
                  CSV
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="json" id="json" />
                <Label htmlFor="json" className="flex items-center gap-2 cursor-pointer">
                  <FileJson className="h-4 w-4" />
                  JSON
                </Label>
              </div>
            </RadioGroup>
          </div>

          <Separator />

          {/* Filter Mode */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filter
            </Label>
            <RadioGroup
              value={filterMode}
              onValueChange={(v) => setFilterMode(v as ExportFilterMode)}
              className="space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="all" />
                  <Label htmlFor="all" className="cursor-pointer">
                    Alle Zeilen
                  </Label>
                </div>
                <Badge variant="secondary">{stats.total}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="with-selected" id="with-selected" />
                  <Label htmlFor="with-selected" className="flex items-center gap-2 cursor-pointer">
                    <Users className="h-4 w-4 text-green-600" />
                    Mit ausgewählten Kontaktdaten
                  </Label>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-700">
                  {stats.withSelected}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="without-selected" id="without-selected" />
                  <Label htmlFor="without-selected" className="flex items-center gap-2 cursor-pointer">
                    <UserX className="h-4 w-4 text-orange-600" />
                    Ohne ausgewählte Kontaktdaten
                  </Label>
                </div>
                <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                  {stats.withoutSelected}
                </Badge>
              </div>
            </RadioGroup>
          </div>

          {/* Contact Fields Selection */}
          {filterMode !== "all" && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Kontaktfelder auswählen</Label>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="requireAll"
                      checked={requireAll}
                      onCheckedChange={(checked) => setRequireAll(checked === true)}
                    />
                    <Label htmlFor="requireAll" className="text-xs text-muted-foreground cursor-pointer">
                      Alle müssen vorhanden sein
                    </Label>
                  </div>
                </div>

                {availableFields.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Keine Kontaktfelder in dieser Tabelle gefunden.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {availableFields.map((field) => {
                      const column = findColumnForField(field, columns);
                      const rowsWithField = rows.filter((row) =>
                        rowHasFieldData(row, field, columns)
                      ).length;

                      return (
                        <div
                          key={field.id}
                          className="flex items-center space-x-2 p-2 rounded-md border bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          <Checkbox
                            id={field.id}
                            checked={selectedFields.includes(field.id)}
                            onCheckedChange={() => handleFieldToggle(field.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <Label
                              htmlFor={field.id}
                              className="text-sm cursor-pointer block truncate"
                            >
                              {field.label}
                            </Label>
                            <span className="text-xs text-muted-foreground">
                              {column?.name} ({rowsWithField})
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {selectedFields.length === 0 && (
                  <p className="text-sm text-orange-600">
                    Bitte wähle mindestens ein Kontaktfeld aus.
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            onClick={handleExport}
            disabled={filterMode !== "all" && selectedFields.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportieren ({getExportCount()} Zeilen)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
