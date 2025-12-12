import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ColumnType, Prisma } from "@prisma/client";
import { ImportResult } from "@/types/import";
import { notifyImportComplete, notifyImportFailed } from "@/lib/notifications";

// Validation schema
const columnMappingSchema = z.object({
  csvColumn: z.string(),
  csvIndex: z.number().optional(), // Original CSV-Index für korrektes Mapping
  columnName: z.string().min(1),
  columnType: z.nativeEnum(ColumnType),
  position: z.number(),
  include: z.boolean(),
  confidence: z.number().optional(), // Confidence aus intelligenter Erkennung
  detectionReason: z.string().optional(), // Grund für die Erkennung
});

const importConfigSchema = z.object({
  projectId: z.string().optional(),
  projectName: z.string().optional(),
  tableName: z.string().min(1),
  columnMappings: z.array(columnMappingSchema),
  rows: z.array(z.array(z.string())),
});

// Kleinere Batch-Größe für Stabilität bei großen Imports
const BATCH_SIZE = 100;
const CELL_BATCH_SIZE = 5000; // Max Zellen pro Insert

/**
 * Bereinigt einen String von ungültigen JSON-Zeichen
 */
function sanitizeString(str: string): string {
  if (!str) return str;
  if (typeof str !== 'string') return String(str);

  // Entferne oder ersetze ungültige Zeichen
  let sanitized = str
    // Entferne NULL-Bytes
    .replace(/\x00/g, '')
    // Ersetze ungültige Kontrollzeichen (außer Tab, Newline, CR)
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
    // Ersetze ungültige UTF-16 Surrogates
    .replace(/[\uD800-\uDFFF]/g, '')
    // Entferne alle Backslash-Sequenzen die Probleme verursachen könnten
    .replace(/\\x[0-9A-Fa-f]{0,1}(?![0-9A-Fa-f])/g, '')
    .replace(/\\x(?![0-9A-Fa-f]{2})/g, '')
    .replace(/\\u[0-9A-Fa-f]{0,3}(?![0-9A-Fa-f])/g, '')
    .replace(/\\u(?![0-9A-Fa-f]{4})/g, '')
    // Ersetze alleinstehende Backslashes
    .replace(/\\(?!["\\/bfnrtux])/g, '')
    // Entferne nicht-druckbare Zeichen
    .replace(/[\uFFFD\uFFFE\uFFFF]/g, '');

  return sanitized;
}

/**
 * Robuste Wertverarbeitung basierend auf Spaltentyp
 */
function processValue(
  value: string | undefined | null,
  columnType: ColumnType
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  // Leere Werte
  if (value === undefined || value === null) return Prisma.JsonNull;
  const trimmed = sanitizeString(value.trim());
  if (trimmed === "") return Prisma.JsonNull;

  switch (columnType) {
    case ColumnType.NUMBER: {
      // Unterstütze deutsche und internationale Zahlenformate
      let cleaned = trimmed
        .replace(/[€$£¥\s]/g, "") // Währungssymbole und Leerzeichen
        .replace(/'/g, "");       // Schweizer Tausender-Trennzeichen

      // Deutsche Format: 1.234,56 -> 1234.56
      if (/^\d{1,3}(\.\d{3})*,\d+$/.test(cleaned)) {
        cleaned = cleaned.replace(/\./g, "").replace(",", ".");
      }
      // Internationale Format: 1,234.56 -> 1234.56
      else if (/^\d{1,3}(,\d{3})*\.\d+$/.test(cleaned)) {
        cleaned = cleaned.replace(/,/g, "");
      }
      // Deutsches Dezimal ohne Tausender: 123,45 -> 123.45
      else if (/^\d+,\d+$/.test(cleaned)) {
        cleaned = cleaned.replace(",", ".");
      }

      const num = parseFloat(cleaned);
      return isNaN(num) ? Prisma.JsonNull : num;
    }

    case ColumnType.DATE: {
      // Verschiedene Datumsformate unterstützen
      let dateStr = trimmed;

      // Deutsche Format: DD.MM.YYYY -> YYYY-MM-DD
      const germanMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
      if (germanMatch) {
        const [, day, month, year] = germanMatch;
        dateStr = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      }

      // US Format: MM/DD/YYYY -> YYYY-MM-DD
      const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (usMatch) {
        const [, month, day, year] = usMatch;
        dateStr = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      }

      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return Prisma.JsonNull;

      return date.toISOString();
    }

    case ColumnType.SELECT: {
      // Single select: Nur ein Wert
      return trimmed;
    }

    case ColumnType.MULTI_SELECT: {
      // Multi select: Komma-getrennte Werte
      const values = trimmed
        .split(/[,;]/)
        .map((v) => v.trim())
        .filter(Boolean);
      return values.length > 0 ? values : Prisma.JsonNull;
    }

    case ColumnType.STATUS: {
      // Status als String speichern
      return trimmed;
    }

    case ColumnType.URL: {
      // URL validieren und ggf. Protokoll hinzufügen
      let url = trimmed;
      if (url && !url.match(/^https?:\/\//i)) {
        if (url.startsWith("www.")) {
          url = `https://${url}`;
        }
      }
      return url;
    }

    case ColumnType.EMAIL: {
      // Email lowercase
      return trimmed.toLowerCase();
    }

    case ColumnType.PHONE: {
      // Telefonnummer bereinigen aber lesbar lassen
      return trimmed;
    }

    case ColumnType.CONFIDENCE: {
      // Confidence als Prozent oder Dezimalzahl
      let cleaned = trimmed.replace(/%/g, "").trim();
      const num = parseFloat(cleaned);
      if (isNaN(num)) return Prisma.JsonNull;
      // Wenn > 1, dann Prozent -> in Dezimal umwandeln
      return num > 1 ? num / 100 : num;
    }

    case ColumnType.TEXT:
    case ColumnType.PERSON:
    case ColumnType.COMPANY:
    case ColumnType.ADDRESS:
    case ColumnType.AI_GENERATED:
    default:
      return trimmed;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Parse and validate request body
    const body = await request.json();
    const validation = importConfigSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const config = validation.data;

    // Validate that at least one column is included
    const includedMappings = config.columnMappings.filter((m) => m.include);
    if (includedMappings.length === 0) {
      return NextResponse.json(
        { error: "At least one column must be included" },
        { status: 400 }
      );
    }

    // Get or create project
    let projectId = config.projectId;

    if (!projectId) {
      if (!config.projectName) {
        return NextResponse.json(
          { error: "Either projectId or projectName must be provided" },
          { status: 400 }
        );
      }

      // Create new project
      const newProject = await prisma.project.create({
        data: {
          userId,
          name: config.projectName,
          description: `Imported from CSV on ${new Date().toLocaleDateString()}`,
        },
      });
      projectId = newProject.id;
    } else {
      // Verify project ownership
      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!project) {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404 }
        );
      }

      if (project.userId !== userId) {
        return NextResponse.json(
          { error: "Unauthorized access to project" },
          { status: 403 }
        );
      }
    }

    // Step 1: Create table and columns (small transaction)
    const table = await prisma.table.create({
      data: {
        projectId,
        name: config.tableName,
        description: `Imported ${config.rows.length} rows from CSV`,
      },
    });

    // Create columns
    const columns = await prisma.column.createMany({
      data: includedMappings.map((mapping) => ({
        tableId: table.id,
        name: mapping.columnName,
        type: mapping.columnType,
        position: mapping.position,
        width: 200,
        isVisible: true,
      })),
    });

    // Fetch created columns to get IDs
    const createdColumns = await prisma.column.findMany({
      where: { tableId: table.id },
      orderBy: { position: 'asc' },
    });

    // Create column lookup map
    const columnMap = new Map(
      createdColumns.map((col, idx) => [includedMappings[idx].csvColumn, col.id])
    );

    // Step 2: Import rows and cells in small batches (without wrapping transaction)
    const totalRows = config.rows.length;
    let importedRows = 0;
    const importTimestamp = new Date().toISOString();

    for (let i = 0; i < totalRows; i += BATCH_SIZE) {
      const batch = config.rows.slice(i, i + BATCH_SIZE);

      // Create rows for this batch using createMany
      const rowData = batch.map((_, batchIdx) => ({
        tableId: table.id,
        position: i + batchIdx,
      }));

      await prisma.row.createMany({ data: rowData });

      // Fetch the created rows to get IDs
      const rowRecords = await prisma.row.findMany({
        where: {
          tableId: table.id,
          position: { gte: i, lt: i + batch.length },
        },
        orderBy: { position: 'asc' },
      });

      // Create cells for all rows in batch
      const cellData: Array<{
        rowId: string;
        columnId: string;
        value: any;
        metadata: any;
      }> = [];

      for (let rowIdx = 0; rowIdx < rowRecords.length; rowIdx++) {
        const row = rowRecords[rowIdx];
        const csvRow = batch[rowIdx];

        for (const mapping of includedMappings) {
          const columnId = columnMap.get(mapping.csvColumn);
          if (!columnId) continue;

          const csvColumnIndex =
            mapping.csvIndex !== undefined
              ? mapping.csvIndex
              : mapping.position;

          let rawValue: string | undefined;
          if (csvColumnIndex >= 0) {
            rawValue = csvRow[csvColumnIndex];
          } else {
            rawValue = undefined;
          }

          const processedValue = processValue(rawValue, mapping.columnType);

          cellData.push({
            rowId: row.id,
            columnId,
            value: processedValue,
            metadata: {
              source: csvColumnIndex >= 0 ? "csv_import" : "template_empty",
              importedAt: importTimestamp,
            },
          });
        }
      }

      // Insert cells in smaller chunks to avoid memory issues
      for (let c = 0; c < cellData.length; c += CELL_BATCH_SIZE) {
        const cellBatch = cellData.slice(c, c + CELL_BATCH_SIZE);
        await prisma.cell.createMany({ data: cellBatch });
      }

      importedRows += batch.length;
    }

    const result = {
      tableId: table.id,
      projectId,
      rowsImported: importedRows,
    };

    // Send notification for successful import
    await notifyImportComplete(
      userId,
      config.tableName,
      importedRows,
      table.id,
      projectId
    ).catch(err => console.error("Failed to send import notification:", err));

    const response: ImportResult = {
      success: true,
      ...result,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Import confirmation error:", error);

    // Get userId from session if available for notification
    try {
      const session = await auth();
      if (session?.user?.id) {
        const body = await request.clone().json().catch(() => ({}));
        await notifyImportFailed(
          session.user.id,
          body?.tableName || "Unbekannt",
          error instanceof Error ? error.message : "Unknown error"
        ).catch(err => console.error("Failed to send import error notification:", err));
      }
    } catch {
      // Ignore notification errors
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to import data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
