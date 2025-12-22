import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const noteTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z.string().optional(),
  content: z.string().min(1),
  variables: z.array(z.string()).optional(),
});

// GET /api/note-templates - Get all note templates
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const activeOnly = searchParams.get("active") === "true";

    const templates = await prisma.noteTemplate.findMany({
      where: {
        userId: session.user.id,
        ...(category && { category }),
        ...(activeOnly && { isActive: true }),
      },
      orderBy: [
        { usageCount: "desc" },
        { name: "asc" },
      ],
    });

    return NextResponse.json({ templates });
  } catch (error) {
    console.error("Error getting note templates:", error);
    return NextResponse.json({ error: "Fehler beim Abrufen der Notiz-Vorlagen" }, { status: 500 });
  }
}

// POST /api/note-templates - Create a new note template
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = noteTemplateSchema.parse(body);

    // Extract variables from content ({{variable}})
    const extractedVars = data.content.match(/\{\{(\w+)\}\}/g)?.map(v => v.replace(/\{\{|\}\}/g, "")) || [];
    const variables = [...new Set([...(data.variables || []), ...extractedVars])];

    const template = await prisma.noteTemplate.create({
      data: {
        userId: session.user.id,
        name: data.name,
        description: data.description,
        category: data.category,
        content: data.content,
        variables,
      },
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error("Error creating note template:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungueltige Eingabe", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Fehler beim Erstellen der Vorlage" }, { status: 500 });
  }
}
