import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const updateRuleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),

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
  ]).optional(),
  triggerConfig: z.record(z.string(), z.unknown()).optional(),

  conditions: z.array(z.record(z.string(), z.unknown())).optional(),

  action: z.enum([
    "SEND_EMAIL",
    "CREATE_TASK",
    "CREATE_REMINDER",
    "MOVE_STAGE",
    "ADD_NOTE",
    "NOTIFY_USER",
  ]).optional(),
  actionConfig: z.record(z.string(), z.unknown()).optional(),

  delayMinutes: z.number().int().min(0).optional(),

  pipelineId: z.string().optional(),
  stageIds: z.array(z.string()).optional(),
});

// GET /api/automation/rules/[ruleId]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { ruleId } = await params;

    const rule = await prisma.followUpRule.findFirst({
      where: { id: ruleId, userId: session.user.id },
    });

    if (!rule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    return NextResponse.json(rule);
  } catch (error) {
    console.error("Error fetching rule:", error);
    return NextResponse.json({ error: "Failed to fetch rule" }, { status: 500 });
  }
}

// PATCH /api/automation/rules/[ruleId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { ruleId } = await params;
    const body = await request.json();
    const data = updateRuleSchema.parse(body);

    // Verify ownership
    const existing = await prisma.followUpRule.findFirst({
      where: { id: ruleId, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.trigger !== undefined) updateData.trigger = data.trigger;
    if (data.triggerConfig !== undefined) updateData.triggerConfig = data.triggerConfig as object;
    if (data.conditions !== undefined) updateData.conditions = data.conditions as object[];
    if (data.action !== undefined) updateData.action = data.action;
    if (data.actionConfig !== undefined) updateData.actionConfig = data.actionConfig as object;
    if (data.delayMinutes !== undefined) updateData.delayMinutes = data.delayMinutes;
    if (data.pipelineId !== undefined) updateData.pipelineId = data.pipelineId;
    if (data.stageIds !== undefined) updateData.stageIds = data.stageIds;

    const rule = await prisma.followUpRule.update({
      where: { id: ruleId },
      data: updateData,
    });

    return NextResponse.json(rule);
  } catch (error) {
    console.error("Error updating rule:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update rule" }, { status: 500 });
  }
}

// DELETE /api/automation/rules/[ruleId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { ruleId } = await params;

    // Verify ownership
    const existing = await prisma.followUpRule.findFirst({
      where: { id: ruleId, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    await prisma.followUpRule.delete({
      where: { id: ruleId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting rule:", error);
    return NextResponse.json({ error: "Failed to delete rule" }, { status: 500 });
  }
}
