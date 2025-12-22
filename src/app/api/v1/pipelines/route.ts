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

function apiHeaders(rateLimit: { remaining: number; resetAt: number }) {
  return {
    "X-RateLimit-Remaining": rateLimit.remaining.toString(),
    "X-RateLimit-Reset": new Date(rateLimit.resetAt).toISOString(),
    "Content-Type": "application/json",
  };
}

// GET /api/v1/pipelines - Liste aller Pipelines
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

    // Pipelines benötigen deals:read scope
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
    const projectId = searchParams.get("project_id");

    // Pipelines der Organisation abrufen
    const pipelines = await prisma.pipeline.findMany({
      where: {
        project: {
          organizationId: validation.organizationId,
          ...(projectId ? { id: projectId } : {}),
        },
      },
      include: {
        stages: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            name: true,
            color: true,
            stageType: true,
            position: true,
            _count: { select: { deals: true } },
          },
        },
        project: {
          select: { id: true, name: true },
        },
        _count: {
          select: { stages: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formattedPipelines = pipelines.map((pipeline) => ({
      id: pipeline.id,
      name: pipeline.name,
      is_default: pipeline.isDefault,
      project: {
        id: pipeline.project.id,
        name: pipeline.project.name,
      },
      stages: pipeline.stages.map((stage) => ({
        id: stage.id,
        name: stage.name,
        color: stage.color,
        type: stage.stageType,
        position: stage.position,
        deal_count: stage._count.deals,
      })),
      stage_count: pipeline._count.stages,
      created_at: pipeline.createdAt.toISOString(),
      updated_at: pipeline.updatedAt.toISOString(),
    }));

    return NextResponse.json(
      apiSuccess(formattedPipelines, { total: formattedPipelines.length }),
      { headers: apiHeaders(rateLimit) }
    );
  } catch (error) {
    console.error("API v1 pipelines error:", error);
    return NextResponse.json(
      apiError("INTERNAL_ERROR", "An error occurred"),
      { status: 500 }
    );
  }
}
