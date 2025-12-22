/**
 * Fetch Scraping Engine
 * Lightweight HTTP-based scraper for static pages (no JS rendering)
 * Much faster than Playwright for simple HTML pages
 */

import type { EngineScrapeResult, EngineOptions } from '../types';

// Default user agent
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 FirecrawlBot/1.0';

/**
 * Scrape URL using fetch API (no browser)
 * Best for static HTML pages that don't require JavaScript
 */
export async function scrapeWithFetch(
  url: string,
  options: EngineOptions = {}
): Promise<EngineScrapeResult> {
  const timeout = options.timeout || 30000;

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    // Build headers
    const headers: Record<string, string> = {
      'User-Agent': DEFAULT_USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      ...options.headers,
    };

    // Make request
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    // Get final URL (after redirects)
    const finalUrl = response.url;

    // Get status code
    const statusCode = response.status;

    // Get content type
    const contentType = response.headers.get('content-type') || 'text/html';

    // Check if response is HTML
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return {
        url: finalUrl,
        html: '',
        statusCode,
        contentType,
        error: `Non-HTML content type: ${contentType}`,
      };
    }

    // Get HTML content
    const html = await response.text();

    // Detect charset and decode if needed
    const decodedHtml = decodeHtml(html, contentType);

    return {
      url: finalUrl,
      html: decodedHtml,
      statusCode,
      contentType,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          url,
          html: '',
          statusCode: 0,
          error: `Timeout nach ${timeout / 1000}s - Seite antwortet nicht`,
        };
      }

      // Translate common errors to German
      let errorMsg = error.message;
      if (errorMsg.includes('ENOTFOUND') || errorMsg.includes('getaddrinfo')) {
        errorMsg = 'Domain nicht gefunden - DNS Fehler';
      } else if (errorMsg.includes('ECONNREFUSED')) {
        errorMsg = 'Verbindung abgelehnt - Server nicht erreichbar';
      } else if (errorMsg.includes('ECONNRESET')) {
        errorMsg = 'Verbindung unterbrochen';
      } else if (errorMsg.includes('ETIMEDOUT')) {
        errorMsg = 'Verbindungs-Timeout';
      } else if (errorMsg.includes('certificate') || errorMsg.includes('SSL')) {
        errorMsg = 'SSL/Zertifikat-Fehler';
      } else if (errorMsg.includes('UNABLE_TO_VERIFY')) {
        errorMsg = 'SSL Zertifikat ungültig';
      }

      return {
        url,
        html: '',
        statusCode: 0,
        error: errorMsg,
      };
    }

    return {
      url,
      html: '',
      statusCode: 0,
      error: 'Unbekannter Fehler beim Abrufen',
    };
  }
}

/**
 * Decode HTML content based on charset
 */
function decodeHtml(html: string, contentType: string): string {
  // Try to extract charset from content-type header
  const charsetMatch = contentType.match(/charset=([^;]+)/i);
  if (charsetMatch) {
    const charset = charsetMatch[1].toLowerCase().trim();
    // Most common cases are already handled by fetch
    if (charset === 'utf-8' || charset === 'utf8') {
      return html;
    }
  }

  // Try to extract charset from meta tag
  const metaCharsetMatch = html.match(
    /<meta[^>]+charset=["']?([^"'\s>]+)/i
  );
  if (metaCharsetMatch) {
    // Already decoded by fetch, but log for debugging
    console.debug(`Detected charset from meta: ${metaCharsetMatch[1]}`);
  }

  return html;
}

/**
 * Check if URL is likely to be a static page (no JS needed)
 */
export function isLikelyStaticPage(url: string): boolean {
  const staticExtensions = ['.html', '.htm', '.txt', '.xml'];
  const dynamicIndicators = [
    'react',
    'angular',
    'vue',
    'spa',
    'app.',
    '/app/',
    'dashboard',
    'portal',
  ];

  const urlLower = url.toLowerCase();

  // Check for static file extensions
  for (const ext of staticExtensions) {
    if (urlLower.endsWith(ext)) {
      return true;
    }
  }

  // Check for dynamic app indicators
  for (const indicator of dynamicIndicators) {
    if (urlLower.includes(indicator)) {
      return false;
    }
  }

  // Default: assume static for simple URLs
  return true;
}

/**
 * Quick check if URL is reachable
 */
export async function isUrlReachable(
  url: string,
  timeout: number = 5000
): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    clearTimeout(timeoutId);
    return false;
  }
}
