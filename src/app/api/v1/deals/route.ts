import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  extractApiKey,
  validateApiKey,
  hasScope,
  checkRateLimit,
  apiError,
  apiSuccess,
} from "@/lib/api-key";
import { z } from "zod";

function apiHeaders(rateLimit: { remaining: number; resetAt: number }) {
  return {
    "X-RateLimit-Remaining": rateLimit.remaining.toString(),
    "X-RateLimit-Reset": new Date(rateLimit.resetAt).toISOString(),
    "Content-Type": "application/json",
  };
}

// GET /api/v1/deals - Liste aller Deals
export async function GET(request: NextRequest) {
  try {
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

    if (!hasScope(validation.scopes || [], "deals:read")) {
      return NextResponse.json(
        apiError("FORBIDDEN", "Missing scope: deals:read"),
        { status: 403 }
      );
    }

    const rateLimit = checkRateLimit(validation.apiKeyId!, 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        apiError("RATE_LIMITED", "Rate limit exceeded"),
        { status: 429, headers: apiHeaders(rateLimit) }
      );
    }

    const { searchParams } = new URL(request.url);
    const pipelineId = searchParams.get("pipeline_id");
    const stageId = searchParams.get("stage_id");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Deals der Organisation abrufen
    const where: Record<string, unknown> = {
      stage: {
        pipeline: {
          project: { organizationId: validation.organizationId },
          ...(pipelineId ? { id: pipelineId } : {}),
        },
        ...(stageId ? { id: stageId } : {}),
      },
    };

    const [deals, total] = await Promise.all([
      prisma.deal.findMany({
        where,
        include: {
          stage: {
            select: { id: true, name: true, color: true, stageType: true },
          },
          row: {
            include: {
              cells: {
                include: { column: true },
                where: { column: { type: { in: ["COMPANY", "PERSON", "EMAIL", "PHONE"] } } },
              },
              table: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.deal.count({ where }),
    ]);

    const formattedDeals = deals.map((deal) => {
      const contact: Record<string, unknown> = {};
      for (const cell of deal.row.cells) {
        const key = cell.column.type.toLowerCase();
        contact[key] = cell.value;
      }

      return {
        id: deal.id,
        lead_id: deal.rowId,
        value: deal.value,
        probability: deal.probability,
        expected_close: deal.expectedClose?.toISOString() || null,
        stage: {
          id: deal.stage.id,
          name: deal.stage.name,
          color: deal.stage.color,
          type: deal.stage.stageType,
        },
        contact,
        won_at: deal.wonAt?.toISOString() || null,
        lost_at: deal.lostAt?.toISOString() || null,
        created_at: deal.createdAt.toISOString(),
        updated_at: deal.updatedAt.toISOString(),
      };
    });

    return NextResponse.json(
      apiSuccess(formattedDeals, {
        total,
        page: Math.floor(offset / limit) + 1,
        limit,
        hasMore: offset + formattedDeals.length < total,
      }),
      { headers: apiHeaders(rateLimit) }
    );
  } catch (error) {
    console.error("API v1 deals error:", error);
    return NextResponse.json(
      apiError("INTERNAL_ERROR", "An error occurred"),
      { status: 500 }
    );
  }
}

// POST /api/v1/deals - Neuen Deal erstellen
const createDealSchema = z.object({
  lead_id: z.string(),
  stage_id: z.string(),
  value: z.number().nullable().optional(),
  probability: z.number().min(0).max(100).optional(),
  expected_close: z.string().datetime().nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
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

    if (!hasScope(validation.scopes || [], "deals:write")) {
      return NextResponse.json(
        apiError("FORBIDDEN", "Missing scope: deals:write"),
        { status: 403 }
      );
    }

    const rateLimit = checkRateLimit(validation.apiKeyId!, 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        apiError("RATE_LIMITED", "Rate limit exceeded"),
        { status: 429, headers: apiHeaders(rateLimit) }
      );
    }

    const body = await request.json();
    const input = createDealSchema.parse(body);

    // Prüfe Row-Zugriff
    const row = await prisma.row.findFirst({
      where: {
        id: input.lead_id,
        table: { project: { organizationId: validation.organizationId } },
      },
    });

    if (!row) {
      return NextResponse.json(
        apiError("NOT_FOUND", "Lead not found or access denied"),
        { status: 404, headers: apiHeaders(rateLimit) }
      );
    }

    // Prüfe Stage-Zugriff
    const stage = await prisma.pipelineStage.findFirst({
      where: {
        id: input.stage_id,
        pipeline: { project: { organizationId: validation.organizationId } },
      },
    });

    if (!stage) {
      return NextResponse.json(
        apiError("NOT_FOUND", "Stage not found or access denied"),
        { status: 404, headers: apiHeaders(rateLimit) }
      );
    }

    // Prüfe ob Lead schon einen Deal hat
    const existingDeal = await prisma.deal.findUnique({
      where: { rowId: input.lead_id },
    });

    if (existingDeal) {
      return NextResponse.json(
        apiError("CONFLICT", "Lead already has a deal"),
        { status: 409, headers: apiHeaders(rateLimit) }
      );
    }

    // Deal erstellen
    const deal = await prisma.deal.create({
      data: {
        rowId: input.lead_id,
        stageId: input.stage_id,
        value: input.value ?? null,
        probability: input.probability ?? 50,
        expectedClose: input.expected_close ? new Date(input.expected_close) : null,
        position: 0,
      },
      include: {
        stage: { select: { id: true, name: true, color: true, stageType: true } },
      },
    });

    return NextResponse.json(
      apiSuccess({
        id: deal.id,
        lead_id: deal.rowId,
        value: deal.value,
        probability: deal.probability,
        expected_close: deal.expectedClose?.toISOString() || null,
        stage: {
          id: deal.stage.id,
          name: deal.stage.name,
          color: deal.stage.color,
          type: deal.stage.stageType,
        },
        created_at: deal.createdAt.toISOString(),
      }),
      { status: 201, headers: apiHeaders(rateLimit) }
    );
  } catch (error) {
    console.error("API v1 deals create error:", error);
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
