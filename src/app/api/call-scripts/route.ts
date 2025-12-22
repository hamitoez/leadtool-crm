import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const callScriptSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z.string().optional(),
  introduction: z.string().optional(),
  questions: z.array(z.object({
    question: z.string(),
    hint: z.string().optional(),
    required: z.boolean().optional(),
  })).optional(),
  objections: z.array(z.object({
    objection: z.string(),
    response: z.string(),
  })).optional(),
  closingNotes: z.string().optional(),
  isDefault: z.boolean().optional(),
});

// GET /api/call-scripts - Get all call scripts
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const activeOnly = searchParams.get("active") === "true";

    const scripts = await prisma.callScript.findMany({
      where: {
        userId: session.user.id,
        ...(category && { category }),
        ...(activeOnly && { isActive: true }),
      },
      orderBy: [
        { isDefault: "desc" },
        { usageCount: "desc" },
        { name: "asc" },
      ],
    });

    return NextResponse.json({ scripts });
  } catch (error) {
    console.error("Error getting call scripts:", error);
    return NextResponse.json({ error: "Fehler beim Abrufen der Anruf-Scripts" }, { status: 500 });
  }
}

// POST /api/call-scripts - Create a new call script
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = callScriptSchema.parse(body);

    // If setting as default, unset other defaults
    if (data.isDefault) {
      await prisma.callScript.updateMany({
        where: { userId: session.user.id, isDefault: true },
        data: { isDefault: false },
      });
    }

    const script = await prisma.callScript.create({
      data: {
        userId: session.user.id,
        name: data.name,
        description: data.description,
        category: data.category,
        introduction: data.introduction,
        questions: data.questions || [],
        objections: data.objections || [],
        closingNotes: data.closingNotes,
        isDefault: data.isDefault || false,
      },
    });

    return NextResponse.json({ script }, { status: 201 });
  } catch (error) {
    console.error("Error creating call script:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungueltige Eingabe", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Fehler beim Erstellen des Scripts" }, { status: 500 });
  }
}
