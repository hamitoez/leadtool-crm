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

// GET /api/v1/activities - Liste aller Aktivitäten
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

    if (!hasScope(validation.scopes || [], "activities:read")) {
      return NextResponse.json(
        apiError("FORBIDDEN", "Missing scope: activities:read"),
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
    const leadId = searchParams.get("lead_id");
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: Record<string, unknown> = {
      row: {
        table: {
          project: { organizationId: validation.organizationId },
        },
      },
    };

    if (leadId) where.rowId = leadId;
    if (type) where.type = type.toUpperCase();
    if (status) where.status = status.toUpperCase();

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          row: {
            select: {
              id: true,
              cells: {
                include: { column: true },
                where: { column: { type: { in: ["COMPANY", "PERSON"] } } },
                take: 1,
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.activity.count({ where }),
    ]);

    const formattedActivities = activities.map((activity) => {
      const contactName =
        activity.row.cells[0]?.value as string || "Unknown";

      return {
        id: activity.id,
        lead_id: activity.rowId,
        contact_name: contactName,
        type: activity.type.toLowerCase(),
        status: activity.status?.toLowerCase() || null,
        title: activity.title,
        description: activity.description,
        priority: activity.priority?.toLowerCase() || null,
        due_date: activity.dueDate?.toISOString() || null,
        completed_at: activity.completedAt?.toISOString() || null,
        user: activity.user
          ? {
              id: activity.user.id,
              name: activity.user.name,
              email: activity.user.email,
            }
          : null,
        created_at: activity.createdAt.toISOString(),
        updated_at: activity.updatedAt.toISOString(),
      };
    });

    return NextResponse.json(
      apiSuccess(formattedActivities, {
        total,
        page: Math.floor(offset / limit) + 1,
        limit,
        hasMore: offset + formattedActivities.length < total,
      }),
      { headers: apiHeaders(rateLimit) }
    );
  } catch (error) {
    console.error("API v1 activities error:", error);
    return NextResponse.json(
      apiError("INTERNAL_ERROR", "An error occurred"),
      { status: 500 }
    );
  }
}

// POST /api/v1/activities - Neue Aktivität erstellen
const createActivitySchema = z.object({
  lead_id: z.string(),
  type: z.enum(["call", "email", "meeting", "note", "task"]),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  status: z.enum(["planned", "completed", "cancelled", "missed"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  due_date: z.string().datetime().optional(),
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

    if (!hasScope(validation.scopes || [], "activities:write")) {
      return NextResponse.json(
        apiError("FORBIDDEN", "Missing scope: activities:write"),
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
    const input = createActivitySchema.parse(body);

    // Prüfe Lead-Zugriff
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

    // Finde einen User der Organisation für die Aktivität
    const orgMember = await prisma.organizationMember.findFirst({
      where: { organizationId: validation.organizationId, isActive: true },
      orderBy: { role: "asc" }, // OWNER zuerst
    });

    if (!orgMember) {
      return NextResponse.json(
        apiError("INTERNAL_ERROR", "No organization member found"),
        { status: 500, headers: apiHeaders(rateLimit) }
      );
    }

    const activity = await prisma.activity.create({
      data: {
        rowId: input.lead_id,
        userId: orgMember.userId,
        type: input.type.toUpperCase() as "CALL" | "EMAIL" | "MEETING" | "NOTE" | "TASK",
        title: input.title,
        description: input.description,
        status: input.status?.toUpperCase() as "PLANNED" | "COMPLETED" | "CANCELLED" | "MISSED" | undefined,
        priority: input.priority?.toUpperCase() as "LOW" | "MEDIUM" | "HIGH" | "URGENT" | undefined,
        dueDate: input.due_date ? new Date(input.due_date) : undefined,
      },
    });

    return NextResponse.json(
      apiSuccess({
        id: activity.id,
        lead_id: activity.rowId,
        type: activity.type.toLowerCase(),
        title: activity.title,
        description: activity.description,
        status: activity.status?.toLowerCase() || null,
        priority: activity.priority?.toLowerCase() || null,
        due_date: activity.dueDate?.toISOString() || null,
        created_at: activity.createdAt.toISOString(),
      }),
      { status: 201, headers: apiHeaders(rateLimit) }
    );
  } catch (error) {
    console.error("API v1 activities create error:", error);
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
