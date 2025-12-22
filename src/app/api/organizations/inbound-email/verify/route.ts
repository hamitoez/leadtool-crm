/**
 * Inbound Email Verification API
 *
 * Tests the Mailgun/SendGrid/Postmark configuration by:
 * 1. Validating API key
 * 2. Checking domain configuration
 * 3. Verifying MX records point to the provider
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import dns from "dns/promises";

interface VerificationResult {
  success: boolean;
  apiKeyValid: boolean;
  domainConfigured: boolean;
  mxRecordsValid: boolean;
  errors: string[];
  details: {
    provider: string;
    domain: string;
    expectedMx?: string[];
    actualMx?: string[];
  };
}

/**
 * POST /api/organizations/inbound-email/verify
 * Verify inbound email configuration
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get user's organization
    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        isActive: true,
        role: { in: ["OWNER", "ADMIN"] },
      },
      include: {
        organization: {
          include: {
            inboundEmailSettings: true,
          },
        },
      },
    });

    if (!membership?.organization?.inboundEmailSettings) {
      return NextResponse.json(
        { error: "No inbound email settings found" },
        { status: 404 }
      );
    }

    const settings = membership.organization.inboundEmailSettings;

    if (!settings.inboundDomain) {
      return NextResponse.json(
        { error: "No inbound domain configured" },
        { status: 400 }
      );
    }

    const result: VerificationResult = {
      success: false,
      apiKeyValid: false,
      domainConfigured: false,
      mxRecordsValid: false,
      errors: [],
      details: {
        provider: settings.provider,
        domain: settings.inboundDomain,
      },
    };

    // Verify based on provider
    if (settings.provider === "MAILGUN") {
      await verifyMailgun(settings, result);
    } else if (settings.provider === "SENDGRID") {
      await verifySendGrid(settings, result);
    } else if (settings.provider === "POSTMARK") {
      await verifyPostmark(settings, result);
    } else {
      result.errors.push("Provider not configured. Please select a provider.");
    }

    // Check MX records
    await verifyMxRecords(settings, result);

    // Determine overall success
    result.success = result.apiKeyValid && result.mxRecordsValid;

    // Update verification status in database
    await prisma.inboundEmailSettings.update({
      where: { id: settings.id },
      data: {
        isVerified: result.success,
        verifiedAt: result.success ? new Date() : null,
        verificationError: result.errors.length > 0 ? result.errors.join("; ") : null,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Inbound Email Verify] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Verification failed",
      },
      { status: 500 }
    );
  }
}

/**
 * Verify Mailgun API key and domain
 */
async function verifyMailgun(
  settings: { apiKey: string | null; inboundDomain: string | null; mailgunRegion: string | null },
  result: VerificationResult
): Promise<void> {
  if (!settings.apiKey) {
    result.errors.push("Mailgun API key not configured");
    return;
  }

  const region = settings.mailgunRegion === "EU" ? "api.eu.mailgun.net" : "api.mailgun.net";

  try {
    // Test API key by fetching domains
    const response = await fetch(`https://${region}/v3/domains`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${settings.apiKey}`).toString("base64")}`,
      },
    });

    if (response.ok) {
      result.apiKeyValid = true;

      // Check if domain is configured
      const data = await response.json();
      const domains = data.items || [];
      const domainConfigured = domains.some(
        (d: { name: string }) => d.name === settings.inboundDomain
      );

      if (domainConfigured) {
        result.domainConfigured = true;
      } else {
        result.errors.push(`Domain "${settings.inboundDomain}" not found in Mailgun. Please add it first.`);
      }
    } else {
      result.errors.push("Invalid Mailgun API key");
    }
  } catch (error) {
    result.errors.push(`Mailgun API error: ${error instanceof Error ? error.message : "Unknown"}`);
  }

  // Expected MX records for Mailgun
  result.details.expectedMx = ["mxa.mailgun.org", "mxb.mailgun.org"];
}

/**
 * Verify SendGrid API key
 */
async function verifySendGrid(
  settings: { apiKey: string | null; inboundDomain: string | null },
  result: VerificationResult
): Promise<void> {
  if (!settings.apiKey) {
    result.errors.push("SendGrid API key not configured");
    return;
  }

  try {
    // Test API key
    const response = await fetch("https://api.sendgrid.com/v3/user/profile", {
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
      },
    });

    if (response.ok) {
      result.apiKeyValid = true;
      result.domainConfigured = true; // SendGrid doesn't require domain verification for Inbound Parse
    } else {
      result.errors.push("Invalid SendGrid API key");
    }
  } catch (error) {
    result.errors.push(`SendGrid API error: ${error instanceof Error ? error.message : "Unknown"}`);
  }

  // Expected MX records for SendGrid Inbound Parse
  result.details.expectedMx = ["mx.sendgrid.net"];
}

/**
 * Verify Postmark API key
 */
async function verifyPostmark(
  settings: { apiKey: string | null; inboundDomain: string | null },
  result: VerificationResult
): Promise<void> {
  if (!settings.apiKey) {
    result.errors.push("Postmark API key not configured");
    return;
  }

  try {
    // Test API key
    const response = await fetch("https://api.postmarkapp.com/server", {
      headers: {
        "X-Postmark-Server-Token": settings.apiKey,
        Accept: "application/json",
      },
    });

    if (response.ok) {
      result.apiKeyValid = true;
      result.domainConfigured = true;
    } else {
      result.errors.push("Invalid Postmark API key");
    }
  } catch (error) {
    result.errors.push(`Postmark API error: ${error instanceof Error ? error.message : "Unknown"}`);
  }

  // Expected MX records for Postmark
  result.details.expectedMx = ["inbound.postmarkapp.com"];
}

/**
 * Verify MX records for the domain
 */
async function verifyMxRecords(
  settings: { inboundDomain: string | null; provider: string },
  result: VerificationResult
): Promise<void> {
  if (!settings.inboundDomain) {
    result.errors.push("No inbound domain configured");
    return;
  }

  try {
    const mxRecords = await dns.resolveMx(settings.inboundDomain);
    result.details.actualMx = mxRecords.map((r) => r.exchange.toLowerCase());

    // Check if MX records match expected
    if (result.details.expectedMx && result.details.expectedMx.length > 0) {
      const hasExpectedMx = result.details.expectedMx.some((expected) =>
        result.details.actualMx?.some((actual) =>
          actual.includes(expected.replace(/\.$/, "").toLowerCase())
        )
      );

      if (hasExpectedMx) {
        result.mxRecordsValid = true;
      } else {
        result.errors.push(
          `MX records not configured correctly. Expected: ${result.details.expectedMx.join(", ")}. Found: ${result.details.actualMx?.join(", ") || "none"}`
        );
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENODATA") {
      result.errors.push(`No MX records found for "${settings.inboundDomain}"`);
    } else if ((error as NodeJS.ErrnoException).code === "ENOTFOUND") {
      result.errors.push(`Domain "${settings.inboundDomain}" not found`);
    } else {
      result.errors.push(`DNS lookup failed: ${error instanceof Error ? error.message : "Unknown"}`);
    }
  }
}
