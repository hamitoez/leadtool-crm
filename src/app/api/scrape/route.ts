import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { verifyRowAccess } from "@/lib/security/authorization";
import { decrypt } from "@/lib/security/encryption";

// Scraper service URL
const SCRAPER_URL = process.env.SCRAPER_URL || "http://127.0.0.1:8765";

// Validation schemas
const singleScrapeSchema = z.object({
  url: z.string().url(),
  apiKey: z.string().optional(),
  // Optional: Update cells directly
  rowId: z.string().optional(),
  columnMappings: z.record(z.string(), z.string()).optional(),
});

const bulkScrapeSchema = z.object({
  urls: z.array(z.object({
    url: z.string().url(),
    rowId: z.string().optional(),
  })),
  apiKey: z.string().optional(),
  columnMappings: z.record(z.string(), z.string()).optional(),
  maxConcurrent: z.number().min(1).max(200).default(100),
});

interface ScrapeResult {
  success: boolean;
  url: string;
  emails: string[];
  phones: string[];
  addresses: string[];
  social: Record<string, string>;
  persons: Array<{ name?: string; position?: string; email?: string; phone?: string }>;
  pages_scraped: string[];
  error?: string;
  firstName?: string;
  lastName?: string;
}

/**
 * POST /api/scrape
 * Scrape a website for contact information
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get user settings for API key
    const userSettings = await prisma.userSettings.findUnique({
      where: { userId },
      select: { aiApiKey: true, aiProvider: true },
    });

    // Decrypt API key if present
    const decryptedApiKey = userSettings?.aiApiKey
      ? decrypt(userSettings.aiApiKey)
      : null;

    const body = await request.json();

    // Check if it's a bulk request
    if (body.urls && Array.isArray(body.urls)) {
      return handleBulkScrape(body, userId, decryptedApiKey || body.apiKey);
    }

    // Single scrape
    const validation = singleScrapeSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { url, apiKey, rowId, columnMappings } = validation.data;
    const effectiveApiKey = decryptedApiKey || apiKey;

    // SECURITY: Verify user owns the row before updating cells
    if (rowId) {
      try {
        await verifyRowAccess(rowId, userId);
      } catch (error) {
        return NextResponse.json(
          { error: "Access denied to this row" },
          { status: 403 }
        );
      }
    }

    // Call scraper service
    const result = await callScraperService(url, effectiveApiKey);

    // If rowId and columnMappings provided, update cells (already verified access)
    if (rowId && columnMappings && result.success) {
      await updateCellsWithScrapeResult(rowId, result, columnMappings as Record<string, string>);
    }

    return NextResponse.json({
      success: result.success,
      data: result,
    });

  } catch (error) {
    console.error("Scrape error:", error);
    return NextResponse.json(
      {
        error: "Scraping failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Handle bulk scraping
 */
async function handleBulkScrape(body: unknown, userId: string, apiKey?: string | null) {
  const validation = bulkScrapeSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid bulk request", details: validation.error.flatten() },
      { status: 400 }
    );
  }

  const { urls, maxConcurrent } = validation.data;

  // SECURITY: Verify user owns all rows before processing
  const rowIds = urls.filter(u => u.rowId).map(u => u.rowId as string);
  if (rowIds.length > 0) {
    try {
      // Verify all rows belong to user in a single query
      const rows = await prisma.row.findMany({
        where: {
          id: { in: rowIds },
        },
        select: {
          id: true,
          table: {
            select: {
              project: {
                select: { userId: true },
              },
            },
          },
        },
      });

      // Check all rows belong to this user
      for (const row of rows) {
        if (row.table.project.userId !== userId) {
          return NextResponse.json(
            { error: "Access denied to one or more rows" },
            { status: 403 }
          );
        }
      }

      // Check we found all requested rows
      if (rows.length !== rowIds.length) {
        return NextResponse.json(
          { error: "One or more rows not found" },
          { status: 404 }
        );
      }
    } catch (error) {
      console.error("Row access verification failed:", error);
      return NextResponse.json(
        { error: "Failed to verify row access" },
        { status: 500 }
      );
    }
  }

  // Call bulk scraper service
  const response = await fetch(`${SCRAPER_URL}/scrape/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      urls: urls.map(u => u.url),
      api_key: apiKey,
      max_concurrent: maxConcurrent,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json(
      { error: "Bulk scraping failed", message: error },
      { status: 500 }
    );
  }

  const jobData = await response.json();

  return NextResponse.json({
    success: true,
    jobId: jobData.job_id,
    status: jobData.status,
    total: jobData.total,
    maxConcurrent: jobData.max_concurrent,
  });
}

/**
 * Call the Python scraper service
 */
async function callScraperService(
  url: string,
  apiKey?: string | null,
): Promise<ScrapeResult> {
  try {
    const response = await fetch(`${SCRAPER_URL}/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        api_key: apiKey,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Scraper service error: ${error}`);
    }

    const data = await response.json();
    return data.data || data;

  } catch (error) {
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error("Scraper service is not running. Start with: cd scraper && python -m scraper.server");
    }
    throw error;
  }
}

/**
 * Update cells with scraped data
 * Note: Authorization should be verified BEFORE calling this function
 */
async function updateCellsWithScrapeResult(
  rowId: string,
  result: ScrapeResult,
  columnMappings: Record<string, string>
) {
  const updates: Array<{ columnId: string; value: string }> = [];

  // Map firstName/lastName
  if (columnMappings.firstName && result.firstName) {
    updates.push({ columnId: columnMappings.firstName, value: result.firstName });
  }

  if (columnMappings.lastName && result.lastName) {
    updates.push({ columnId: columnMappings.lastName, value: result.lastName });
  }

  // Map email
  if (columnMappings.email && result.emails.length > 0) {
    updates.push({ columnId: columnMappings.email, value: result.emails[0] });
  }

  // Map phone
  if (columnMappings.phone && result.phones.length > 0) {
    updates.push({ columnId: columnMappings.phone, value: result.phones[0] });
  }

  // Map address
  if (columnMappings.address && result.addresses.length > 0) {
    updates.push({ columnId: columnMappings.address, value: result.addresses[0] });
  }

  // Person data fallback
  if (result.persons.length > 0) {
    const person = result.persons[0];

    if (columnMappings.contactName && person.name) {
      updates.push({ columnId: columnMappings.contactName, value: person.name });
    }

    if (person.name && !result.firstName && !result.lastName) {
      const parts = person.name.trim().split(/\s+/);
      if (parts.length >= 2) {
        if (columnMappings.firstName && parts[0]) {
          updates.push({ columnId: columnMappings.firstName, value: parts[0] });
        }
        if (columnMappings.lastName && parts.slice(1).join(" ")) {
          updates.push({ columnId: columnMappings.lastName, value: parts.slice(1).join(" ") });
        }
      }
    }

    if (columnMappings.contactPosition && person.position) {
      updates.push({ columnId: columnMappings.contactPosition, value: person.position });
    }
  }

  // Update cells in database using transaction for consistency
  await prisma.$transaction(
    updates.map(update =>
      prisma.cell.updateMany({
        where: {
          rowId,
          columnId: update.columnId,
        },
        data: {
          value: update.value,
          metadata: {
            source: "web_scrape",
            scrapedAt: new Date().toISOString(),
            sourceUrl: result.url,
          },
        },
      })
    )
  );
}

/**
 * GET /api/scrape
 * Check if scraper service is running
 */
export async function GET() {
  try {
    const response = await fetch(`${SCRAPER_URL}/health`);

    if (!response.ok) {
      return NextResponse.json({
        status: "error",
        message: "Scraper service is not responding",
      }, { status: 503 });
    }

    const health = await response.json();

    return NextResponse.json({
      status: "ok",
      scraperService: health,
    });

  } catch {
    return NextResponse.json({
      status: "error",
      message: "Scraper service is not running",
      hint: "Start with: cd scraper && python -m scraper.server",
    }, { status: 503 });
  }
}
