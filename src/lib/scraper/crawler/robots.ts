/**
 * Robots.txt Parser
 * Handles fetching and parsing robots.txt files
 */

import robotsParser from 'robots-parser';

const USER_AGENT = 'FirecrawlBot/1.0';

interface RobotsResult {
  isAllowed: (url: string) => boolean;
  crawlDelay: number | null;
  sitemaps: string[];
}

/**
 * Fetch and parse robots.txt for a domain
 */
export async function fetchRobotsTxt(
  baseUrl: string,
  timeout: number = 10000
): Promise<RobotsResult> {
  const robotsUrl = new URL('/robots.txt', baseUrl).href;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(robotsUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // No robots.txt or error - allow everything
      return createPermissiveRobots();
    }

    const robotsTxt = await response.text();
    const robots = robotsParser(robotsUrl, robotsTxt);

    return {
      isAllowed: (url: string) => robots.isAllowed(url, USER_AGENT) ?? true,
      crawlDelay: robots.getCrawlDelay(USER_AGENT) ?? null,
      sitemaps: robots.getSitemaps(),
    };
  } catch (error) {
    // Error fetching robots.txt - allow everything
    console.debug('Error fetching robots.txt:', error);
    return createPermissiveRobots();
  }
}

/**
 * Create a permissive robots result (allows everything)
 */
function createPermissiveRobots(): RobotsResult {
  return {
    isAllowed: () => true,
    crawlDelay: null,
    sitemaps: [],
  };
}

/**
 * Check if URL is allowed by robots.txt rules
 */
export function isUrlAllowedByRobots(
  url: string,
  robots: RobotsResult | null
): boolean {
  if (!robots) return true;
  return robots.isAllowed(url);
}
