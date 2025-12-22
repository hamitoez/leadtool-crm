import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createProjectSchema } from "@/lib/validations/project";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const organizationId = searchParams.get("organizationId");

    // Finde Organisationen, in denen der User Mitglied ist
    const userOrgIds = await prisma.organizationMember.findMany({
      where: { userId: session.user.id, isActive: true },
      select: { organizationId: true },
    }).then(members => members.map(m => m.organizationId));

    // Projekte filtern: eigene ODER von Organisationen, in denen User Mitglied ist
    const whereClause = organizationId
      ? {
          // Spezifische Organisation gefiltert
          organizationId,
          OR: [
            { userId: session.user.id },
            { organizationId: { in: userOrgIds } },
          ],
        }
      : {
          // Alle zugänglichen Projekte
          OR: [
            { userId: session.user.id },
            { organizationId: { in: userOrgIds } },
          ],
        };

    // If search query is provided, include tables for search results
    if (search) {
      const projects = await prisma.project.findMany({
        where: whereClause,
        include: {
          tables: {
            select: {
              id: true,
              name: true,
            },
          },
          organization: {
            select: { id: true, name: true },
          },
          _count: {
            select: {
              tables: true,
            },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
      });

      return NextResponse.json(projects);
    }

    // Default: return projects without tables
    const projects = await prisma.project.findMany({
      where: whereClause,
      include: {
        organization: {
          select: { id: true, name: true },
        },
        _count: {
          select: {
            tables: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return NextResponse.json(projects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = createProjectSchema.parse(body);
    const { organizationId } = body;

    // Wenn organizationId angegeben, prüfen ob User Mitglied ist
    if (organizationId) {
      const membership = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: { organizationId, userId: session.user.id },
        },
      });

      if (!membership || !membership.isActive) {
        return NextResponse.json(
          { error: "Keine Berechtigung für diese Organisation" },
          { status: 403 }
        );
      }

      // Nur OWNER, ADMIN und MANAGER dürfen Projekte erstellen
      if (!["OWNER", "ADMIN", "MANAGER"].includes(membership.role)) {
        return NextResponse.json(
          { error: "Keine Berechtigung zum Erstellen von Projekten" },
          { status: 403 }
        );
      }
    }

    const project = await prisma.project.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        userId: session.user.id,
        organizationId: organizationId || null,
      },
      include: {
        organization: {
          select: { id: true, name: true },
        },
        _count: {
          select: {
            tables: true,
          },
        },
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("Error creating project:", error);

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input data", details: error },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
