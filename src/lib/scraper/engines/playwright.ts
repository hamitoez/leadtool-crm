/**
 * Playwright Scraping Engine
 * Handles JavaScript-rendered pages, screenshots, and browser actions
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import type { EngineScrapeResult, EngineOptions, BrowserAction } from '../types';

// Browser instance singleton
let browserInstance: Browser | null = null;

// User agents
const DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const MOBILE_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

/**
 * Get or create browser instance (singleton pattern)
 */
async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
      ],
    });
  }
  return browserInstance;
}

/**
 * Execute browser actions on page
 */
async function executeActions(page: Page, actions: BrowserAction[]): Promise<void> {
  for (const action of actions) {
    switch (action.type) {
      case 'click':
        if (action.selector) {
          await page.click(action.selector);
        }
        break;

      case 'type':
        if (action.selector && action.text) {
          await page.fill(action.selector, action.text);
        }
        break;

      case 'wait':
        if (action.milliseconds) {
          await page.waitForTimeout(action.milliseconds);
        }
        break;

      case 'scroll':
        await page.evaluate(
          ({ direction, amount }) => {
            const scrollAmount = amount || 500;
            window.scrollBy(0, direction === 'up' ? -scrollAmount : scrollAmount);
          },
          { direction: action.direction || 'down', amount: action.amount }
        );
        break;

      case 'screenshot':
        // Screenshots handled separately
        break;
    }
  }
}

/**
 * Scrape URL using Playwright browser
 */
export async function scrapeWithPlaywright(
  url: string,
  options: EngineOptions = {}
): Promise<EngineScrapeResult> {
  const browser = await getBrowser();
  let context: BrowserContext | null = null;

  try {
    // Create browser context with options
    context = await browser.newContext({
      userAgent: options.mobile ? MOBILE_USER_AGENT : DESKTOP_USER_AGENT,
      viewport: options.mobile
        ? { width: 390, height: 844 }
        : { width: 1920, height: 1080 },
      ignoreHTTPSErrors: options.skipTlsVerification || false,
      extraHTTPHeaders: options.headers,
    });

    const page = await context.newPage();

    // Set timeout
    const timeout = options.timeout || 30000;
    page.setDefaultTimeout(timeout);

    // Navigate to URL
    const response = await page.goto(url, {
      waitUntil: 'networkidle',
      timeout,
    });

    // Wait additional time if specified
    if (options.waitFor && options.waitFor > 0) {
      await page.waitForTimeout(options.waitFor);
    }

    // Execute browser actions
    if (options.actions && options.actions.length > 0) {
      await executeActions(page, options.actions);
    }

    // Get final URL (after redirects)
    const finalUrl = page.url();

    // Get HTML content
    const html = await page.content();

    // Get status code
    const statusCode = response?.status() || 200;

    // Get content type
    const contentType = response?.headers()['content-type'] || 'text/html';

    // Take screenshot if requested
    let screenshot: string | undefined;
    if (options.fullPageScreenshot !== undefined) {
      const buffer = await page.screenshot({
        fullPage: options.fullPageScreenshot,
        type: 'png',
      });
      screenshot = `data:image/png;base64,${buffer.toString('base64')}`;
    }

    return {
      url: finalUrl,
      html,
      statusCode,
      contentType,
      screenshot,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      url,
      html: '',
      statusCode: 0,
      error: `Playwright error: ${errorMessage}`,
    };
  } finally {
    if (context) {
      await context.close();
    }
  }
}

/**
 * Close browser instance (for cleanup)
 */
export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

/**
 * Check if Playwright is available
 */
export function isPlaywrightAvailable(): boolean {
  try {
    require.resolve('playwright');
    return true;
  } catch {
    return false;
  }
}
