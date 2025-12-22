import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const createPipelineSchema = z.object({
  projectId: z.string(),
  name: z.string().min(1).max(100),
  isDefault: z.boolean().optional(),
});

// GET /api/pipelines - Get all pipelines for a project
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    // Verify project access (own project OR org member)
    const userOrgIds = await prisma.organizationMember.findMany({
      where: { userId: session.user.id, isActive: true },
      select: { organizationId: true },
    }).then(members => members.map(m => m.organizationId));

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { userId: session.user.id },
          { organizationId: { in: userOrgIds } },
        ],
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const pipelines = await prisma.pipeline.findMany({
      where: { projectId },
      include: {
        stages: {
          orderBy: { position: "asc" },
          include: {
            _count: { select: { deals: true } },
            deals: {
              orderBy: { position: "asc" },
              include: {
                row: {
                  include: {
                    cells: {
                      include: { column: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(pipelines);
  } catch (error) {
    console.error("Error fetching pipelines:", error);
    return NextResponse.json({ error: "Failed to fetch pipelines" }, { status: 500 });
  }
}

// POST /api/pipelines - Create a new pipeline with default stages
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = createPipelineSchema.parse(body);

    // Verify project access (own project OR org member)
    const userOrgIds = await prisma.organizationMember.findMany({
      where: { userId: session.user.id, isActive: true },
      select: { organizationId: true },
    }).then(members => members.map(m => m.organizationId));

    const project = await prisma.project.findFirst({
      where: {
        id: data.projectId,
        OR: [
          { userId: session.user.id },
          { organizationId: { in: userOrgIds } },
        ],
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // If this is the default pipeline, unset other defaults
    if (data.isDefault) {
      await prisma.pipeline.updateMany({
        where: { projectId: data.projectId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Create pipeline with default stages
    const pipeline = await prisma.pipeline.create({
      data: {
        projectId: data.projectId,
        name: data.name,
        isDefault: data.isDefault ?? false,
        stages: {
          create: [
            { name: "Neu", color: "#6B7280", position: 0, stageType: "OPEN" },
            { name: "Kontaktiert", color: "#3B82F6", position: 1, stageType: "OPEN" },
            { name: "Qualifiziert", color: "#8B5CF6", position: 2, stageType: "OPEN" },
            { name: "Angebot", color: "#F59E0B", position: 3, stageType: "OPEN" },
            { name: "Verhandlung", color: "#EC4899", position: 4, stageType: "OPEN" },
            { name: "Gewonnen", color: "#10B981", position: 5, stageType: "WON" },
            { name: "Verloren", color: "#EF4444", position: 6, stageType: "LOST" },
          ],
        },
      },
      include: {
        stages: {
          orderBy: { position: "asc" },
        },
      },
    });

    return NextResponse.json(pipeline, { status: 201 });
  } catch (error) {
    console.error("Error creating pipeline:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create pipeline" }, { status: 500 });
  }
}
