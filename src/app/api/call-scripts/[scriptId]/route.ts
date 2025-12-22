import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const updateCallScriptSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  introduction: z.string().optional().nullable(),
  questions: z.array(z.object({
    question: z.string(),
    hint: z.string().optional(),
    required: z.boolean().optional(),
  })).optional(),
  objections: z.array(z.object({
    objection: z.string(),
    response: z.string(),
  })).optional(),
  closingNotes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

// GET /api/call-scripts/[scriptId] - Get a single call script
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ scriptId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { scriptId } = await params;

    const script = await prisma.callScript.findFirst({
      where: { id: scriptId, userId: session.user.id },
    });

    if (!script) {
      return NextResponse.json({ error: "Script nicht gefunden" }, { status: 404 });
    }

    return NextResponse.json({ script });
  } catch (error) {
    console.error("Error getting call script:", error);
    return NextResponse.json({ error: "Fehler beim Abrufen des Scripts" }, { status: 500 });
  }
}

// PATCH /api/call-scripts/[scriptId] - Update a call script
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ scriptId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { scriptId } = await params;
    const body = await request.json();
    const data = updateCallScriptSchema.parse(body);

    // Check ownership
    const existing = await prisma.callScript.findFirst({
      where: { id: scriptId, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Script nicht gefunden" }, { status: 404 });
    }

    // If setting as default, unset other defaults
    if (data.isDefault) {
      await prisma.callScript.updateMany({
        where: { userId: session.user.id, isDefault: true, id: { not: scriptId } },
        data: { isDefault: false },
      });
    }

    const script = await prisma.callScript.update({
      where: { id: scriptId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.introduction !== undefined && { introduction: data.introduction }),
        ...(data.questions !== undefined && { questions: data.questions }),
        ...(data.objections !== undefined && { objections: data.objections }),
        ...(data.closingNotes !== undefined && { closingNotes: data.closingNotes }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
      },
    });

    return NextResponse.json({ script });
  } catch (error) {
    console.error("Error updating call script:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungueltige Eingabe", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Fehler beim Aktualisieren des Scripts" }, { status: 500 });
  }
}

// DELETE /api/call-scripts/[scriptId] - Delete a call script
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ scriptId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { scriptId } = await params;

    // Check ownership
    const existing = await prisma.callScript.findFirst({
      where: { id: scriptId, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Script nicht gefunden" }, { status: 404 });
    }

    await prisma.callScript.delete({
      where: { id: scriptId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting call script:", error);
    return NextResponse.json({ error: "Fehler beim Loeschen des Scripts" }, { status: 500 });
  }
}

// POST /api/call-scripts/[scriptId]/use - Track script usage
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ scriptId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { scriptId } = await params;

    const script = await prisma.callScript.update({
      where: { id: scriptId, userId: session.user.id },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });

    return NextResponse.json({ script });
  } catch (error) {
    console.error("Error tracking script usage:", error);
    return NextResponse.json({ error: "Fehler beim Tracken der Nutzung" }, { status: 500 });
  }
}
