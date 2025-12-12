/**
 * Firecrawl-compatible Crawl API
 * POST /api/v2/crawl - Start crawl
 * GET /api/v2/crawl?id=xxx - Get crawl status
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { WebCrawler } from "@/lib/scraper/crawler";
import type { CrawlOptions, ScrapedDocument } from "@/lib/scraper";

// In-memory crawl storage (in production, use Redis or database)
const activeCrawls = new Map<string, {
  crawler: WebCrawler;
  status: 'active' | 'completed' | 'cancelled' | 'failed';
  results: ScrapedDocument[];
  error?: string;
  startTime: Date;
}>();

// Clean up old crawls periodically
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [id, crawl] of activeCrawls) {
    if (crawl.startTime.getTime() < oneHourAgo && crawl.status !== 'active') {
      activeCrawls.delete(id);
    }
  }
}, 5 * 60 * 1000);

// Crawl request schema
const crawlRequestSchema = z.object({
  url: z.string().url(),
  includePaths: z.array(z.string()).optional(),
  excludePaths: z.array(z.string()).optional(),
  maxDepth: z.number().min(1).max(100).optional().default(10),
  limit: z.number().min(1).max(10000).optional().default(100),
  allowExternalLinks: z.boolean().optional().default(false),
  allowSubdomains: z.boolean().optional().default(false),
  ignoreSitemap: z.boolean().optional().default(false),
  ignoreRobotsTxt: z.boolean().optional().default(false),
  scrapeOptions: z.object({
    formats: z.array(z.enum(['markdown', 'html', 'rawHtml', 'links', 'screenshot'])).optional(),
    onlyMainContent: z.boolean().optional(),
    waitFor: z.number().optional(),
    timeout: z.number().optional(),
  }).optional(),
});

/**
 * POST /api/v2/crawl
 * Start a new crawl
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = crawlRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: "Invalid request", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { url, ...options } = validation.data;

    // Generate crawl ID
    const crawlId = `crawl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Create crawler
    const crawlOptions: CrawlOptions = {
      includePaths: options.includePaths,
      excludePaths: options.excludePaths,
      maxDepth: options.maxDepth,
      limit: options.limit,
      allowExternalLinks: options.allowExternalLinks,
      allowSubdomains: options.allowSubdomains,
      ignoreSitemap: options.ignoreSitemap,
      ignoreRobotsTxt: options.ignoreRobotsTxt,
      scrapeOptions: options.scrapeOptions,
    };

    const crawler = new WebCrawler(crawlId, url, crawlOptions);

    // Store crawler
    activeCrawls.set(crawlId, {
      crawler,
      status: 'active',
      results: [],
      startTime: new Date(),
    });

    // Start crawl in background
    crawler.crawl(5).then((results) => {
      const crawlState = activeCrawls.get(crawlId);
      if (crawlState) {
        crawlState.results = results;
        crawlState.status = 'completed';
      }
    }).catch((error) => {
      const crawlState = activeCrawls.get(crawlId);
      if (crawlState) {
        crawlState.status = 'failed';
        crawlState.error = error instanceof Error ? error.message : 'Unknown error';
      }
    });

    return NextResponse.json({
      success: true,
      id: crawlId,
      url: `/api/v2/crawl?id=${crawlId}`,
    });

  } catch (error) {
    console.error("Crawl error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v2/crawl?id=xxx
 * Get crawl status and results
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const crawlId = searchParams.get('id');

    if (!crawlId) {
      return NextResponse.json(
        { success: false, error: "Missing crawl ID" },
        { status: 400 }
      );
    }

    const crawlState = activeCrawls.get(crawlId);
    if (!crawlState) {
      return NextResponse.json(
        { success: false, error: "Crawl not found" },
        { status: 404 }
      );
    }

    const state = crawlState.crawler.getState();

    return NextResponse.json({
      success: true,
      status: crawlState.status,
      completed: state.completed,
      total: state.total,
      errors: state.errors,
      data: crawlState.results,
      ...(crawlState.error && { error: crawlState.error }),
    });

  } catch (error) {
    console.error("Crawl status error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v2/crawl?id=xxx
 * Cancel a crawl
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const crawlId = searchParams.get('id');

    if (!crawlId) {
      return NextResponse.json(
        { success: false, error: "Missing crawl ID" },
        { status: 400 }
      );
    }

    const crawlState = activeCrawls.get(crawlId);
    if (!crawlState) {
      return NextResponse.json(
        { success: false, error: "Crawl not found" },
        { status: 404 }
      );
    }

    crawlState.crawler.cancel();
    crawlState.status = 'cancelled';

    return NextResponse.json({
      success: true,
      status: 'cancelled',
    });

  } catch (error) {
    console.error("Crawl cancel error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
