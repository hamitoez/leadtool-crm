import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import * as XLSX from "xlsx";
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
 * Parse Excel file (.xlsx or .xls)
 */
async function parseExcelFile(file: File): Promise<{ headers: string[]; rows: string[][] }> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });

  // Get first sheet
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("Excel-Datei enthält keine Arbeitsblätter");
  }

  const worksheet = workbook.Sheets[firstSheetName];

  // Convert to JSON with header option
  const jsonData = XLSX.utils.sheet_to_json<string[]>(worksheet, {
    header: 1, // Return array of arrays
    defval: "", // Default value for empty cells
    blankrows: false, // Skip blank rows
  });

  if (!jsonData || jsonData.length === 0) {
    throw new Error("Excel-Datei enthält keine Daten");
  }

  // First row is headers
  const headers = (jsonData[0] as string[]).map((h) =>
    h !== null && h !== undefined ? String(h).trim() : ""
  );

  // Rest are data rows
  const rows = jsonData.slice(1).map((row) =>
    (row as string[]).map((cell) =>
      cell !== null && cell !== undefined ? String(cell).trim() : ""
    )
  );

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
