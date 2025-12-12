/**
 * Firecrawl-compatible Scraper Types
 * Based on Firecrawl v2 API specifications
 */

// ============================================================================
// SCRAPE TYPES
// ============================================================================

export type OutputFormat =
  | 'markdown'
  | 'html'
  | 'rawHtml'
  | 'links'
  | 'screenshot'
  | 'json';

export interface ScrapeOptions {
  /** Output formats to return */
  formats?: OutputFormat[];
  /** Only extract main content, removing nav/footer/etc */
  onlyMainContent?: boolean;
  /** HTML tags to include (e.g., ['article', 'main']) */
  includeTags?: string[];
  /** HTML tags to exclude (e.g., ['nav', 'footer']) */
  excludeTags?: string[];
  /** Wait time in ms after page load */
  waitFor?: number;
  /** Request timeout in ms */
  timeout?: number;
  /** Custom headers to send */
  headers?: Record<string, string>;
  /** Browser actions to perform */
  actions?: BrowserAction[];
  /** Use mobile viewport */
  mobile?: boolean;
  /** Take full page screenshot */
  fullPageScreenshot?: boolean;
  /** Skip TLS verification */
  skipTlsVerification?: boolean;
  /** Location/country for geo-targeting */
  location?: {
    country?: string;
    languages?: string[];
  };
}

export interface BrowserAction {
  type: 'click' | 'type' | 'wait' | 'scroll' | 'screenshot';
  selector?: string;
  text?: string;
  milliseconds?: number;
  direction?: 'up' | 'down';
  amount?: number;
}

export interface DocumentMetadata {
  title?: string;
  description?: string;
  language?: string;
  keywords?: string;
  robots?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogUrl?: string;
  ogType?: string;
  ogSiteName?: string;
  twitterCard?: string;
  twitterSite?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  favicon?: string;
  canonicalUrl?: string;
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
  sourceURL: string;
  statusCode: number;
  error?: string;
}

export interface ScrapedDocument {
  markdown?: string;
  html?: string;
  rawHtml?: string;
  links?: string[];
  screenshot?: string;
  json?: unknown;
  metadata: DocumentMetadata;
}

export interface ScrapeResult {
  success: boolean;
  data?: ScrapedDocument;
  error?: string;
}

// ============================================================================
// CRAWL TYPES
// ============================================================================

export interface CrawlOptions {
  /** URL patterns to include (regex) */
  includePaths?: string[];
  /** URL patterns to exclude (regex) */
  excludePaths?: string[];
  /** Maximum crawl depth from origin */
  maxDepth?: number;
  /** Maximum number of pages to crawl */
  limit?: number;
  /** Allow following external links */
  allowExternalLinks?: boolean;
  /** Allow following subdomain links */
  allowSubdomains?: boolean;
  /** Ignore sitemap.xml */
  ignoreSitemap?: boolean;
  /** Ignore robots.txt */
  ignoreRobotsTxt?: boolean;
  /** Scrape options for each page */
  scrapeOptions?: ScrapeOptions;
  /** Webhook for real-time updates */
  webhook?: WebhookConfig;
}

export type CrawlStatus = 'active' | 'completed' | 'failed' | 'cancelled';

export interface CrawlJob {
  id: string;
  status: CrawlStatus;
  originUrl: string;
  options: CrawlOptions;
  totalPages: number;
  completedPages: number;
  failedPages: number;
  createdAt: Date;
  expiresAt?: Date;
}

export interface CrawlResult {
  success: boolean;
  status: CrawlStatus;
  completed: number;
  total: number;
  data: ScrapedDocument[];
  next?: string;
  error?: string;
}

// ============================================================================
// BATCH SCRAPE TYPES
// ============================================================================

export interface BatchScrapeOptions extends ScrapeOptions {
  /** URLs to scrape */
  urls: string[];
  /** Webhook for updates */
  webhook?: WebhookConfig;
}

export interface BatchScrapeResult {
  success: boolean;
  id: string;
  status: 'processing' | 'completed' | 'failed';
  completed: number;
  total: number;
  data: ScrapedDocument[];
  error?: string;
}

// ============================================================================
// EXTRACT TYPES (LLM-based extraction)
// ============================================================================

export interface ExtractOptions {
  /** URLs to extract from */
  urls?: string[];
  /** Natural language prompt for extraction */
  prompt?: string;
  /** Custom system prompt */
  systemPrompt?: string;
  /** JSON Schema for structured output */
  schema?: Record<string, unknown>;
  /** Limit number of URLs to process */
  limit?: number;
  /** Scrape options for fetching pages */
  scrapeOptions?: ScrapeOptions;
}

export interface ExtractResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// ============================================================================
// MAP TYPES (URL Discovery)
// ============================================================================

export interface MapOptions {
  /** URL patterns to include */
  includePaths?: string[];
  /** URL patterns to exclude */
  excludePaths?: string[];
  /** Maximum URLs to return */
  limit?: number;
  /** Search query to filter URLs */
  search?: string;
  /** Include subdomain URLs */
  includeSubdomains?: boolean;
}

export interface MapResult {
  success: boolean;
  links?: Array<{
    url: string;
    title?: string;
    description?: string;
  }>;
  error?: string;
}

// ============================================================================
// WEBHOOK TYPES
// ============================================================================

export interface WebhookConfig {
  url: string;
  secret?: string;
  events?: WebhookEvent[];
}

export type WebhookEvent =
  | 'scrape.completed'
  | 'scrape.failed'
  | 'crawl.page'
  | 'crawl.completed'
  | 'crawl.failed';

// ============================================================================
// ENGINE TYPES
// ============================================================================

export type EngineType = 'playwright' | 'fetch';

export interface EngineScrapeResult {
  url: string;
  html: string;
  statusCode: number;
  contentType?: string;
  screenshot?: string;
  error?: string;
}

export interface EngineOptions {
  timeout?: number;
  headers?: Record<string, string>;
  waitFor?: number;
  mobile?: boolean;
  actions?: BrowserAction[];
  skipTlsVerification?: boolean;
  fullPageScreenshot?: boolean;
}

// ============================================================================
// CONTACT EXTRACTION TYPES (for CRM integration)
// ============================================================================

export interface ContactPerson {
  name: string;
  position?: string;
  email?: string;
  phone?: string;
}

export interface ExtractedContactData {
  emails: string[];
  phones: string[];
  addresses: string[];
  contactPersons: ContactPerson[];
  socialLinks: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
    xing?: string;
  };
  companyName?: string;
  vatId?: string;
  registrationNumber?: string;
}

export interface ContactExtractionResult {
  success: boolean;
  data?: ExtractedContactData;
  confidence: number;
  sourceUrl: string;
  pagesScraped: string[];
  error?: string;
}
