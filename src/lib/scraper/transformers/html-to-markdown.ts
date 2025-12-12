/**
 * HTML to Markdown Transformer
 * Uses Turndown with GitHub Flavored Markdown support
 */

import TurndownService from 'turndown';
import * as turndownPluginGfm from 'turndown-plugin-gfm';
import * as cheerio from 'cheerio';

// Create and configure Turndown instance
function createTurndownService(): TurndownService {
  const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '_',
    strongDelimiter: '**',
    linkStyle: 'inlined',
    linkReferenceStyle: 'full',
  });

  // Add GitHub Flavored Markdown support (tables, strikethrough, etc.)
  turndownService.use(turndownPluginGfm.gfm);

  // Custom rule for inline links to ensure proper formatting
  turndownService.addRule('inlineLink', {
    filter: (node, options) => {
      return (
        options.linkStyle === 'inlined' &&
        node.nodeName === 'A' &&
        node.getAttribute('href') !== null
      );
    },
    replacement: (content, node) => {
      const href = (node as HTMLAnchorElement).getAttribute('href')?.trim() || '';
      const title = (node as HTMLAnchorElement).title
        ? ` "${(node as HTMLAnchorElement).title}"`
        : '';
      const cleanContent = content.trim().replace(/\n/g, ' ');
      if (!cleanContent) return '';
      return `[${cleanContent}](${href}${title})`;
    },
  });

  // Remove script and style content
  turndownService.addRule('removeScriptsAndStyles', {
    filter: ['script', 'style', 'noscript'],
    replacement: () => '',
  });

  // Handle images with alt text
  turndownService.addRule('images', {
    filter: 'img',
    replacement: (content, node) => {
      const alt = (node as HTMLImageElement).alt || '';
      const src = (node as HTMLImageElement).getAttribute('src') || '';
      const title = (node as HTMLImageElement).title
        ? ` "${(node as HTMLImageElement).title}"`
        : '';
      if (!src) return '';
      return `![${alt}](${src}${title})`;
    },
  });

  return turndownService;
}

// Singleton instance
let turndownInstance: TurndownService | null = null;

function getTurndownService(): TurndownService {
  if (!turndownInstance) {
    turndownInstance = createTurndownService();
  }
  return turndownInstance;
}

/**
 * Convert HTML to Markdown
 */
export function htmlToMarkdown(html: string): string {
  const turndown = getTurndownService();
  const markdown = turndown.turndown(html);
  return postProcessMarkdown(markdown);
}

/**
 * Post-process markdown to clean up common issues
 */
function postProcessMarkdown(markdown: string): string {
  return (
    markdown
      // Remove excessive newlines (more than 2)
      .replace(/\n{3,}/g, '\n\n')
      // Clean up whitespace at line ends
      .replace(/[ \t]+$/gm, '')
      // Remove empty links
      .replace(/\[\]\([^)]*\)/g, '')
      // Clean up markdown artifacts
      .replace(/\\_/g, '_')
      .replace(/\\\*/g, '*')
      // Trim
      .trim()
  );
}

/**
 * Extract main content from HTML (remove nav, footer, sidebars, etc.)
 */
export function extractMainContent(html: string): string {
  const $ = cheerio.load(html);

  // Elements to remove
  const removeSelectors = [
    'script',
    'style',
    'noscript',
    'nav',
    'footer',
    'header',
    'aside',
    '.nav',
    '.navigation',
    '.navbar',
    '.footer',
    '.header',
    '.sidebar',
    '.menu',
    '.advertisement',
    '.ad',
    '.ads',
    '.cookie-banner',
    '.cookie-notice',
    '.popup',
    '.modal',
    '.overlay',
    '.social-share',
    '.social-links',
    '.breadcrumb',
    '.breadcrumbs',
    '.pagination',
    '.comments',
    '.comment-section',
    '[role="navigation"]',
    '[role="banner"]',
    '[role="complementary"]',
    '[role="contentinfo"]',
    '[aria-hidden="true"]',
  ];

  // Remove unwanted elements
  removeSelectors.forEach((selector) => {
    $(selector).remove();
  });

  // Try to find main content area
  const mainSelectors = [
    'main',
    'article',
    '[role="main"]',
    '.main-content',
    '.content',
    '.post-content',
    '.article-content',
    '.entry-content',
    '#main',
    '#content',
    '#main-content',
  ];

  for (const selector of mainSelectors) {
    const main = $(selector).first();
    if (main.length && main.text().trim().length > 100) {
      return main.html() || '';
    }
  }

  // Fallback to body content
  return $('body').html() || html;
}

/**
 * Clean HTML by removing unwanted elements but keeping structure
 */
export function cleanHtml(html: string): string {
  const $ = cheerio.load(html);

  // Remove scripts, styles, and other non-content elements
  $('script, style, noscript, svg, canvas, iframe').remove();

  // Remove empty elements
  $('*')
    .filter(function () {
      const el = this as unknown as { tagName?: string };
      return (
        $(this).text().trim() === '' &&
        $(this).children().length === 0 &&
        !['img', 'br', 'hr', 'input'].includes(
          el.tagName?.toLowerCase() || ''
        )
      );
    })
    .remove();

  // Remove comments
  $('*')
    .contents()
    .filter(function () {
      return this.type === 'comment';
    })
    .remove();

  return $.html();
}

/**
 * Convert HTML to Markdown with main content extraction
 */
export function htmlToMainContentMarkdown(
  html: string,
  onlyMainContent: boolean = true
): string {
  let processedHtml = html;

  if (onlyMainContent) {
    processedHtml = extractMainContent(html);
  } else {
    processedHtml = cleanHtml(html);
  }

  return htmlToMarkdown(processedHtml);
}
