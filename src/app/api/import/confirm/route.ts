import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ColumnType, Prisma } from "@prisma/client";
import { ImportResult } from "@/types/import";

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

// Größere Batch-Größe für bessere Performance
const BATCH_SIZE = 250;

/**
 * Bereinigt einen String von ungültigen JSON-Zeichen
 */
function sanitizeString(str: string): string {
  if (!str) return str;

  // Entferne oder ersetze ungültige Unicode-Zeichen
  let sanitized = str
    // Entferne NULL-Bytes
    .replace(/\x00/g, '')
    // Ersetze ungültige Kontrollzeichen (außer Tab, Newline, CR)
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, ' ')
    // Ersetze ungültige UTF-16 Surrogates
    .replace(/[\uD800-\uDFFF]/g, '')
    // Ersetze unvollständige Backslash-Escapes
    .replace(/\\x[0-9A-Fa-f]?(?![0-9A-Fa-f])/g, '')
    .replace(/\\u[0-9A-Fa-f]{0,3}(?![0-9A-Fa-f])/g, '')
    // Entferne alleinstehende Backslashes vor ungültigen Escape-Zeichen
    .replace(/\\(?!["\\/bfnrtu])/g, '\\\\');

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

    // Create table and columns in a transaction
    // Increase timeout for large imports (default is 5s, we use 120s)
    const result = await prisma.$transaction(
      async (tx) => {
        // Create table
        const table = await tx.table.create({
          data: {
            projectId,
            name: config.tableName,
            description: `Imported ${config.rows.length} rows from CSV`,
          },
        });

        // Create columns
        const columns = await Promise.all(
          includedMappings.map((mapping) =>
            tx.column.create({
              data: {
                tableId: table.id,
                name: mapping.columnName,
                type: mapping.columnType,
                position: mapping.position,
                width: 200,
                isVisible: true,
              },
            })
          )
        );

        // Create column lookup map
        const columnMap = new Map(
          columns.map((col, idx) => [includedMappings[idx].csvColumn, col.id])
        );

        // Batch insert rows and cells
        const totalRows = config.rows.length;
        let importedRows = 0;

        for (let i = 0; i < totalRows; i += BATCH_SIZE) {
          const batch = config.rows.slice(i, i + BATCH_SIZE);

          // Create rows for this batch
          const rowRecords = await Promise.all(
            batch.map((_, batchIdx) =>
              tx.row.create({
                data: {
                  tableId: table.id,
                  position: i + batchIdx,
                },
              })
            )
          );

          // Create cells for all rows in batch
          const cellData = [];

          for (let rowIdx = 0; rowIdx < rowRecords.length; rowIdx++) {
            const row = rowRecords[rowIdx];
            const csvRow = batch[rowIdx];

            for (const mapping of includedMappings) {
              const columnId = columnMap.get(mapping.csvColumn);
              if (!columnId) continue;

              // WICHTIG: Verwende csvIndex wenn vorhanden, sonst position als Fallback
              // csvIndex === -1 bedeutet "leere Spalte" (aus Template ohne CSV-Mapping)
              const csvColumnIndex =
                mapping.csvIndex !== undefined
                  ? mapping.csvIndex
                  : mapping.position;

              // Wenn csvIndex === -1, dann ist es eine leere Spalte (manuell/KI)
              let rawValue: string | undefined;
              if (csvColumnIndex >= 0) {
                rawValue = csvRow[csvColumnIndex];
              } else {
                rawValue = undefined; // Leere Spalte
              }

              // Verwende die robuste processValue Funktion
              const processedValue = processValue(rawValue, mapping.columnType);

              cellData.push({
                rowId: row.id,
                columnId,
                value: processedValue,
                metadata: {
                  source: csvColumnIndex >= 0 ? "csv_import" : "template_empty",
                  importedAt: new Date().toISOString(),
                  originalValue: rawValue?.substring(0, 100), // Speichere Original für Debugging
                },
              });
            }
          }

          // Batch insert cells
          if (cellData.length > 0) {
            await tx.cell.createMany({
              data: cellData,
            });
          }

          importedRows += batch.length;
        }

        return {
          tableId: table.id,
          projectId,
          rowsImported: importedRows,
        };
      },
      {
        timeout: 120000, // 120 seconds for large imports
        maxWait: 10000, // Maximum time to wait for transaction slot
      }
    );

    const response: ImportResult = {
      success: true,
      ...result,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Import confirmation error:", error);
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
