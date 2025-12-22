import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const createRuleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  isActive: z.boolean().optional().default(true),

  trigger: z.enum([
    "DEAL_CREATED",
    "STAGE_CHANGED",
    "NO_ACTIVITY",
    "EMAIL_OPENED",
    "EMAIL_NOT_OPENED",
    "EMAIL_CLICKED",
    "TASK_OVERDUE",
    "MEETING_SCHEDULED",
    "MEETING_COMPLETED",
    "CALL_COMPLETED",
    "MANUAL",
  ]),
  triggerConfig: z.record(z.string(), z.unknown()).optional().default({}),

  conditions: z.array(z.record(z.string(), z.unknown())).optional().default([]),

  action: z.enum([
    "SEND_EMAIL",
    "CREATE_TASK",
    "CREATE_REMINDER",
    "MOVE_STAGE",
    "ADD_NOTE",
    "NOTIFY_USER",
  ]),
  actionConfig: z.record(z.string(), z.unknown()).optional().default({}),

  delayMinutes: z.number().int().min(0).optional().default(0),

  pipelineId: z.string().optional(),
  stageIds: z.array(z.string()).optional().default([]),
});

// GET /api/automation/rules - Get all rules
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rules = await prisma.followUpRule.findMany({
      where: { userId: session.user.id },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ rules });
  } catch (error) {
    console.error("Error fetching automation rules:", error);
    return NextResponse.json({ error: "Failed to fetch rules" }, { status: 500 });
  }
}

// POST /api/automation/rules - Create a new rule
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = createRuleSchema.parse(body);

    const rule = await prisma.followUpRule.create({
      data: {
        userId: session.user.id,
        name: data.name,
        description: data.description,
        isActive: data.isActive,
        trigger: data.trigger,
        triggerConfig: data.triggerConfig as object,
        conditions: data.conditions as object[],
        action: data.action,
        actionConfig: data.actionConfig as object,
        delayMinutes: data.delayMinutes,
        pipelineId: data.pipelineId,
        stageIds: data.stageIds,
      },
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    console.error("Error creating automation rule:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create rule" }, { status: 500 });
  }
}
