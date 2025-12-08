import { ColumnType } from "@prisma/client";
import { ColumnMapping } from "@/types/import";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Type,
  Link,
  Mail,
  Phone,
  Hash,
  Calendar,
  List,
  User,
  Building,
  MapPin,
  Sparkles,
  CheckSquare,
  AlertCircle,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { detectColumnType, checkDuplicateHeaders } from "@/lib/import/column-detection";

interface ColumnMapperProps {
  headers: string[];
  previewRows: string[][];
  mappings: ColumnMappingWithMeta[];
  onMappingsChange: (mappings: ColumnMappingWithMeta[]) => void;
}

const COLUMN_TYPES = [
  { value: ColumnType.TEXT, label: "Text", icon: Type },
  { value: ColumnType.URL, label: "URL", icon: Link },
  { value: ColumnType.EMAIL, label: "Email", icon: Mail },
  { value: ColumnType.PHONE, label: "Phone", icon: Phone },
  { value: ColumnType.NUMBER, label: "Number", icon: Hash },
  { value: ColumnType.DATE, label: "Date", icon: Calendar },
  { value: ColumnType.SELECT, label: "Select", icon: List },
  { value: ColumnType.MULTI_SELECT, label: "Multi Select", icon: List },
  { value: ColumnType.PERSON, label: "Person", icon: User },
  { value: ColumnType.COMPANY, label: "Company", icon: Building },
  { value: ColumnType.ADDRESS, label: "Address", icon: MapPin },
  { value: ColumnType.STATUS, label: "Status", icon: CheckSquare },
  { value: ColumnType.CONFIDENCE, label: "Confidence", icon: Hash },
  { value: ColumnType.AI_GENERATED, label: "AI Generated", icon: Sparkles },
];

export function ColumnMapper({
  headers,
  previewRows,
  mappings,
  onMappingsChange,
}: ColumnMapperProps) {
  const updateMapping = (
    index: number,
    updates: Partial<ColumnMappingWithMeta>
  ) => {
    const newMappings = [...mappings];
    newMappings[index] = { ...newMappings[index], ...updates };
    onMappingsChange(newMappings);
  };

  const toggleInclude = (index: number) => {
    updateMapping(index, { include: !mappings[index].include });
  };

  const getColumnIcon = (type: ColumnType) => {
    const typeInfo = COLUMN_TYPES.find((t) => t.value === type);
    return typeInfo?.icon || Type;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Column Mapping</CardTitle>
        <CardDescription>
          Map your CSV columns to appropriate data types. Click on a column to
          exclude it from import.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {mappings.map((mapping, index) => {
            const Icon = getColumnIcon(mapping.columnType);
            const columnIndex = headers.indexOf(mapping.csvColumn);
            const sampleValues = previewRows
              .slice(0, 3)
              .map((row) => row[columnIndex] || "");

            return (
              <div
                key={mapping.csvColumn}
                className={`space-y-3 rounded-lg border p-4 transition-opacity ${
                  !mapping.include ? "opacity-50" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={mapping.include}
                      onChange={() => toggleInclude(index)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Badge variant="outline">{mapping.csvColumn}</Badge>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Position: {mapping.position + 1}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`name-${index}`}>Column Name</Label>
                    <Input
                      id={`name-${index}`}
                      value={mapping.columnName}
                      onChange={(e) =>
                        updateMapping(index, { columnName: e.target.value })
                      }
                      disabled={!mapping.include}
                      placeholder="Enter column name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`type-${index}`}>Column Type</Label>
                    <Select
                      value={mapping.columnType}
                      onValueChange={(value) =>
                        updateMapping(index, {
                          columnType: value as ColumnType,
                        })
                      }
                      disabled={!mapping.include}
                    >
                      <SelectTrigger id={`type-${index}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COLUMN_TYPES.map((type) => {
                          const TypeIcon = type.icon;
                          return (
                            <SelectItem key={type.value} value={type.value}>
                              <div className="flex items-center gap-2">
                                <TypeIcon className="h-4 w-4" />
                                {type.label}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {sampleValues.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Sample Values:
                    </Label>
                    <div className="space-y-1">
                      {sampleValues.map((value, idx) => (
                        <div
                          key={idx}
                          className="truncate rounded bg-muted px-2 py-1 text-xs"
                        >
                          {value || <span className="text-muted-foreground">Empty</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 rounded-lg bg-muted p-4">
          <div className="text-sm">
            <div className="font-medium">Import Summary:</div>
            <div className="mt-2 text-muted-foreground">
              {mappings.filter((m) => m.include).length} of {mappings.length}{" "}
              columns will be imported
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export interface ColumnMappingWithMeta extends ColumnMapping {
  csvIndex: number; // Der originale Index in der CSV-Datei
  confidence: number;
  detectionReason: string;
}

export function initializeColumnMappings(
  headers: string[],
  previewRows: string[][]
): ColumnMappingWithMeta[] {
  // Prüfe auf doppelte Header
  const duplicateCheck = checkDuplicateHeaders(headers);

  return headers.map((header, index) => {
    const sampleValues = previewRows
      .map((row) => row[index] || "")
      .filter(v => v.trim() !== "");

    // Verwende die neue, robuste Typ-Erkennung
    const detection = detectColumnType(header, sampleValues, headers);

    // Wenn Header dupliziert ist, füge Index hinzu
    let columnName = header;
    if (duplicateCheck.duplicates.includes(header)) {
      const suggestion = duplicateCheck.suggestions.get(`${header}_${index}`);
      if (suggestion) {
        columnName = suggestion;
      }
    }

    return {
      csvColumn: header,
      csvIndex: index, // WICHTIG: Speichere den originalen CSV-Index
      columnName: columnName,
      columnType: detection.type,
      position: index,
      include: true,
      confidence: detection.confidence,
      detectionReason: detection.reason,
    };
  });
}
