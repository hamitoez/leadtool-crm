/**
 * Firecrawl-compatible Scraper
 * Main entry point for all scraping operations
 */

import { scrapeWithEngine } from './engines';
import {
  htmlToMarkdown,
  htmlToMainContentMarkdown,
  extractMainContent,
  extractMetadata,
  extractLinks,
  extractImages,
  extractContactData,
  extractContactDataFallback,
} from './transformers';
import type {
  ScrapeOptions,
  ScrapeResult,
  ScrapedDocument,
  DocumentMetadata,
  ExtractOptions,
  ExtractResult,
  ContactExtractionResult,
  EngineOptions,
} from './types';

// Re-export types
export * from './types';

// Re-export engines and transformers
export * from './engines';
export * from './transformers';

/**
 * Scrape a single URL and transform to requested formats
 */
export async function scrape(
  url: string,
  options: ScrapeOptions = {}
): Promise<ScrapeResult> {
  try {
    // Validate URL
    const validatedUrl = validateUrl(url);

    // Build engine options
    const engineOptions: EngineOptions = {
      timeout: options.timeout || 30000,
      headers: options.headers,
      waitFor: options.waitFor,
      mobile: options.mobile,
      actions: options.actions,
      skipTlsVerification: options.skipTlsVerification,
      fullPageScreenshot: options.formats?.includes('screenshot')
        ? options.fullPageScreenshot ?? true
        : undefined,
    };

    // Scrape with engine
    const engineResult = await scrapeWithEngine(validatedUrl, engineOptions);

    if (engineResult.error && !engineResult.html) {
      return {
        success: false,
        error: engineResult.error,
      };
    }

    // Build document with requested formats
    const document = await buildDocument(
      engineResult.html,
      engineResult.url,
      engineResult.statusCode,
      options,
      engineResult.screenshot
    );

    return {
      success: true,
      data: document,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Scrape multiple URLs in parallel
 */
export async function scrapeMany(
  urls: string[],
  options: ScrapeOptions = {},
  concurrency: number = 5
): Promise<ScrapeResult[]> {
  const results: ScrapeResult[] = [];

  // Process in batches
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((url) => scrape(url, options))
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Scrape and extract contact data from a URL
 * Specialized for CRM use case (Impressum/Contact pages)
 */
export async function scrapeAndExtractContacts(
  url: string,
  options: {
    llmProvider?: 'openai' | 'anthropic' | 'ollama';
    llmApiKey?: string;
    llmModel?: string;
    timeout?: number;
    discoverContactPages?: boolean;
  } = {}
): Promise<ContactExtractionResult> {
  const pagesScraped: string[] = [];

  try {
    // Scrape main URL
    const mainResult = await scrape(url, {
      timeout: options.timeout || 30000,
      formats: ['markdown', 'links'],
      onlyMainContent: false,
    });

    if (!mainResult.success || !mainResult.data) {
      return {
        success: false,
        confidence: 0,
        sourceUrl: url,
        pagesScraped: [],
        error: mainResult.error || 'Failed to scrape URL',
      };
    }

    pagesScraped.push(url);

    // Discover and scrape contact pages if enabled
    let additionalContent = '';
    if (options.discoverContactPages && mainResult.data.links) {
      const contactPageUrls = findContactPageUrls(mainResult.data.links, url);

      for (const contactUrl of contactPageUrls.slice(0, 3)) {
        const contactResult = await scrape(contactUrl, {
          timeout: options.timeout || 30000,
          formats: ['markdown'],
          onlyMainContent: false,
        });

        if (contactResult.success && contactResult.data?.markdown) {
          additionalContent += '\n\n---\n\n' + contactResult.data.markdown;
          pagesScraped.push(contactUrl);
        }
      }
    }

    // Combine all content
    const fullContent =
      (mainResult.data.markdown || '') + additionalContent;

    // Extract contact data with LLM
    if (options.llmProvider && options.llmApiKey) {
      const extractResult = await extractContactData(fullContent, {
        provider: options.llmProvider,
        apiKey: options.llmApiKey,
        model: options.llmModel,
      });

      if (extractResult.success && extractResult.data) {
        return {
          success: true,
          data: extractResult.data,
          confidence: extractResult.confidence,
          sourceUrl: url,
          pagesScraped,
        };
      }
    }

    // Fallback to regex extraction
    const fallbackData = extractContactDataFallback(fullContent);

    return {
      success: true,
      data: fallbackData,
      confidence: 0.6,
      sourceUrl: url,
      pagesScraped,
    };
  } catch (error) {
    return {
      success: false,
      confidence: 0,
      sourceUrl: url,
      pagesScraped,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Extract structured data from URL using LLM
 */
export async function extract(
  urls: string[],
  options: ExtractOptions
): Promise<ExtractResult> {
  try {
    // Scrape all URLs
    const scrapeResults = await scrapeMany(urls, options.scrapeOptions || {});

    // Combine content from successful scrapes
    const combinedContent = scrapeResults
      .filter((r) => r.success && r.data?.markdown)
      .map((r) => r.data!.markdown)
      .join('\n\n---\n\n');

    if (!combinedContent) {
      return {
        success: false,
        error: 'No content could be scraped from provided URLs',
      };
    }

    // TODO: Implement LLM extraction based on schema or prompt
    // This would use the extractWithSchema or extractWithPrompt functions

    return {
      success: true,
      data: { content: combinedContent },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Build document with requested formats
 */
async function buildDocument(
  html: string,
  url: string,
  statusCode: number,
  options: ScrapeOptions,
  screenshot?: string
): Promise<ScrapedDocument> {
  const formats = options.formats || ['markdown'];
  const onlyMainContent = options.onlyMainContent ?? true;

  const document: ScrapedDocument = {
    metadata: extractMetadata(html, url, statusCode),
  };

  // Process each requested format
  for (const format of formats) {
    switch (format) {
      case 'markdown':
        document.markdown = htmlToMainContentMarkdown(html, onlyMainContent);
        break;

      case 'html':
        document.html = onlyMainContent ? extractMainContent(html) : html;
        break;

      case 'rawHtml':
        document.rawHtml = html;
        break;

      case 'links':
        document.links = extractLinks(html, url);
        break;

      case 'screenshot':
        document.screenshot = screenshot;
        break;

      case 'json':
        // JSON extraction handled separately with LLM
        break;
    }
  }

  return document;
}

/**
 * Validate and normalize URL
 */
function validateUrl(url: string): string {
  // Add protocol if missing
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  // Validate URL format
  try {
    const parsed = new URL(url);
    return parsed.href;
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
}

/**
 * Find contact/impressum page URLs from a list of links
 */
function findContactPageUrls(links: string[], baseUrl: string): string[] {
  const contactPatterns = [
    /impressum/i,
    /kontakt/i,
    /contact/i,
    /about/i,
    /ueber-uns/i,
    /uber-uns/i,
    /team/i,
    /ansprechpartner/i,
  ];

  const baseHost = new URL(baseUrl).hostname;

  return links.filter((link) => {
    try {
      const linkHost = new URL(link).hostname;
      // Only same domain
      if (linkHost !== baseHost) return false;

      // Match contact patterns
      return contactPatterns.some((pattern) => pattern.test(link));
    } catch {
      return false;
    }
  });
}
