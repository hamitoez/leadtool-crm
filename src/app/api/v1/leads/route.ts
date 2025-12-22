import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  extractApiKey,
  validateApiKey,
  hasScope,
  checkRateLimit,
  apiError,
  apiSuccess,
} from "@/lib/api-key";
import { z } from "zod";

// Response Headers für API
function apiHeaders(rateLimit: { remaining: number; resetAt: number }) {
  return {
    "X-RateLimit-Remaining": rateLimit.remaining.toString(),
    "X-RateLimit-Reset": new Date(rateLimit.resetAt).toISOString(),
    "Content-Type": "application/json",
  };
}

// GET /api/v1/leads - Liste aller Leads
export async function GET(request: NextRequest) {
  try {
    // API-Key validieren
    const key = extractApiKey(request);
    if (!key) {
      return NextResponse.json(
        apiError("UNAUTHORIZED", "API key required"),
        { status: 401 }
      );
    }

    const validation = await validateApiKey(key);
    if (!validation.valid) {
      return NextResponse.json(
        apiError("UNAUTHORIZED", validation.error || "Invalid API key"),
        { status: 401 }
      );
    }

    // Scope prüfen
    if (!hasScope(validation.scopes || [], "leads:read")) {
      return NextResponse.json(
        apiError("FORBIDDEN", "Missing scope: leads:read"),
        { status: 403 }
      );
    }

    // Rate Limiting
    const rateLimit = checkRateLimit(validation.apiKeyId!, 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        apiError("RATE_LIMITED", "Rate limit exceeded"),
        { status: 429, headers: apiHeaders(rateLimit) }
      );
    }

    // Query Parameter
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("project_id");
    const tableId = searchParams.get("table_id");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");
    const search = searchParams.get("search");

    // Projekte der Organisation holen
    const projects = await prisma.project.findMany({
      where: {
        organizationId: validation.organizationId,
        ...(projectId ? { id: projectId } : {}),
      },
      select: { id: true },
    });

    const projectIds = projects.map((p) => p.id);

    if (projectIds.length === 0) {
      return NextResponse.json(
        apiSuccess([], { total: 0, page: Math.floor(offset / limit) + 1, limit, hasMore: false }),
        { headers: apiHeaders(rateLimit) }
      );
    }

    // Leads (Rows) abrufen
    const where: Record<string, unknown> = {
      table: {
        projectId: { in: projectIds },
        ...(tableId ? { id: tableId } : {}),
      },
    };

    const [rows, total] = await Promise.all([
      prisma.row.findMany({
        where,
        include: {
          cells: {
            include: { column: true },
          },
          table: {
            select: { id: true, name: true, projectId: true },
          },
          deal: {
            select: {
              id: true,
              value: true,
              probability: true,
              stage: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.row.count({ where }),
    ]);

    // Formatiere Leads für API-Response
    const leads = rows.map((row) => {
      const data: Record<string, unknown> = {};
      for (const cell of row.cells) {
        const key = cell.column.name.toLowerCase().replace(/\s+/g, "_");
        data[key] = cell.value;
      }

      return {
        id: row.id,
        table_id: row.table.id,
        table_name: row.table.name,
        project_id: row.table.projectId,
        data,
        deal: row.deal
          ? {
              id: row.deal.id,
              value: row.deal.value,
              probability: row.deal.probability,
              stage_id: row.deal.stage.id,
              stage_name: row.deal.stage.name,
            }
          : null,
        created_at: row.createdAt.toISOString(),
        updated_at: row.updatedAt.toISOString(),
      };
    });

    return NextResponse.json(
      apiSuccess(leads, {
        total,
        page: Math.floor(offset / limit) + 1,
        limit,
        hasMore: offset + leads.length < total,
      }),
      { headers: apiHeaders(rateLimit) }
    );
  } catch (error) {
    console.error("API v1 leads error:", error);
    return NextResponse.json(
      apiError("INTERNAL_ERROR", "An error occurred"),
      { status: 500 }
    );
  }
}

// POST /api/v1/leads - Neuen Lead erstellen
const createLeadSchema = z.object({
  table_id: z.string(),
  data: z.record(z.string(), z.unknown()),
});

export async function POST(request: NextRequest) {
  try {
    // API-Key validieren
    const key = extractApiKey(request);
    if (!key) {
      return NextResponse.json(
        apiError("UNAUTHORIZED", "API key required"),
        { status: 401 }
      );
    }

    const validation = await validateApiKey(key);
    if (!validation.valid) {
      return NextResponse.json(
        apiError("UNAUTHORIZED", validation.error || "Invalid API key"),
        { status: 401 }
      );
    }

    // Scope prüfen
    if (!hasScope(validation.scopes || [], "leads:write")) {
      return NextResponse.json(
        apiError("FORBIDDEN", "Missing scope: leads:write"),
        { status: 403 }
      );
    }

    // Rate Limiting
    const rateLimit = checkRateLimit(validation.apiKeyId!, 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        apiError("RATE_LIMITED", "Rate limit exceeded"),
        { status: 429, headers: apiHeaders(rateLimit) }
      );
    }

    const body = await request.json();
    const input = createLeadSchema.parse(body);

    // Prüfe Tabellenzugriff
    const table = await prisma.table.findFirst({
      where: {
        id: input.table_id,
        project: { organizationId: validation.organizationId },
      },
      include: {
        columns: true,
      },
    });

    if (!table) {
      return NextResponse.json(
        apiError("NOT_FOUND", "Table not found or access denied"),
        { status: 404, headers: apiHeaders(rateLimit) }
      );
    }

    // Erstelle Row mit Cells
    const cellsData = table.columns.map((column) => {
      const key = column.name.toLowerCase().replace(/\s+/g, "_");
      const rawValue = input.data[key] ?? input.data[column.name];
      return {
        columnId: column.id,
        value: rawValue !== undefined ? rawValue : null,
      };
    });

    // Finde max position
    const maxPosition = await prisma.row.findFirst({
      where: { tableId: table.id },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const row = await prisma.row.create({
      data: {
        tableId: table.id,
        position: (maxPosition?.position ?? -1) + 1,
      },
      include: {
        table: { select: { id: true, name: true, projectId: true } },
      },
    });

    // Cells separat erstellen
    await prisma.cell.createMany({
      data: cellsData.map((c) => ({
        rowId: row.id,
        columnId: c.columnId,
        value: c.value === null ? Prisma.JsonNull : c.value,
      })),
    });

    // Cells laden
    const cells = await prisma.cell.findMany({
      where: { rowId: row.id },
      include: { column: true },
    });

    // Formatiere Response
    const data: Record<string, unknown> = {};
    for (const cell of cells) {
      const key = cell.column.name.toLowerCase().replace(/\s+/g, "_");
      data[key] = cell.value;
    }

    return NextResponse.json(
      apiSuccess({
        id: row.id,
        table_id: row.table.id,
        table_name: row.table.name,
        project_id: row.table.projectId,
        data,
        created_at: row.createdAt.toISOString(),
        updated_at: row.updatedAt.toISOString(),
      }),
      { status: 201, headers: apiHeaders(rateLimit) }
    );
  } catch (error) {
    console.error("API v1 leads create error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        apiError("VALIDATION_ERROR", "Invalid input", { issues: error.issues }),
        { status: 400 }
      );
    }
    return NextResponse.json(
      apiError("INTERNAL_ERROR", "An error occurred"),
      { status: 500 }
    );
  }
}
