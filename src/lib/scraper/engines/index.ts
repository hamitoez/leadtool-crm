/**
 * Scraping Engine Orchestrator
 * Implements waterfall pattern: try Playwright first, fall back to Fetch
 */

import { scrapeWithPlaywright, isPlaywrightAvailable } from './playwright';
import { scrapeWithFetch, isLikelyStaticPage } from './fetch';
import type { EngineScrapeResult, EngineOptions, EngineType } from '../types';

interface EngineConfig {
  type: EngineType;
  priority: number;
  supportsJavaScript: boolean;
  supportsScreenshots: boolean;
  supportsActions: boolean;
}

// Engine configurations
const ENGINES: EngineConfig[] = [
  {
    type: 'playwright',
    priority: 1,
    supportsJavaScript: true,
    supportsScreenshots: true,
    supportsActions: true,
  },
  {
    type: 'fetch',
    priority: 2,
    supportsJavaScript: false,
    supportsScreenshots: false,
    supportsActions: false,
  },
];

/**
 * Determine which engine to use based on options and URL
 */
function selectEngine(url: string, options: EngineOptions): EngineType {
  // If screenshots are requested, must use Playwright
  if (options.fullPageScreenshot !== undefined) {
    return 'playwright';
  }

  // If actions are requested, must use Playwright
  if (options.actions && options.actions.length > 0) {
    return 'playwright';
  }

  // If mobile viewport requested, use Playwright
  if (options.mobile) {
    return 'playwright';
  }

  // For likely static pages, try fetch first (faster)
  if (isLikelyStaticPage(url)) {
    return 'fetch';
  }

  // Default to Playwright for full JS support
  return 'playwright';
}

/**
 * Scrape URL with automatic engine selection and fallback
 */
export async function scrapeWithEngine(
  url: string,
  options: EngineOptions = {}
): Promise<EngineScrapeResult> {
  const selectedEngine = selectEngine(url, options);

  // Try selected engine first
  const result = await scrapeWithSelectedEngine(url, options, selectedEngine);

  // If successful or if we got content, return
  if (!result.error || result.html.length > 0) {
    return result;
  }

  // If selected engine failed, try fallback
  const fallbackEngine = selectedEngine === 'playwright' ? 'fetch' : 'playwright';

  // Skip Playwright fallback if not available
  if (fallbackEngine === 'playwright' && !isPlaywrightAvailable()) {
    return result;
  }

  console.log(
    `Engine ${selectedEngine} failed, trying fallback: ${fallbackEngine}`
  );

  const fallbackResult = await scrapeWithSelectedEngine(
    url,
    options,
    fallbackEngine
  );

  // Return fallback result if it has content
  if (fallbackResult.html.length > 0) {
    return fallbackResult;
  }

  // Return original error if fallback also failed
  return result;
}

/**
 * Scrape with specific engine
 */
async function scrapeWithSelectedEngine(
  url: string,
  options: EngineOptions,
  engine: EngineType
): Promise<EngineScrapeResult> {
  switch (engine) {
    case 'playwright':
      if (!isPlaywrightAvailable()) {
        return {
          url,
          html: '',
          statusCode: 0,
          error: 'Playwright is not available',
        };
      }
      return scrapeWithPlaywright(url, options);

    case 'fetch':
      return scrapeWithFetch(url, options);

    default:
      return {
        url,
        html: '',
        statusCode: 0,
        error: `Unknown engine: ${engine}`,
      };
  }
}

/**
 * Force scrape with specific engine (no fallback)
 */
export async function scrapeWithSpecificEngine(
  url: string,
  options: EngineOptions,
  engine: EngineType
): Promise<EngineScrapeResult> {
  return scrapeWithSelectedEngine(url, options, engine);
}

/**
 * Get available engines
 */
export function getAvailableEngines(): EngineConfig[] {
  return ENGINES.filter((engine) => {
    if (engine.type === 'playwright') {
      return isPlaywrightAvailable();
    }
    return true;
  });
}

// Re-export individual engines
export { scrapeWithPlaywright } from './playwright';
export { scrapeWithFetch } from './fetch';
