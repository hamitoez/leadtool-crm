import { RowData, ColumnConfig, CellValue } from "@/types/table";

// Helper to convert CellValue to string for export
const cellValueToString = (value: CellValue): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(v => cellValueToString(v as CellValue)).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

// Escape CSV value (handle quotes and commas)
const escapeCSVValue = (value: string): string => {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

// Contact data column types
const CONTACT_COLUMN_TYPES = ["EMAIL", "PHONE", "ADDRESS"];

// Check if a row has contact data (email or phone) - legacy function
const rowHasContactData = (row: RowData, columns: ColumnConfig[]): boolean => {
  const contactColumns = columns.filter(col =>
    CONTACT_COLUMN_TYPES.includes(col.type) ||
    col.name.toLowerCase().includes("email") ||
    col.name.toLowerCase().includes("e-mail") ||
    col.name.toLowerCase().includes("phone") ||
    col.name.toLowerCase().includes("telefon")
  );

  return contactColumns.some(col => {
    const cell = row.cells[col.id];
    if (!cell) return false;
    const value = cellValueToString(cell.value);
    return value.trim() !== "";
  });
};

// Contact field definitions for advanced filtering
export interface ContactFieldConfig {
  id: string;
  label: string;
  columnTypes: string[];
  columnNamePatterns: string[];
}

export const CONTACT_FIELDS: ContactFieldConfig[] = [
  {
    id: "email",
    label: "E-Mail",
    columnTypes: ["EMAIL"],
    columnNamePatterns: ["email", "e-mail", "mail"],
  },
  {
    id: "phone",
    label: "Telefon",
    columnTypes: ["PHONE"],
    columnNamePatterns: ["phone", "telefon", "tel", "handy", "mobil"],
  },
  {
    id: "firstName",
    label: "Vorname",
    columnTypes: ["PERSON", "TEXT"],
    columnNamePatterns: ["vorname", "firstname", "first name", "first_name"],
  },
  {
    id: "lastName",
    label: "Nachname",
    columnTypes: ["PERSON", "TEXT"],
    columnNamePatterns: ["nachname", "lastname", "last name", "last_name", "familienname"],
  },
  {
    id: "fullName",
    label: "Name (Vollständig)",
    columnTypes: ["PERSON", "TEXT"],
    columnNamePatterns: ["name", "kontakt", "ansprechpartner", "contact"],
  },
  {
    id: "address",
    label: "Adresse",
    columnTypes: ["ADDRESS", "TEXT"],
    columnNamePatterns: ["adresse", "address", "anschrift", "strasse", "street"],
  },
];

// Find column for a contact field
export const findColumnForField = (
  field: ContactFieldConfig,
  columns: ColumnConfig[]
): ColumnConfig | undefined => {
  // First try to match by column type AND name pattern (more specific)
  const byTypeAndName = columns.find((col) => {
    const colNameLower = col.name.toLowerCase();
    return field.columnTypes.includes(col.type) &&
      field.columnNamePatterns.some((pattern) => colNameLower.includes(pattern));
  });
  if (byTypeAndName) return byTypeAndName;

  // Then try to match by name pattern only
  const byName = columns.find((col) => {
    const colNameLower = col.name.toLowerCase();
    return field.columnNamePatterns.some((pattern) => colNameLower.includes(pattern));
  });
  if (byName) return byName;

  // Finally try to match by column type only (less specific)
  return columns.find((col) => field.columnTypes.includes(col.type));
};

// Check if a cell has a non-empty value
const cellHasValue = (value: CellValue): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (typeof value === "number") return true;
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

// Check if a row has data for a specific contact field
export const rowHasFieldData = (
  row: RowData,
  field: ContactFieldConfig,
  columns: ColumnConfig[]
): boolean => {
  const column = findColumnForField(field, columns);
  if (!column) return false;

  const cell = row.cells[column.id];
  return cell ? cellHasValue(cell.value) : false;
};

// Advanced filter for rows based on selected contact fields
export const filterRowsBySelectedFields = (
  rows: RowData[],
  columns: ColumnConfig[],
  selectedFieldIds: string[],
  requireAll: boolean,
  mode: "with" | "without"
): RowData[] => {
  if (selectedFieldIds.length === 0) return rows;

  const fieldsToCheck = CONTACT_FIELDS.filter((f) => selectedFieldIds.includes(f.id));

  return rows.filter((row) => {
    let hasSelectedData: boolean;

    if (requireAll) {
      // AND: all selected fields must have data
      hasSelectedData = fieldsToCheck.every((field) => rowHasFieldData(row, field, columns));
    } else {
      // OR: at least one selected field must have data
      hasSelectedData = fieldsToCheck.some((field) => rowHasFieldData(row, field, columns));
    }

    return mode === "with" ? hasSelectedData : !hasSelectedData;
  });
};

export type ContactDataFilter = "all" | "with-contact" | "without-contact";

export interface ExportOptions {
  format: "csv" | "json";
  includeHeaders?: boolean;
  columns?: string[]; // Specific column IDs to export
  contactDataFilter?: ContactDataFilter; // Legacy filter by contact data presence
  // Advanced filtering
  selectedFieldIds?: string[];
  requireAll?: boolean;
  filterMode?: "all" | "with-selected" | "without-selected";
}

// Filter rows based on contact data presence
const filterRowsByContactData = (
  rows: RowData[],
  columns: ColumnConfig[],
  filter: ContactDataFilter
): RowData[] => {
  if (filter === "all") return rows;

  return rows.filter(row => {
    const hasContact = rowHasContactData(row, columns);
    return filter === "with-contact" ? hasContact : !hasContact;
  });
};

// Apply filters to rows based on options
const applyRowFilters = (
  rows: RowData[],
  columns: ColumnConfig[],
  options: ExportOptions
): RowData[] => {
  const { contactDataFilter, filterMode, selectedFieldIds, requireAll } = options;

  // Use advanced filtering if specified
  if (filterMode && filterMode !== "all" && selectedFieldIds && selectedFieldIds.length > 0) {
    const mode = filterMode === "with-selected" ? "with" : "without";
    return filterRowsBySelectedFields(rows, columns, selectedFieldIds, requireAll || false, mode);
  }

  // Fall back to legacy filtering
  if (contactDataFilter && contactDataFilter !== "all") {
    return filterRowsByContactData(rows, columns, contactDataFilter);
  }

  return rows;
};

export function exportToCSV(
  rows: RowData[],
  columns: ColumnConfig[],
  options: ExportOptions = { format: "csv", includeHeaders: true }
): string {
  const { includeHeaders = true, columns: selectedColumnIds } = options;

  // Filter columns if specific ones are requested
  const exportColumns = selectedColumnIds
    ? columns.filter((col) => selectedColumnIds.includes(col.id))
    : columns;

  // Apply row filters
  const filteredRows = applyRowFilters(rows, columns, options);

  const lines: string[] = [];

  // Add header row
  if (includeHeaders) {
    const headerRow = exportColumns.map((col) => escapeCSVValue(col.name)).join(",");
    lines.push(headerRow);
  }

  // Add data rows
  for (const row of filteredRows) {
    const rowData = exportColumns.map((col) => {
      const cell = row.cells[col.id];
      const value = cell ? cellValueToString(cell.value) : "";
      return escapeCSVValue(value);
    });
    lines.push(rowData.join(","));
  }

  return lines.join("\n");
}

export function exportToJSON(
  rows: RowData[],
  columns: ColumnConfig[],
  options: ExportOptions = { format: "json" }
): string {
  const { columns: selectedColumnIds } = options;

  // Filter columns if specific ones are requested
  const exportColumns = selectedColumnIds
    ? columns.filter((col) => selectedColumnIds.includes(col.id))
    : columns;

  // Apply row filters
  const filteredRows = applyRowFilters(rows, columns, options);

  const exportData = filteredRows.map((row) => {
    const rowObj: Record<string, string | number | boolean | null> = {};
    for (const col of exportColumns) {
      const cell = row.cells[col.id];
      const value = cell?.value;
      if (value === null || value === undefined) {
        rowObj[col.name] = null;
      } else if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        rowObj[col.name] = value;
      } else {
        rowObj[col.name] = cellValueToString(value);
      }
    }
    return rowObj;
  });

  return JSON.stringify(exportData, null, 2);
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportTable(
  rows: RowData[],
  columns: ColumnConfig[],
  tableName: string,
  format: "csv" | "json" = "csv",
  contactDataFilter: ContactDataFilter = "all"
): void {
  const timestamp = new Date().toISOString().split("T")[0];

  // Add suffix based on filter
  let filterSuffix = "";
  if (contactDataFilter === "with-contact") {
    filterSuffix = "_mit-kontakt";
  } else if (contactDataFilter === "without-contact") {
    filterSuffix = "_ohne-kontakt";
  }

  const filename = `${tableName.toLowerCase().replace(/\s+/g, "-")}${filterSuffix}_${timestamp}`;

  const options: ExportOptions = {
    format,
    includeHeaders: true,
    contactDataFilter,
  };

  if (format === "csv") {
    const content = exportToCSV(rows, columns, options);
    downloadFile(content, `${filename}.csv`, "text/csv;charset=utf-8;");
  } else {
    const content = exportToJSON(rows, columns, options);
    downloadFile(content, `${filename}.json`, "application/json");
  }
}

// Get count of rows with/without contact data (for UI display)
export function getContactDataStats(rows: RowData[], columns: ColumnConfig[]): {
  total: number;
  withContact: number;
  withoutContact: number;
} {
  const withContact = rows.filter(row => rowHasContactData(row, columns)).length;
  return {
    total: rows.length,
    withContact,
    withoutContact: rows.length - withContact,
  };
}

// Export config type matching the dialog
export interface ExportDialogConfig {
  format: "csv" | "json";
  filterMode: "all" | "with-selected" | "without-selected";
  selectedFields: string[];
  requireAll: boolean;
}

// Advanced export function with dialog config
export function exportTableAdvanced(
  rows: RowData[],
  columns: ColumnConfig[],
  tableName: string,
  config: ExportDialogConfig
): void {
  const timestamp = new Date().toISOString().split("T")[0];

  // Build filename suffix based on filter
  let filterSuffix = "";
  if (config.filterMode === "with-selected") {
    const fieldLabels = config.selectedFields
      .map(id => CONTACT_FIELDS.find(f => f.id === id)?.label || id)
      .join("-");
    filterSuffix = `_mit-${fieldLabels.toLowerCase().replace(/\s+/g, "-")}`;
  } else if (config.filterMode === "without-selected") {
    const fieldLabels = config.selectedFields
      .map(id => CONTACT_FIELDS.find(f => f.id === id)?.label || id)
      .join("-");
    filterSuffix = `_ohne-${fieldLabels.toLowerCase().replace(/\s+/g, "-")}`;
  }

  // Truncate suffix if too long
  if (filterSuffix.length > 50) {
    filterSuffix = filterSuffix.substring(0, 47) + "...";
  }

  const filename = `${tableName.toLowerCase().replace(/\s+/g, "-")}${filterSuffix}_${timestamp}`;

  const options: ExportOptions = {
    format: config.format,
    includeHeaders: true,
    filterMode: config.filterMode,
    selectedFieldIds: config.selectedFields,
    requireAll: config.requireAll,
  };

  if (config.format === "csv") {
    const content = exportToCSV(rows, columns, options);
    downloadFile(content, `${filename}.csv`, "text/csv;charset=utf-8;");
  } else {
    const content = exportToJSON(rows, columns, options);
    downloadFile(content, `${filename}.json`, "application/json");
  }
}
