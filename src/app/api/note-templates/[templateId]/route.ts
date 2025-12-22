import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const updateNoteTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  content: z.string().min(1).optional(),
  variables: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

// GET /api/note-templates/[templateId] - Get a single note template
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { templateId } = await params;

    const template = await prisma.noteTemplate.findFirst({
      where: { id: templateId, userId: session.user.id },
    });

    if (!template) {
      return NextResponse.json({ error: "Vorlage nicht gefunden" }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error("Error getting note template:", error);
    return NextResponse.json({ error: "Fehler beim Abrufen der Vorlage" }, { status: 500 });
  }
}

// PATCH /api/note-templates/[templateId] - Update a note template
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { templateId } = await params;
    const body = await request.json();
    const data = updateNoteTemplateSchema.parse(body);

    // Check ownership
    const existing = await prisma.noteTemplate.findFirst({
      where: { id: templateId, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Vorlage nicht gefunden" }, { status: 404 });
    }

    // Extract variables from content if content is being updated
    let variables = data.variables;
    if (data.content) {
      const extractedVars = data.content.match(/\{\{(\w+)\}\}/g)?.map(v => v.replace(/\{\{|\}\}/g, "")) || [];
      variables = [...new Set([...(data.variables || []), ...extractedVars])];
    }

    const template = await prisma.noteTemplate.update({
      where: { id: templateId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.content !== undefined && { content: data.content }),
        ...(variables !== undefined && { variables }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    return NextResponse.json({ template });
  } catch (error) {
    console.error("Error updating note template:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungueltige Eingabe", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Fehler beim Aktualisieren der Vorlage" }, { status: 500 });
  }
}

// DELETE /api/note-templates/[templateId] - Delete a note template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { templateId } = await params;

    // Check ownership
    const existing = await prisma.noteTemplate.findFirst({
      where: { id: templateId, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Vorlage nicht gefunden" }, { status: 404 });
    }

    await prisma.noteTemplate.delete({
      where: { id: templateId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting note template:", error);
    return NextResponse.json({ error: "Fehler beim Loeschen der Vorlage" }, { status: 500 });
  }
}

// POST /api/note-templates/[templateId]/use - Apply template and track usage
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { templateId } = await params;
    const body = await request.json();
    const { variables = {} } = body;

    const template = await prisma.noteTemplate.findFirst({
      where: { id: templateId, userId: session.user.id },
    });

    if (!template) {
      return NextResponse.json({ error: "Vorlage nicht gefunden" }, { status: 404 });
    }

    // Apply variables to content
    let content = template.content;
    for (const [key, value] of Object.entries(variables)) {
      content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value as string);
    }

    // Track usage
    await prisma.noteTemplate.update({
      where: { id: templateId },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });

    return NextResponse.json({ content });
  } catch (error) {
    console.error("Error applying note template:", error);
    return NextResponse.json({ error: "Fehler beim Anwenden der Vorlage" }, { status: 500 });
  }
}
