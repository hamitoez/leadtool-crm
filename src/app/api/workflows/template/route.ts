import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// POST /api/workflows/template - Create the demo workflow template for the user
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    // Check if user already has the demo workflow
    const existingDemo = await prisma.workflow.findFirst({
      where: {
        userId: session.user.id,
        name: "Demo: Willkommens-Workflow",
      },
    });

    if (existingDemo) {
      return NextResponse.json({
        message: "Demo-Workflow existiert bereits",
        workflowId: existingDemo.id,
      });
    }

    // Create the demo workflow with nodes and edges
    const workflow = await prisma.workflow.create({
      data: {
        userId: session.user.id,
        name: "Demo: Willkommens-Workflow",
        description:
          "Ein einfacher Demo-Workflow, der zeigt wie Automatisierungen funktionieren. Klicke auf 'Ausführen' um ihn zu testen!",
        isActive: false,
        viewport: { x: 0, y: 0, zoom: 0.8 },
        nodes: {
          create: [
            {
              id: "trigger-demo-1",
              nodeType: "TRIGGER",
              subType: "MANUAL",
              label: "Manueller Start",
              positionX: 50,
              positionY: 150,
              config: {},
            },
            {
              id: "action-demo-1",
              nodeType: "ACTION",
              subType: "NOTIFY_USER",
              label: "Willkommens-Nachricht",
              positionX: 400,
              positionY: 100,
              config: {
                notificationTitle: "Workflow gestartet! 🎉",
                notificationMessage:
                  "Herzlichen Glückwunsch! Dein erster Workflow wurde erfolgreich ausgeführt. Du siehst diese Benachrichtigung als Ergebnis.",
              },
            },
            {
              id: "action-demo-2",
              nodeType: "ACTION",
              subType: "CREATE_REMINDER",
              label: "Erinnerung setzen",
              positionX: 750,
              positionY: 100,
              config: {
                reminderTitle: "Workflow-Demo abgeschlossen",
                reminderMinutes: 5,
              },
            },
          ],
        },
        edges: {
          create: [
            {
              id: "edge-demo-1",
              sourceNodeId: "trigger-demo-1",
              targetNodeId: "action-demo-1",
              sourceHandle: null,
              targetHandle: null,
            },
            {
              id: "edge-demo-2",
              sourceNodeId: "action-demo-1",
              targetNodeId: "action-demo-2",
              sourceHandle: null,
              targetHandle: null,
            },
          ],
        },
      },
      include: {
        nodes: true,
        edges: true,
      },
    });

    return NextResponse.json({
      message: "Demo-Workflow erstellt",
      workflowId: workflow.id,
      workflow,
    });
  } catch (error) {
    console.error("Template creation error:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen des Demo-Workflows" },
      { status: 500 }
    );
  }
}

// GET /api/workflows/template - Check if demo workflow exists
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const demoWorkflow = await prisma.workflow.findFirst({
      where: {
        userId: session.user.id,
        name: "Demo: Willkommens-Workflow",
      },
    });

    return NextResponse.json({
      exists: !!demoWorkflow,
      workflowId: demoWorkflow?.id,
    });
  } catch (error) {
    console.error("Template check error:", error);
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}
