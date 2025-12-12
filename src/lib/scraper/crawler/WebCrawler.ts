/**
 * WebCrawler
 * Multi-page website crawler with URL filtering, depth control, and deduplication
 */

import { scrape } from '../index';
import { fetchRobotsTxt, isUrlAllowedByRobots } from './robots';
import { discoverSitemaps, fetchAllSitemapUrls } from './sitemap';
import { extractLinks } from '../transformers';
import type {
  CrawlOptions,
  ScrapeOptions,
  ScrapedDocument,
  CrawlStatus,
} from '../types';

interface CrawlState {
  id: string;
  status: CrawlStatus;
  originUrl: string;
  options: CrawlOptions;
  visited: Set<string>;
  queue: Array<{ url: string; depth: number }>;
  results: ScrapedDocument[];
  errors: Map<string, string>;
  startTime: Date;
}

type CrawlProgressCallback = (state: {
  completed: number;
  total: number;
  currentUrl: string;
}) => void;

/**
 * WebCrawler class for crawling websites
 */
export class WebCrawler {
  private state: CrawlState;
  private robots: Awaited<ReturnType<typeof fetchRobotsTxt>> | null = null;
  private aborted: boolean = false;
  private onProgress?: CrawlProgressCallback;

  constructor(
    crawlId: string,
    originUrl: string,
    options: CrawlOptions = {},
    onProgress?: CrawlProgressCallback
  ) {
    this.state = {
      id: crawlId,
      status: 'active',
      originUrl: this.normalizeUrl(originUrl),
      options: {
        maxDepth: options.maxDepth ?? 10,
        limit: options.limit ?? 100,
        allowExternalLinks: options.allowExternalLinks ?? false,
        allowSubdomains: options.allowSubdomains ?? false,
        ignoreSitemap: options.ignoreSitemap ?? false,
        ignoreRobotsTxt: options.ignoreRobotsTxt ?? false,
        includePaths: options.includePaths ?? [],
        excludePaths: options.excludePaths ?? [],
        scrapeOptions: options.scrapeOptions ?? { formats: ['markdown'] },
        webhook: options.webhook,
      },
      visited: new Set<string>(),
      queue: [],
      results: [],
      errors: new Map(),
      startTime: new Date(),
    };
    this.onProgress = onProgress;
  }

  /**
   * Initialize crawler (fetch robots.txt, discover sitemaps)
   */
  async initialize(): Promise<void> {
    // Fetch robots.txt
    if (!this.state.options.ignoreRobotsTxt) {
      this.robots = await fetchRobotsTxt(this.state.originUrl);
    }

    // Add origin URL to queue
    this.addToQueue(this.state.originUrl, 0);

    // Discover and process sitemap if not ignored
    if (!this.state.options.ignoreSitemap) {
      const sitemapUrls = await discoverSitemaps(
        this.state.originUrl,
        this.robots?.sitemaps || []
      );

      if (sitemapUrls.length > 0) {
        const sitemapResult = await fetchAllSitemapUrls(
          sitemapUrls,
          30000,
          this.state.options.limit || 100
        );

        for (const url of sitemapResult.urls) {
          this.addToQueue(url, 1);
        }
      }
    }
  }

  /**
   * Run the crawler
   */
  async crawl(concurrency: number = 3): Promise<ScrapedDocument[]> {
    await this.initialize();

    while (this.state.queue.length > 0 && !this.aborted) {
      // Check limit
      if (
        this.state.options.limit &&
        this.state.results.length >= this.state.options.limit
      ) {
        break;
      }

      // Get batch of URLs to process
      const batch = this.state.queue.splice(0, concurrency);

      // Process batch in parallel
      await Promise.all(
        batch.map(({ url, depth }) => this.processUrl(url, depth))
      );

      // Respect crawl delay
      if (this.robots?.crawlDelay) {
        await this.sleep(this.robots.crawlDelay * 1000);
      }
    }

    this.state.status = this.aborted ? 'cancelled' : 'completed';
    return this.state.results;
  }

  /**
   * Process a single URL
   */
  private async processUrl(url: string, depth: number): Promise<void> {
    if (this.aborted) return;

    // Mark as visited
    this.state.visited.add(url);

    // Report progress
    if (this.onProgress) {
      this.onProgress({
        completed: this.state.results.length,
        total: this.state.visited.size + this.state.queue.length,
        currentUrl: url,
      });
    }

    try {
      // Scrape URL
      const result = await scrape(url, {
        ...this.state.options.scrapeOptions,
        formats: [
          ...(this.state.options.scrapeOptions?.formats || ['markdown']),
          'links', // Always get links for discovery
        ],
      });

      if (result.success && result.data) {
        this.state.results.push(result.data);

        // Discover new URLs from links
        if (result.data.links && depth < (this.state.options.maxDepth || 10)) {
          for (const link of result.data.links) {
            this.addToQueue(link, depth + 1);
          }
        }
      } else {
        this.state.errors.set(url, result.error || 'Unknown error');
      }
    } catch (error) {
      this.state.errors.set(
        url,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Add URL to queue if it passes filters
   */
  private addToQueue(url: string, depth: number): boolean {
    const normalizedUrl = this.normalizeUrl(url);

    // Skip if already visited or queued
    if (this.state.visited.has(normalizedUrl)) return false;
    if (this.state.queue.some((q) => q.url === normalizedUrl)) return false;

    // Check depth limit
    if (depth > (this.state.options.maxDepth || 10)) return false;

    // Check robots.txt
    if (!isUrlAllowedByRobots(normalizedUrl, this.robots)) return false;

    // Check URL filters
    if (!this.isUrlAllowed(normalizedUrl)) return false;

    // Add to queue
    this.state.queue.push({ url: normalizedUrl, depth });
    return true;
  }

  /**
   * Check if URL passes include/exclude filters
   */
  private isUrlAllowed(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const originObj = new URL(this.state.originUrl);

      // Check domain
      if (!this.state.options.allowExternalLinks) {
        if (this.state.options.allowSubdomains) {
          // Allow subdomains
          if (!urlObj.hostname.endsWith(originObj.hostname)) {
            return false;
          }
        } else {
          // Same domain only
          if (urlObj.hostname !== originObj.hostname) {
            return false;
          }
        }
      }

      // Check file extensions to exclude
      const excludeExtensions = [
        '.pdf',
        '.jpg',
        '.jpeg',
        '.png',
        '.gif',
        '.svg',
        '.webp',
        '.mp4',
        '.mp3',
        '.wav',
        '.zip',
        '.rar',
        '.exe',
        '.dmg',
        '.css',
        '.js',
        '.woff',
        '.woff2',
        '.ttf',
        '.eot',
      ];

      const pathname = urlObj.pathname.toLowerCase();
      if (excludeExtensions.some((ext) => pathname.endsWith(ext))) {
        return false;
      }

      // Check include patterns
      if (
        this.state.options.includePaths &&
        this.state.options.includePaths.length > 0
      ) {
        const matches = this.state.options.includePaths.some((pattern) =>
          new RegExp(pattern).test(urlObj.pathname)
        );
        if (!matches) return false;
      }

      // Check exclude patterns
      if (
        this.state.options.excludePaths &&
        this.state.options.excludePaths.length > 0
      ) {
        const matches = this.state.options.excludePaths.some((pattern) =>
          new RegExp(pattern).test(urlObj.pathname)
        );
        if (matches) return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Normalize URL (remove fragments, trailing slashes, etc.)
   */
  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      urlObj.hash = '';
      // Remove trailing slash for consistency
      let pathname = urlObj.pathname;
      if (pathname.length > 1 && pathname.endsWith('/')) {
        pathname = pathname.slice(0, -1);
      }
      urlObj.pathname = pathname;
      return urlObj.href;
    } catch {
      return url;
    }
  }

  /**
   * Cancel the crawl
   */
  cancel(): void {
    this.aborted = true;
    this.state.status = 'cancelled';
  }

  /**
   * Get current state
   */
  getState(): {
    id: string;
    status: CrawlStatus;
    completed: number;
    total: number;
    errors: number;
  } {
    return {
      id: this.state.id,
      status: this.state.status,
      completed: this.state.results.length,
      total: this.state.visited.size + this.state.queue.length,
      errors: this.state.errors.size,
    };
  }

  /**
   * Get results
   */
  getResults(): ScrapedDocument[] {
    return this.state.results;
  }

  /**
   * Get errors
   */
  getErrors(): Map<string, string> {
    return this.state.errors;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Quick crawl function (convenience wrapper)
 */
export async function crawl(
  url: string,
  options: CrawlOptions = {},
  onProgress?: CrawlProgressCallback
): Promise<{
  success: boolean;
  data: ScrapedDocument[];
  errors: Map<string, string>;
}> {
  const crawlId = `crawl_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const crawler = new WebCrawler(crawlId, url, options, onProgress);

  try {
    const results = await crawler.crawl();
    return {
      success: true,
      data: results,
      errors: crawler.getErrors(),
    };
  } catch (error) {
    return {
      success: false,
      data: [],
      errors: new Map([
        ['_crawl_error', error instanceof Error ? error.message : 'Unknown error'],
      ]),
    };
  }
}
