/**
 * Firecrawl-compatible Scrape API
 * POST /api/v2/scrape
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { scrape, type ScrapeOptions, type OutputFormat } from "@/lib/scraper";

// Firecrawl-compatible schema
const scrapeRequestSchema = z.object({
  url: z.string().url(),
  formats: z.array(z.enum(['markdown', 'html', 'rawHtml', 'links', 'screenshot'])).optional(),
  onlyMainContent: z.boolean().optional().default(true),
  includeTags: z.array(z.string()).optional(),
  excludeTags: z.array(z.string()).optional(),
  waitFor: z.number().min(0).max(60000).optional(),
  timeout: z.number().min(1000).max(120000).optional().default(30000),
  headers: z.record(z.string(), z.string()).optional(),
  mobile: z.boolean().optional(),
  actions: z.array(z.object({
    type: z.enum(['click', 'type', 'wait', 'scroll', 'screenshot']),
    selector: z.string().optional(),
    text: z.string().optional(),
    milliseconds: z.number().optional(),
    direction: z.enum(['up', 'down']).optional(),
    amount: z.number().optional(),
  })).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = scrapeRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: "Invalid request", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { url, formats, onlyMainContent, waitFor, timeout, headers, mobile, actions } = validation.data;

    // Build scrape options
    const scrapeOptions: ScrapeOptions = {
      formats: (formats as OutputFormat[]) || ['markdown'],
      onlyMainContent,
      waitFor,
      timeout,
      headers,
      mobile,
      actions,
    };

    // Scrape
    const result = await scrape(url, scrapeOptions);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });

  } catch (error) {
    console.error("Scrape error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
