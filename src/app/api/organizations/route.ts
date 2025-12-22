import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Slug generieren (URL-freundlicher Name)
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[äÄ]/g, "ae")
    .replace(/[öÖ]/g, "oe")
    .replace(/[üÜ]/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50);
}

// GET /api/organizations - Alle Organisationen des Users abrufen
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const memberships = await prisma.organizationMember.findMany({
      where: {
        userId: session.user.id,
        isActive: true,
      },
      include: {
        organization: {
          include: {
            _count: {
              select: {
                members: { where: { isActive: true } },
                projects: true,
              },
            },
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    });

    const organizations = memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      description: m.organization.description,
      logo: m.organization.logo,
      plan: m.organization.plan,
      role: m.role,
      memberCount: m.organization._count.members,
      projectCount: m.organization._count.projects,
      joinedAt: m.joinedAt,
    }));

    return NextResponse.json(organizations);
  } catch (error) {
    console.error("Error fetching organizations:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Organisationen" },
      { status: 500 }
    );
  }
}

// POST /api/organizations - Neue Organisation erstellen
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json(
        { error: "Name muss mindestens 2 Zeichen haben" },
        { status: 400 }
      );
    }

    // Slug generieren und auf Eindeutigkeit prüfen
    let slug = generateSlug(name.trim());
    let slugExists = await prisma.organization.findUnique({ where: { slug } });
    let counter = 1;
    while (slugExists) {
      slug = `${generateSlug(name.trim())}-${counter}`;
      slugExists = await prisma.organization.findUnique({ where: { slug } });
      counter++;
    }

    // Organisation und Mitgliedschaft in einer Transaktion erstellen
    const organization = await prisma.$transaction(async (tx) => {
      // Organisation erstellen
      const org = await tx.organization.create({
        data: {
          name: name.trim(),
          slug,
          description: description?.trim() || null,
        },
      });

      // Ersteller als OWNER hinzufügen
      await tx.organizationMember.create({
        data: {
          organizationId: org.id,
          userId: session.user.id,
          role: "OWNER",
          joinedAt: new Date(),
        },
      });

      return org;
    });

    return NextResponse.json({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      description: organization.description,
      role: "OWNER",
    });
  } catch (error) {
    console.error("Error creating organization:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen der Organisation" },
      { status: 500 }
    );
  }
}
