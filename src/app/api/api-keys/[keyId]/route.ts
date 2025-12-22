import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const updateApiKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  scopes: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

// GET /api/api-keys/[keyId] - Einzelnen API-Key abrufen
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ keyId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { keyId } = await params;

    const apiKey = await prisma.apiKey.findUnique({
      where: { id: keyId },
      include: {
        organization: {
          select: { id: true, name: true },
        },
      },
    });

    if (!apiKey) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }

    // Prüfe ob User Mitglied der Organisation ist
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: apiKey.organizationId,
          userId: session.user.id,
        },
      },
    });

    if (!membership || !membership.isActive) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      scopes: apiKey.scopes,
      rateLimit: apiKey.rateLimit,
      isActive: apiKey.isActive,
      expiresAt: apiKey.expiresAt,
      lastUsedAt: apiKey.lastUsedAt,
      requestCount: apiKey.requestCount,
      organization: apiKey.organization,
      createdBy: apiKey.createdBy,
      createdAt: apiKey.createdAt,
    });
  } catch (error) {
    console.error("Error fetching API key:", error);
    return NextResponse.json(
      { error: "Failed to fetch API key" },
      { status: 500 }
    );
  }
}

// PATCH /api/api-keys/[keyId] - API-Key aktualisieren
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ keyId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { keyId } = await params;
    const body = await request.json();
    const data = updateApiKeySchema.parse(body);

    const apiKey = await prisma.apiKey.findUnique({
      where: { id: keyId },
    });

    if (!apiKey) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }

    // Prüfe Berechtigung
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: apiKey.organizationId,
          userId: session.user.id,
        },
      },
    });

    if (!membership || !membership.isActive) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const updatedApiKey = await prisma.apiKey.update({
      where: { id: keyId },
      data: {
        name: data.name,
        scopes: data.scopes,
        isActive: data.isActive,
        expiresAt: data.expiresAt === null ? null : data.expiresAt ? new Date(data.expiresAt) : undefined,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        isActive: true,
        expiresAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(updatedApiKey);
  } catch (error) {
    console.error("Error updating API key:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update API key" },
      { status: 500 }
    );
  }
}

// DELETE /api/api-keys/[keyId] - API-Key löschen
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ keyId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { keyId } = await params;

    const apiKey = await prisma.apiKey.findUnique({
      where: { id: keyId },
    });

    if (!apiKey) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }

    // Prüfe Berechtigung
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: apiKey.organizationId,
          userId: session.user.id,
        },
      },
    });

    if (!membership || !membership.isActive) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    await prisma.apiKey.delete({
      where: { id: keyId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting API key:", error);
    return NextResponse.json(
      { error: "Failed to delete API key" },
      { status: 500 }
    );
  }
}
