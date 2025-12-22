import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generateApiKey } from "@/lib/api-key";
import { z } from "zod";

const createApiKeySchema = z.object({
  organizationId: z.string(),
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()).optional(),
  expiresAt: z.string().datetime().optional(),
});

// GET /api/api-keys - Liste aller API-Keys für eine Organisation
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    if (!organizationId) {
      return NextResponse.json(
        { error: "organizationId required" },
        { status: 400 }
      );
    }

    // Prüfe ob User Mitglied der Organisation ist
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId, userId: session.user.id },
      },
    });

    if (!membership || !membership.isActive) {
      return NextResponse.json(
        { error: "Not a member of this organization" },
        { status: 403 }
      );
    }

    // Nur OWNER und ADMIN dürfen API-Keys sehen
    if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const apiKeys = await prisma.apiKey.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        rateLimit: true,
        isActive: true,
        expiresAt: true,
        lastUsedAt: true,
        requestCount: true,
        createdBy: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(apiKeys);
  } catch (error) {
    console.error("Error fetching API keys:", error);
    return NextResponse.json(
      { error: "Failed to fetch API keys" },
      { status: 500 }
    );
  }
}

// POST /api/api-keys - Neuen API-Key erstellen
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = createApiKeySchema.parse(body);

    // Prüfe ob User Mitglied der Organisation ist
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: data.organizationId,
          userId: session.user.id,
        },
      },
    });

    if (!membership || !membership.isActive) {
      return NextResponse.json(
        { error: "Not a member of this organization" },
        { status: 403 }
      );
    }

    // Nur OWNER und ADMIN dürfen API-Keys erstellen
    if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Generiere neuen API-Key
    const { key, hash, prefix } = generateApiKey();

    // Speichere in DB
    const apiKey = await prisma.apiKey.create({
      data: {
        organizationId: data.organizationId,
        name: data.name,
        keyHash: hash,
        keyPrefix: prefix,
        scopes: data.scopes || [
          "leads:read",
          "leads:write",
          "deals:read",
          "deals:write",
          "activities:read",
          "activities:write",
        ],
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        createdBy: session.user.id,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    // WICHTIG: Den echten Key nur einmal zurückgeben!
    return NextResponse.json(
      {
        ...apiKey,
        key, // Nur bei Erstellung sichtbar!
        message:
          "Speichern Sie diesen API-Key sicher! Er wird nur einmal angezeigt.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating API key:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create API key" },
      { status: 500 }
    );
  }
}
