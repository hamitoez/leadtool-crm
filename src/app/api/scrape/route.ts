import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import prisma from "@/lib/prisma";

// Scraper service URL
const SCRAPER_URL = process.env.SCRAPER_URL || "http://127.0.0.1:8765";

// Validation schemas
const singleScrapeSchema = z.object({
  url: z.string().url(),
  useSelenium: z.boolean().default(true),
  useCrawl4ai: z.boolean().default(false),
  useAI: z.boolean().default(true),
  apiKey: z.string().optional(),
  provider: z.enum(["anthropic", "openai", "google", "deepseek", "groq", "mistral"]).default("deepseek"),
  // Optional: Update cells directly
  rowId: z.string().optional(),
  columnMappings: z.record(z.string(), z.string()).optional(), // e.g., { "email": "columnId1", "phone": "columnId2" }
});

const bulkScrapeSchema = z.object({
  urls: z.array(z.object({
    url: z.string().url(),
    rowId: z.string().optional(),
  })),
  useSelenium: z.boolean().default(true),
  useCrawl4ai: z.boolean().default(false),
  useAI: z.boolean().default(true),
  apiKey: z.string().optional(),
  provider: z.enum(["anthropic", "openai", "google", "deepseek", "groq", "mistral"]).default("deepseek"),
  columnMappings: z.record(z.string(), z.string()).optional(),
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
  // AI-extracted fields
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

    const body = await request.json();

    // Check if it's a bulk request
    if (body.urls && Array.isArray(body.urls)) {
      return handleBulkScrape(body, session.user.id);
    }

    // Single scrape
    const validation = singleScrapeSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { url, useSelenium, useCrawl4ai, useAI, apiKey, provider, rowId, columnMappings } = validation.data;

    // Call scraper service
    const result = await callScraperService(url, {
      useSelenium,
      useCrawl4ai,
      useAI,
      apiKey,
      provider,
    });

    // If rowId and columnMappings provided, update cells
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
async function handleBulkScrape(body: unknown, userId: string) {
  const validation = bulkScrapeSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid bulk request", details: validation.error.flatten() },
      { status: 400 }
    );
  }

  const { urls, useSelenium, useCrawl4ai, useAI, apiKey, provider, columnMappings } = validation.data;

  // Call bulk scraper service
  const response = await fetch(`${SCRAPER_URL}/scrape/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      urls: urls.map(u => u.url),
      use_selenium: useSelenium,
      use_crawl4ai: useCrawl4ai,
      use_ai: useAI,
      api_key: apiKey,
      provider,
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
  });
}

/**
 * Call the Python scraper service
 */
async function callScraperService(
  url: string,
  options: {
    useSelenium: boolean;
    useCrawl4ai: boolean;
    useAI: boolean;
    apiKey?: string;
    provider: string;
  }
): Promise<ScrapeResult> {
  try {
    const response = await fetch(`${SCRAPER_URL}/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        use_selenium: options.useSelenium,
        use_crawl4ai: options.useCrawl4ai,
        use_ai: options.useAI,
        api_key: options.apiKey,
        provider: options.provider,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Scraper service error: ${error}`);
    }

    return await response.json();

  } catch (error) {
    // If scraper service is not running, return error
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error("Scraper service is not running. Please start it with: cd scraper && start.bat");
    }
    throw error;
  }
}

/**
 * Split a full name into first name and last name
 */
function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }
  // First part is first name, rest is last name
  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ");
  return { firstName, lastName };
}

/**
 * Update cells with scraped data
 */
async function updateCellsWithScrapeResult(
  rowId: string,
  result: ScrapeResult,
  columnMappings: Record<string, string>
) {
  const updates: Array<{ columnId: string; value: string }> = [];

  // Priority 1: AI-extracted firstName/lastName (most reliable for German Impressum)
  if (columnMappings.firstName && result.firstName) {
    updates.push({ columnId: columnMappings.firstName, value: result.firstName });
  }

  if (columnMappings.lastName && result.lastName) {
    updates.push({ columnId: columnMappings.lastName, value: result.lastName });
  }

  // Map scraped data to columns
  if (columnMappings.email && result.emails.length > 0) {
    updates.push({ columnId: columnMappings.email, value: result.emails[0] });
  }

  if (columnMappings.phone && result.phones.length > 0) {
    updates.push({ columnId: columnMappings.phone, value: result.phones[0] });
  }

  if (columnMappings.address && result.addresses.length > 0) {
    updates.push({ columnId: columnMappings.address, value: result.addresses[0] });
  }

  if (columnMappings.linkedin && result.social.linkedin) {
    updates.push({ columnId: columnMappings.linkedin, value: result.social.linkedin });
  }

  if (columnMappings.facebook && result.social.facebook) {
    updates.push({ columnId: columnMappings.facebook, value: result.social.facebook });
  }

  if (columnMappings.instagram && result.social.instagram) {
    updates.push({ columnId: columnMappings.instagram, value: result.social.instagram });
  }

  // Person data (fallback if AI extraction didn't get names)
  if (result.persons.length > 0) {
    const person = result.persons[0];

    // Full name mapping
    if (columnMappings.contactName && person.name) {
      updates.push({ columnId: columnMappings.contactName, value: person.name });
    }

    // Split name into first name and last name (only if not already set by AI)
    if (person.name && (columnMappings.firstName || columnMappings.lastName)) {
      const { firstName, lastName } = splitName(person.name);

      // Only use fallback if AI didn't extract
      if (columnMappings.firstName && firstName && !result.firstName) {
        updates.push({ columnId: columnMappings.firstName, value: firstName });
      }

      if (columnMappings.lastName && lastName && !result.lastName) {
        updates.push({ columnId: columnMappings.lastName, value: lastName });
      }
    }

    if (columnMappings.contactPosition && person.position) {
      updates.push({ columnId: columnMappings.contactPosition, value: person.position });
    }

    // Person-specific email (prioritize over general email)
    if (columnMappings.contactEmail && person.email) {
      updates.push({ columnId: columnMappings.contactEmail, value: person.email });
    }

    // Also fill regular email column with person's email if not already set
    if (columnMappings.email && person.email && result.emails.length === 0) {
      updates.push({ columnId: columnMappings.email, value: person.email });
    }

    if (columnMappings.contactPhone && person.phone) {
      updates.push({ columnId: columnMappings.contactPhone, value: person.phone });
    }
  }

  // Update cells in database
  for (const update of updates) {
    await prisma.cell.updateMany({
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
    });
  }
}

/**
 * GET /api/scrape/health
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
      hint: "Start the scraper with: cd scraper && start.bat",
    }, { status: 503 });
  }
}
