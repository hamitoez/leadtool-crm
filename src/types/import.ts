import { ColumnType } from "@prisma/client";

export interface CSVParseResult {
  headers: string[];
  rows: string[][];
  totalRows: number;
  previewRows: string[][];
}

export interface ColumnMapping {
  csvColumn: string;
  csvIndex?: number; // Original CSV-Spalten-Index für korrektes Mapping
  columnName: string;
  columnType: ColumnType;
  position: number;
  include: boolean;
}

export interface ImportConfig {
  projectId?: string;
  projectName?: string;
  tableName: string;
  columnMappings: ColumnMapping[];
  totalRows: number;
}

export interface ImportProgress {
  stage: "uploading" | "parsing" | "mapping" | "importing" | "complete";
  progress: number;
  message: string;
}

export interface ImportResult {
  success: boolean;
  tableId?: string;
  projectId?: string;
  rowsImported?: number;
  error?: string;
}
