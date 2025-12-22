import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  subject: z.string().min(1).max(200).optional(),
  bodyHtml: z.string().min(1).optional(),
  bodyText: z.string().optional(),
  variables: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

// GET /api/email/templates/[templateId] - Get a single template
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

    const template = await prisma.emailTemplate.findFirst({
      where: { id: templateId, userId: session.user.id },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error("Error fetching email template:", error);
    return NextResponse.json({ error: "Failed to fetch email template" }, { status: 500 });
  }
}

// PATCH /api/email/templates/[templateId] - Update a template
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
    const data = updateTemplateSchema.parse(body);

    // Verify ownership
    const existing = await prisma.emailTemplate.findFirst({
      where: { id: templateId, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Extract variables if bodyHtml changed
    let variables = data.variables;
    if (data.bodyHtml && !data.variables) {
      const matches = data.bodyHtml.matchAll(/\{\{(\w+)\}\}/g);
      variables = [...new Set([...matches].map((m) => m[1]))];
    }

    const template = await prisma.emailTemplate.update({
      where: { id: templateId },
      data: {
        ...data,
        variables: variables || undefined,
        bodyText: data.bodyHtml
          ? data.bodyText || data.bodyHtml.replace(/<[^>]*>/g, "")
          : undefined,
      },
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error("Error updating email template:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update email template" }, { status: 500 });
  }
}

// DELETE /api/email/templates/[templateId] - Delete a template
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

    // Verify ownership
    const existing = await prisma.emailTemplate.findFirst({
      where: { id: templateId, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    await prisma.emailTemplate.delete({
      where: { id: templateId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting email template:", error);
    return NextResponse.json({ error: "Failed to delete email template" }, { status: 500 });
  }
}
