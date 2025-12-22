/**
 * Inbound Email Settings API
 *
 * Manages Mailgun/SendGrid/Postmark configuration for webhook-based reply detection.
 * Settings are stored per organization.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import crypto from "crypto";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * GET /api/organizations/inbound-email
 * Get inbound email settings for the user's organization
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get user's organization
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id, isActive: true },
      include: {
        organization: {
          include: {
            inboundEmailSettings: true,
          },
        },
      },
    });

    if (!membership?.organization) {
      return NextResponse.json({
        settings: null,
        message: "No organization found",
      });
    }

    const settings = membership.organization.inboundEmailSettings;

    // Generate webhook URL
    const webhookUrl = `${APP_URL}/api/webhooks/inbound-email`;

    return NextResponse.json({
      settings: settings
        ? {
            id: settings.id,
            provider: settings.provider,
            isActive: settings.isActive,
            isVerified: settings.isVerified,
            inboundDomain: settings.inboundDomain,
            mailgunRegion: settings.mailgunRegion,
            // Don't expose API keys
            hasApiKey: !!settings.apiKey,
            hasWebhookSecret: !!settings.webhookSecret,
            webhookUrl,
            lastWebhookAt: settings.lastWebhookAt,
            totalReceived: settings.totalReceived,
            totalProcessed: settings.totalProcessed,
            totalFailed: settings.totalFailed,
            verifiedAt: settings.verifiedAt,
            verificationError: settings.verificationError,
            createdAt: settings.createdAt,
            updatedAt: settings.updatedAt,
          }
        : null,
      webhookUrl,
      organizationId: membership.organizationId,
    });
  } catch (error) {
    console.error("[Inbound Email API] GET error:", error);
    return NextResponse.json(
      { error: "Failed to load settings" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/organizations/inbound-email
 * Create or update inbound email settings
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      provider,
      inboundDomain,
      apiKey,
      webhookSecret,
      mailgunRegion,
      isActive,
    } = body;

    // Get user's organization (must be admin or owner)
    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        isActive: true,
        role: { in: ["OWNER", "ADMIN"] },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Validate provider
    const validProviders = ["MAILGUN", "SENDGRID", "POSTMARK", "NONE"];
    if (provider && !validProviders.includes(provider)) {
      return NextResponse.json(
        { error: "Invalid provider" },
        { status: 400 }
      );
    }

    // Validate domain format
    if (inboundDomain && !/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(inboundDomain)) {
      return NextResponse.json(
        { error: "Invalid domain format" },
        { status: 400 }
      );
    }

    // Generate webhook URL with secret
    const webhookUrl = `${APP_URL}/api/webhooks/inbound-email?provider=${(provider || "mailgun").toLowerCase()}`;

    // Check if settings exist
    const existingSettings = await prisma.inboundEmailSettings.findUnique({
      where: { organizationId: membership.organizationId },
    });

    // Build update data
    const updateData: Record<string, unknown> = {
      webhookUrl,
    };

    if (provider !== undefined) updateData.provider = provider;
    if (inboundDomain !== undefined) updateData.inboundDomain = inboundDomain;
    if (apiKey !== undefined && apiKey !== "") updateData.apiKey = apiKey;
    if (webhookSecret !== undefined && webhookSecret !== "") updateData.webhookSecret = webhookSecret;
    if (mailgunRegion !== undefined) updateData.mailgunRegion = mailgunRegion;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Reset verification if credentials changed
    if (apiKey || inboundDomain) {
      updateData.isVerified = false;
      updateData.verifiedAt = null;
      updateData.verificationError = null;
    }

    let settings;
    if (existingSettings) {
      settings = await prisma.inboundEmailSettings.update({
        where: { id: existingSettings.id },
        data: updateData,
      });
    } else {
      // Generate a webhook secret if not provided
      const generatedSecret = webhookSecret || crypto.randomBytes(32).toString("hex");

      settings = await prisma.inboundEmailSettings.create({
        data: {
          organizationId: membership.organizationId,
          provider: provider || "NONE",
          inboundDomain,
          apiKey,
          webhookSecret: generatedSecret,
          mailgunRegion: mailgunRegion || "EU",
          webhookUrl,
          isActive: isActive ?? false,
        },
      });
    }

    return NextResponse.json({
      success: true,
      settings: {
        id: settings.id,
        provider: settings.provider,
        isActive: settings.isActive,
        isVerified: settings.isVerified,
        inboundDomain: settings.inboundDomain,
        mailgunRegion: settings.mailgunRegion,
        hasApiKey: !!settings.apiKey,
        hasWebhookSecret: !!settings.webhookSecret,
        webhookUrl: settings.webhookUrl,
      },
    });
  } catch (error) {
    console.error("[Inbound Email API] POST error:", error);
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/organizations/inbound-email
 * Delete inbound email settings
 */
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get user's organization (must be admin or owner)
    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        isActive: true,
        role: { in: ["OWNER", "ADMIN"] },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    await prisma.inboundEmailSettings.deleteMany({
      where: { organizationId: membership.organizationId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Inbound Email API] DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete settings" },
      { status: 500 }
    );
  }
}
