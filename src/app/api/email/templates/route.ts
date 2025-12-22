import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  category: z.string().optional(),
  subject: z.string().min(1).max(200),
  bodyHtml: z.string().min(1),
  bodyText: z.string().optional(),
  variables: z.array(z.string()).optional(),
});

// GET /api/email/templates - Get all templates
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    const where: Record<string, unknown> = {
      userId: session.user.id,
      isActive: true,
    };

    if (category) where.category = category;

    const templates = await prisma.emailTemplate.findMany({
      where,
      orderBy: [{ usageCount: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        subject: true,
        bodyHtml: true,
        bodyText: true,
        variables: true,
        usageCount: true,
        lastUsedAt: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Get unique categories
    const categories = await prisma.emailTemplate.findMany({
      where: { userId: session.user.id, isActive: true, category: { not: null } },
      select: { category: true },
      distinct: ["category"],
    });

    return NextResponse.json({
      templates,
      categories: categories.map((c) => c.category).filter(Boolean),
    });
  } catch (error) {
    console.error("Error fetching email templates:", error);
    return NextResponse.json({ error: "Failed to fetch email templates" }, { status: 500 });
  }
}

// POST /api/email/templates - Create a new template
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = createTemplateSchema.parse(body);

    // Extract variables from template if not provided
    let variables = data.variables || [];
    if (variables.length === 0) {
      const matches = data.bodyHtml.matchAll(/\{\{(\w+)\}\}/g);
      variables = [...new Set([...matches].map((m) => m[1]))];
    }

    const template = await prisma.emailTemplate.create({
      data: {
        userId: session.user.id,
        name: data.name,
        description: data.description,
        category: data.category,
        subject: data.subject,
        bodyHtml: data.bodyHtml,
        bodyText: data.bodyText || data.bodyHtml.replace(/<[^>]*>/g, ""),
        variables,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("Error creating email template:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create email template" }, { status: 500 });
  }
}
