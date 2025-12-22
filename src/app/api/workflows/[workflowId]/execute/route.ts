import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { executeWorkflow } from "@/lib/workflow/engine";
import prisma from "@/lib/prisma";

// POST /api/workflows/[workflowId]/execute - Execute a workflow manually
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const { workflowId } = await params;

    // Parse optional body
    let body: { rowId?: string; dealId?: string; variables?: Record<string, unknown> } = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is fine
    }

    // Verify workflow exists and belongs to user
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId, userId: session.user.id },
      include: { nodes: true },
    });

    if (!workflow) {
      return NextResponse.json({ error: "Workflow nicht gefunden" }, { status: 404 });
    }

    // Check if workflow has a MANUAL trigger (for manual execution)
    const hasTrigger = workflow.nodes.some((n) => n.nodeType === "TRIGGER");
    if (!hasTrigger) {
      return NextResponse.json(
        { error: "Workflow hat keinen Trigger-Node" },
        { status: 400 }
      );
    }

    // Execute the workflow
    const result = await executeWorkflow(workflowId, session.user.id, {
      rowId: body.rowId,
      dealId: body.dealId,
      variables: body.variables,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Workflow execution error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ausführungsfehler" },
      { status: 500 }
    );
  }
}

// GET /api/workflows/[workflowId]/execute - Get execution history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const { workflowId } = await params;

    // Verify workflow belongs to user
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId, userId: session.user.id },
    });

    if (!workflow) {
      return NextResponse.json({ error: "Workflow nicht gefunden" }, { status: 404 });
    }

    // Get executions
    const executions = await prisma.workflowExecution.findMany({
      where: { workflowId },
      orderBy: { startedAt: "desc" },
      take: 20,
    });

    return NextResponse.json({ executions });
  } catch (error) {
    console.error("Get executions error:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Ausführungen" },
      { status: 500 }
    );
  }
}
