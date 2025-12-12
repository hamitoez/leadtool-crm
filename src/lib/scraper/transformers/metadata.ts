/**
 * Metadata Extraction Transformer
 * Extracts title, description, Open Graph, Twitter Cards, and other metadata
 */

import * as cheerio from 'cheerio';
import type { DocumentMetadata } from '../types';

/**
 * Extract all metadata from HTML
 */
export function extractMetadata(
  html: string,
  sourceUrl: string,
  statusCode: number
): DocumentMetadata {
  const $ = cheerio.load(html);

  const metadata: DocumentMetadata = {
    sourceURL: sourceUrl,
    statusCode,
  };

  // Basic metadata
  metadata.title = extractTitle($);
  metadata.description = extractDescription($);
  metadata.language = extractLanguage($);
  metadata.keywords = extractKeywords($);
  metadata.robots = extractRobots($);
  metadata.author = extractAuthor($);
  metadata.canonicalUrl = extractCanonicalUrl($);
  metadata.favicon = extractFavicon($, sourceUrl);

  // Open Graph metadata
  metadata.ogTitle = getMetaContent($, 'og:title');
  metadata.ogDescription = getMetaContent($, 'og:description');
  metadata.ogImage = getMetaContent($, 'og:image');
  metadata.ogUrl = getMetaContent($, 'og:url');
  metadata.ogType = getMetaContent($, 'og:type');
  metadata.ogSiteName = getMetaContent($, 'og:site_name');

  // Twitter Card metadata
  metadata.twitterCard = getMetaContent($, 'twitter:card');
  metadata.twitterSite = getMetaContent($, 'twitter:site');
  metadata.twitterTitle = getMetaContent($, 'twitter:title');
  metadata.twitterDescription = getMetaContent($, 'twitter:description');
  metadata.twitterImage = getMetaContent($, 'twitter:image');

  // Article metadata
  metadata.publishedTime =
    getMetaContent($, 'article:published_time') ||
    getMetaContent($, 'datePublished');
  metadata.modifiedTime =
    getMetaContent($, 'article:modified_time') ||
    getMetaContent($, 'dateModified');

  return metadata;
}

/**
 * Extract page title
 */
function extractTitle($: cheerio.CheerioAPI): string | undefined {
  // Try og:title first (usually cleaner)
  const ogTitle = getMetaContent($, 'og:title');
  if (ogTitle) return ogTitle;

  // Try title tag
  const titleTag = $('title').first().text().trim();
  if (titleTag) return titleTag;

  // Try h1
  const h1 = $('h1').first().text().trim();
  if (h1) return h1;

  return undefined;
}

/**
 * Extract page description
 */
function extractDescription($: cheerio.CheerioAPI): string | undefined {
  // Try og:description first
  const ogDesc = getMetaContent($, 'og:description');
  if (ogDesc) return ogDesc;

  // Try meta description
  const metaDesc =
    $('meta[name="description"]').attr('content')?.trim() ||
    $('meta[name="Description"]').attr('content')?.trim();
  if (metaDesc) return metaDesc;

  // Try first paragraph
  const firstP = $('p').first().text().trim();
  if (firstP && firstP.length > 50) {
    return firstP.substring(0, 300) + (firstP.length > 300 ? '...' : '');
  }

  return undefined;
}

/**
 * Extract page language
 */
function extractLanguage($: cheerio.CheerioAPI): string | undefined {
  return (
    $('html').attr('lang') ||
    $('html').attr('xml:lang') ||
    getMetaContent($, 'language') ||
    getMetaContent($, 'content-language')
  );
}

/**
 * Extract keywords
 */
function extractKeywords($: cheerio.CheerioAPI): string | undefined {
  return $('meta[name="keywords"]').attr('content')?.trim();
}

/**
 * Extract robots directive
 */
function extractRobots($: cheerio.CheerioAPI): string | undefined {
  return $('meta[name="robots"]').attr('content')?.trim();
}

/**
 * Extract author
 */
function extractAuthor($: cheerio.CheerioAPI): string | undefined {
  return (
    $('meta[name="author"]').attr('content')?.trim() ||
    getMetaContent($, 'article:author') ||
    $('[rel="author"]').first().text().trim() ||
    undefined
  );
}

/**
 * Extract canonical URL
 */
function extractCanonicalUrl($: cheerio.CheerioAPI): string | undefined {
  return $('link[rel="canonical"]').attr('href')?.trim();
}

/**
 * Extract favicon URL
 */
function extractFavicon(
  $: cheerio.CheerioAPI,
  baseUrl: string
): string | undefined {
  const faviconSelectors = [
    'link[rel="icon"]',
    'link[rel="shortcut icon"]',
    'link[rel="apple-touch-icon"]',
    'link[rel="apple-touch-icon-precomposed"]',
  ];

  for (const selector of faviconSelectors) {
    const href = $(selector).first().attr('href');
    if (href) {
      return resolveUrl(href, baseUrl);
    }
  }

  // Default favicon path
  try {
    const url = new URL(baseUrl);
    return `${url.origin}/favicon.ico`;
  } catch {
    return undefined;
  }
}

/**
 * Get meta content by property or name
 */
function getMetaContent(
  $: cheerio.CheerioAPI,
  name: string
): string | undefined {
  const content =
    $(`meta[property="${name}"]`).attr('content')?.trim() ||
    $(`meta[name="${name}"]`).attr('content')?.trim() ||
    $(`meta[itemprop="${name}"]`).attr('content')?.trim();

  return content || undefined;
}

/**
 * Resolve relative URL to absolute
 */
function resolveUrl(url: string, baseUrl: string): string {
  try {
    return new URL(url, baseUrl).href;
  } catch {
    return url;
  }
}

/**
 * Extract all links from HTML
 */
export function extractLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const links = new Set<string>();

  $('a[href]').each((_, element) => {
    const href = $(element).attr('href');
    if (href) {
      try {
        const absoluteUrl = resolveUrl(href, baseUrl);
        // Filter out non-http links
        if (absoluteUrl.startsWith('http://') || absoluteUrl.startsWith('https://')) {
          // Filter out common non-page links
          if (
            !absoluteUrl.includes('javascript:') &&
            !absoluteUrl.includes('mailto:') &&
            !absoluteUrl.includes('tel:') &&
            !absoluteUrl.startsWith('#')
          ) {
            links.add(absoluteUrl);
          }
        }
      } catch {
        // Invalid URL, skip
      }
    }
  });

  return Array.from(links);
}

/**
 * Extract all images from HTML
 */
export function extractImages(
  html: string,
  baseUrl: string
): Array<{ url: string; alt?: string }> {
  const $ = cheerio.load(html);
  const images: Array<{ url: string; alt?: string }> = [];
  const seen = new Set<string>();

  $('img[src]').each((_, element) => {
    const src = $(element).attr('src');
    const alt = $(element).attr('alt');

    if (src) {
      try {
        const absoluteUrl = resolveUrl(src, baseUrl);
        if (!seen.has(absoluteUrl)) {
          seen.add(absoluteUrl);
          images.push({
            url: absoluteUrl,
            alt: alt || undefined,
          });
        }
      } catch {
        // Invalid URL, skip
      }
    }
  });

  return images;
}
