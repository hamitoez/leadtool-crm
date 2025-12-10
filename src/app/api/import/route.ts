import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import ExcelJS from "exceljs";
import { auth } from "@/lib/auth";
import { CSVParseResult } from "@/types/import";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const PREVIEW_ROWS = 10;

// Supported file extensions
const SUPPORTED_EXTENSIONS = [".csv", ".xlsx", ".xls"];

function getFileExtension(filename: string): string {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
  return ext;
}

function isExcelFile(filename: string): boolean {
  const ext = getFileExtension(filename);
  return ext === ".xlsx" || ext === ".xls";
}

function isCsvFile(filename: string): boolean {
  return getFileExtension(filename) === ".csv";
}

/**
 * Convert Excel cell value to string
 * ExcelJS returns complex objects for certain cell types (hyperlinks, rich text, etc.)
 */
function cellValueToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) {
    return "";
  }

  // Simple types
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  // Date objects
  if (value instanceof Date) {
    return value.toISOString().split("T")[0]; // YYYY-MM-DD format
  }

  // Complex types (objects)
  if (typeof value === "object") {
    // Hyperlink: { text: string, hyperlink: string }
    if ("hyperlink" in value && value.hyperlink) {
      // Return the hyperlink URL, or the text if no hyperlink
      return String(value.hyperlink).trim();
    }
    if ("text" in value && value.text) {
      return String(value.text).trim();
    }

    // Rich text: { richText: Array<{ text: string }> }
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText
        .map((rt: { text?: string }) => rt.text || "")
        .join("")
        .trim();
    }

    // Formula result: { result: value, formula: string }
    if ("result" in value) {
      return cellValueToString(value.result as ExcelJS.CellValue);
    }

    // Error value: { error: string }
    if ("error" in value) {
      return "";
    }

    // SharedString or other object - try to get string representation
    if ("toString" in value && typeof value.toString === "function") {
      const str = value.toString();
      if (str !== "[object Object]") {
        return str.trim();
      }
    }

    // Last resort: try to find any text-like property
    const obj = value as unknown as Record<string, unknown>;
    if (obj.value !== undefined) {
      return cellValueToString(obj.value as ExcelJS.CellValue);
    }
  }

  return "";
}

/**
 * Parse Excel file (.xlsx or .xls)
 */
async function parseExcelFile(file: File): Promise<{ headers: string[]; rows: string[][] }> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  // Get first sheet
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("Excel-Datei enthält keine Arbeitsblätter");
  }

  const headers: string[] = [];
  const rows: string[][] = [];
  let maxColumns = 0;

  // First pass: determine the number of columns from the header row
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const value = cellValueToString(cell.value);
    headers.push(value);
    maxColumns = Math.max(maxColumns, colNumber);
  });

  // If headers are empty, try to detect columns from data
  if (headers.length === 0 || headers.every(h => !h)) {
    throw new Error("Excel-Datei enthält keine Spaltenüberschriften");
  }

  // Second pass: get all data rows
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header row

    const rowValues: string[] = [];

    // Iterate through all columns up to maxColumns
    for (let colIndex = 1; colIndex <= maxColumns; colIndex++) {
      const cell = row.getCell(colIndex);
      rowValues.push(cellValueToString(cell.value));
    }

    // Pad row to match header length if needed
    while (rowValues.length < headers.length) {
      rowValues.push("");
    }

    rows.push(rowValues);
  });

  if (headers.length === 0) {
    throw new Error("Excel-Datei enthält keine Daten");
  }

  return { headers, rows };
}

/**
 * Parse CSV file
 */
async function parseCsvFile(file: File): Promise<{ headers: string[]; rows: string[][]; encoding: string }> {
  const fileContent = await file.text();
  let parseResult: Papa.ParseResult<string[]> | null = null;
  let usedEncoding = "UTF-8";

  try {
    // Try UTF-8 first
    parseResult = Papa.parse<string[]>(fileContent, {
      header: false,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      transform: (value) => value.trim(),
    });

    // If parsing fails or no data, try ISO-8859-1
    if (!parseResult.data || parseResult.data.length === 0) {
      throw new Error("No data parsed");
    }
  } catch {
    // Fallback to ISO-8859-1 encoding
    const decoder = new TextDecoder("ISO-8859-1");
    const arrayBuffer = await file.arrayBuffer();
    const decodedContent = decoder.decode(arrayBuffer);

    parseResult = Papa.parse<string[]>(decodedContent, {
      header: false,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      transform: (value) => value.trim(),
    });
    usedEncoding = "ISO-8859-1";
  }

  if (!parseResult || parseResult.errors.length > 0) {
    throw new Error(
      `CSV-Parsing fehlgeschlagen: ${parseResult?.errors.map((e) => e.message).join(", ")}`
    );
  }

  const data = parseResult.data;

  if (data.length < 2) {
    throw new Error("CSV-Datei muss mindestens eine Kopfzeile und eine Datenzeile enthalten");
  }

  const headers = data[0];
  const rows = data.slice(1);

  return { headers, rows, encoding: usedEncoding };
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get form data
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "Keine Datei hochgeladen" }, { status: 400 });
    }

    // Validate file type
    const fileExtension = getFileExtension(file.name);
    if (!SUPPORTED_EXTENSIONS.includes(fileExtension)) {
      return NextResponse.json(
        { error: `Ungültiger Dateityp. Erlaubt sind: ${SUPPORTED_EXTENSIONS.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Dateigröße überschreitet 10MB Limit" },
        { status: 400 }
      );
    }

    let headers: string[];
    let rows: string[][];
    let fileType: "csv" | "excel";
    let encoding = "UTF-8";

    // Parse based on file type
    if (isExcelFile(file.name)) {
      const result = await parseExcelFile(file);
      headers = result.headers;
      rows = result.rows;
      fileType = "excel";
    } else if (isCsvFile(file.name)) {
      const result = await parseCsvFile(file);
      headers = result.headers;
      rows = result.rows;
      encoding = result.encoding;
      fileType = "csv";
    } else {
      return NextResponse.json(
        { error: "Nicht unterstütztes Dateiformat" },
        { status: 400 }
      );
    }

    // Validate headers
    if (headers.length === 0 || headers.every((h) => !h || h.trim() === "")) {
      return NextResponse.json(
        { error: "Datei enthält keine Spaltenüberschriften" },
        { status: 400 }
      );
    }

    // Filter out empty rows
    const validRows = rows.filter((row) =>
      row.some((cell) => cell && cell.trim() !== "")
    );

    if (validRows.length === 0) {
      return NextResponse.json(
        { error: "Datei enthält keine gültigen Datenzeilen" },
        { status: 400 }
      );
    }

    // Prepare response
    const result: CSVParseResult = {
      headers,
      rows: validRows,
      totalRows: validRows.length,
      previewRows: validRows.slice(0, PREVIEW_ROWS),
    };

    return NextResponse.json({
      success: true,
      data: result,
      fileType,
      encoding,
      message: `${validRows.length} Zeilen mit ${headers.length} Spalten erfolgreich ${fileType === "excel" ? "aus Excel" : "aus CSV"} eingelesen`,
    });
  } catch (error) {
    console.error("File upload error:", error);
    return NextResponse.json(
      {
        error: "Fehler beim Verarbeiten der Datei",
        details: error instanceof Error ? error.message : "Unbekannter Fehler",
      },
      { status: 500 }
    );
  }
}
