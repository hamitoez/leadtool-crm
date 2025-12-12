/**
 * Sitemap Parser
 * Fetches and parses sitemap.xml files to discover URLs
 */

import Sitemapper from 'sitemapper';

interface SitemapResult {
  urls: string[];
  errors: string[];
}

/**
 * Fetch URLs from sitemap.xml
 */
export async function fetchSitemapUrls(
  sitemapUrl: string,
  timeout: number = 30000
): Promise<SitemapResult> {
  const sitemap = new Sitemapper({
    url: sitemapUrl,
    timeout,
    requestHeaders: {
      'User-Agent': 'FirecrawlBot/1.0',
    },
  });

  try {
    const result = await sitemap.fetch();
    return {
      urls: result.sites || [],
      errors: (result.errors || []).map((e: unknown) =>
        typeof e === 'string' ? e : (e as { message?: string })?.message || 'Unknown error'
      ),
    };
  } catch (error) {
    return {
      urls: [],
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

/**
 * Discover sitemap URLs for a domain
 */
export async function discoverSitemaps(
  baseUrl: string,
  robotsSitemaps: string[] = []
): Promise<string[]> {
  const discovered = new Set<string>();

  // Add sitemaps from robots.txt
  for (const url of robotsSitemaps) {
    discovered.add(url);
  }

  // Try common sitemap locations
  const commonPaths = [
    '/sitemap.xml',
    '/sitemap_index.xml',
    '/sitemap-index.xml',
    '/sitemaps/sitemap.xml',
    '/sitemap/sitemap.xml',
  ];

  for (const path of commonPaths) {
    try {
      const url = new URL(path, baseUrl).href;
      const response = await fetch(url, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'FirecrawlBot/1.0',
        },
      });

      if (response.ok) {
        discovered.add(url);
      }
    } catch {
      // Sitemap not found at this path
    }
  }

  return Array.from(discovered);
}

/**
 * Fetch all URLs from multiple sitemaps
 */
export async function fetchAllSitemapUrls(
  sitemapUrls: string[],
  timeout: number = 30000,
  limit: number = 10000
): Promise<SitemapResult> {
  const allUrls = new Set<string>();
  const allErrors: string[] = [];

  for (const sitemapUrl of sitemapUrls) {
    if (allUrls.size >= limit) break;

    const result = await fetchSitemapUrls(sitemapUrl, timeout);

    for (const url of result.urls) {
      if (allUrls.size >= limit) break;
      allUrls.add(url);
    }

    allErrors.push(...result.errors);
  }

  return {
    urls: Array.from(allUrls),
    errors: allErrors,
  };
}
