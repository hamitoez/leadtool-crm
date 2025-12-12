import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { verifyRowAccess } from "@/lib/security/authorization";
import { decrypt } from "@/lib/security/encryption";
import { notifyScrapingComplete, notifyScrapingFailed } from "@/lib/notifications";

// Import our new Node.js scraper
import {
  scrape,
  scrapeMany,
  scrapeAndExtractContacts,
  type ContactExtractionResult,
} from "@/lib/scraper";

// Validation schemas
const singleScrapeSchema = z.object({
  url: z.string().url(),
  // LLM options
  useLLM: z.boolean().default(true),
  discoverContactPages: z.boolean().default(true),
  // Optional: Update cells directly
  rowId: z.string().optional(),
  columnMappings: z.record(z.string(), z.string()).optional(),
  // Advanced options
  timeout: z.number().min(5000).max(120000).default(30000),
  formats: z.array(z.enum(['markdown', 'html', 'rawHtml', 'links', 'screenshot'])).optional(),
});

const bulkScrapeSchema = z.object({
  urls: z.array(z.object({
    url: z.string().url(),
    rowId: z.string().optional(),
  })),
  useLLM: z.boolean().default(true),
  discoverContactPages: z.boolean().default(true),
  columnMappings: z.record(z.string(), z.string()).optional(),
  maxConcurrent: z.number().min(1).max(50).default(10),
  timeout: z.number().min(5000).max(120000).default(30000),
});

interface ScrapeResult {
  success: boolean;
  url: string;
  emails: string[];
  phones: string[];
  addresses: string[];
  social: Record<string, string | undefined>;
  persons: Array<{ name?: string; position?: string; email?: string; phone?: string }>;
  pages_scraped: string[];
  error?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  confidence?: number;
  markdown?: string;
}

/**
 * POST /api/scrape
 * Scrape a website for contact information using Node.js scraper
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

    const aiProvider = (userSettings?.aiProvider || 'openai') as 'openai' | 'anthropic' | 'ollama';

    const body = await request.json();

    // Check if it's a bulk request
    if (body.urls && Array.isArray(body.urls)) {
      return handleBulkScrape(body, userId, decryptedApiKey, aiProvider);
    }

    // Single scrape
    const validation = singleScrapeSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { url, useLLM, discoverContactPages, rowId, columnMappings, timeout } = validation.data;

    // SECURITY: Verify user owns the row before updating cells
    if (rowId) {
      try {
        await verifyRowAccess(rowId, userId);
      } catch {
        return NextResponse.json(
          { error: "Access denied to this row" },
          { status: 403 }
        );
      }
    }

    // Scrape using our Node.js scraper
    const result = await scrapeWithNodeScraper(url, {
      useLLM: useLLM && !!decryptedApiKey,
      discoverContactPages,
      llmProvider: aiProvider,
      llmApiKey: decryptedApiKey || undefined,
      timeout,
    });

    // If rowId and columnMappings provided, update cells (already verified access)
    if (rowId && columnMappings && result.success) {
      await updateCellsWithScrapeResult(rowId, result, columnMappings as Record<string, string>);
    }

    // Send notification for single scrape
    if (result.success) {
      const contactCount = (result.emails?.length || 0) + (result.phones?.length || 0) + (result.persons?.length || 0);
      if (contactCount > 0) {
        await notifyScrapingComplete(
          userId,
          new URL(url).hostname,
          contactCount
        ).catch(err => console.error("Failed to send scrape notification:", err));
      }
    } else if (result.error) {
      await notifyScrapingFailed(
        userId,
        new URL(url).hostname,
        result.error
      ).catch(err => console.error("Failed to send scrape error notification:", err));
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
 * Scrape using our Node.js scraper
 */
async function scrapeWithNodeScraper(
  url: string,
  options: {
    useLLM: boolean;
    discoverContactPages: boolean;
    llmProvider?: 'openai' | 'anthropic' | 'ollama';
    llmApiKey?: string;
    timeout?: number;
  }
): Promise<ScrapeResult> {
  try {
    // Use contact extraction for CRM use case
    const result: ContactExtractionResult = await scrapeAndExtractContacts(url, {
      llmProvider: options.useLLM ? options.llmProvider : undefined,
      llmApiKey: options.useLLM ? options.llmApiKey : undefined,
      timeout: options.timeout,
      discoverContactPages: options.discoverContactPages,
    });

    if (!result.success || !result.data) {
      return {
        success: false,
        url,
        emails: [],
        phones: [],
        addresses: [],
        social: {},
        persons: [],
        pages_scraped: result.pagesScraped,
        error: result.error,
      };
    }

    // Parse first/last name from first contact person
    let firstName: string | undefined;
    let lastName: string | undefined;
    if (result.data.contactPersons.length > 0) {
      const name = result.data.contactPersons[0].name;
      if (name) {
        const parts = name.trim().split(/\s+/);
        firstName = parts[0];
        lastName = parts.slice(1).join(" ") || undefined;
      }
    }

    return {
      success: true,
      url,
      emails: result.data.emails,
      phones: result.data.phones,
      addresses: result.data.addresses,
      social: result.data.socialLinks,
      persons: result.data.contactPersons.map(p => ({
        name: p.name,
        position: p.position,
        email: p.email,
        phone: p.phone,
      })),
      pages_scraped: result.pagesScraped,
      firstName,
      lastName,
      companyName: result.data.companyName,
      confidence: result.confidence,
    };

  } catch (error) {
    return {
      success: false,
      url,
      emails: [],
      phones: [],
      addresses: [],
      social: {},
      persons: [],
      pages_scraped: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Handle bulk scraping
 */
async function handleBulkScrape(
  body: unknown,
  userId: string,
  apiKey: string | null,
  aiProvider: 'openai' | 'anthropic' | 'ollama'
) {
  const validation = bulkScrapeSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid bulk request", details: validation.error.flatten() },
      { status: 400 }
    );
  }

  const { urls, useLLM, discoverContactPages, columnMappings, maxConcurrent, timeout } = validation.data;

  // SECURITY: Verify user owns all rows before processing
  const rowIds = urls.filter(u => u.rowId).map(u => u.rowId as string);
  if (rowIds.length > 0) {
    try {
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

      for (const row of rows) {
        if (row.table.project.userId !== userId) {
          return NextResponse.json(
            { error: "Access denied to one or more rows" },
            { status: 403 }
          );
        }
      }

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

  // Process URLs in batches using our Node.js scraper
  const results: ScrapeResult[] = [];
  const urlList = urls.map(u => u.url);

  // Process in batches
  for (let i = 0; i < urlList.length; i += maxConcurrent) {
    const batch = urlList.slice(i, i + maxConcurrent);
    const batchUrls = urls.slice(i, i + maxConcurrent);

    const batchPromises = batch.map((url, idx) =>
      scrapeWithNodeScraper(url, {
        useLLM: useLLM && !!apiKey,
        discoverContactPages,
        llmProvider: aiProvider,
        llmApiKey: apiKey || undefined,
        timeout,
      }).then(async (result) => {
        // Update cells if rowId provided
        const rowId = batchUrls[idx].rowId;
        if (rowId && columnMappings && result.success) {
          await updateCellsWithScrapeResult(rowId, result, columnMappings);
        }
        return result;
      })
    );

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  // Calculate summary
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const totalContacts = results.reduce((sum, r) =>
    sum + (r.emails?.length || 0) + (r.phones?.length || 0), 0
  );

  // Send notification
  if (successful > 0) {
    await notifyScrapingComplete(
      userId,
      `${successful} websites`,
      totalContacts
    ).catch(err => console.error("Failed to send bulk scrape notification:", err));
  }

  return NextResponse.json({
    success: true,
    total: urls.length,
    successful,
    failed,
    totalContacts,
    results,
  });
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

  // Map company name
  if (columnMappings.companyName && result.companyName) {
    updates.push({ columnId: columnMappings.companyName, value: result.companyName });
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

  // Social links
  if (columnMappings.linkedin && result.social?.linkedin) {
    updates.push({ columnId: columnMappings.linkedin, value: result.social.linkedin });
  }
  if (columnMappings.twitter && result.social?.twitter) {
    updates.push({ columnId: columnMappings.twitter, value: result.social.twitter });
  }
  if (columnMappings.facebook && result.social?.facebook) {
    updates.push({ columnId: columnMappings.facebook, value: result.social.facebook });
  }
  if (columnMappings.xing && result.social?.xing) {
    updates.push({ columnId: columnMappings.xing, value: result.social.xing });
  }

  if (updates.length === 0) return;

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
            source: "node_scraper",
            scrapedAt: new Date().toISOString(),
            sourceUrl: result.url,
            confidence: result.confidence,
          },
        },
      })
    )
  );
}

/**
 * GET /api/scrape
 * Health check for scraper
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    scraper: "node.js",
    version: "1.0.0",
    features: [
      "single-url-scrape",
      "bulk-scrape",
      "contact-extraction",
      "llm-extraction",
      "markdown-conversion",
      "screenshot",
    ],
    engines: ["playwright", "fetch"],
  });
}
