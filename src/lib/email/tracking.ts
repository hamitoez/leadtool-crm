/**
 * Email Tracking Utilities
 *
 * Functions for adding tracking pixel and wrapping links for click tracking.
 */

/**
 * 1x1 transparent PNG pixel (base64 encoded)
 */
export const TRACKING_PIXEL_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

export const TRACKING_PIXEL_BUFFER = Buffer.from(TRACKING_PIXEL_BASE64, "base64");

/**
 * Add a tracking pixel to the end of an HTML email
 *
 * @param html - The HTML email body
 * @param trackingId - The unique tracking ID for this email
 * @param baseUrl - The base URL of the application
 * @returns HTML with tracking pixel added
 */
export function addTrackingPixel(
  html: string,
  trackingId: string,
  baseUrl: string
): string {
  const pixelUrl = `${baseUrl}/api/track/open/${trackingId}`;
  const pixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none;width:1px;height:1px;border:0;" alt="" />`;

  // Try to insert before </body> if present
  if (html.includes("</body>")) {
    return html.replace("</body>", `${pixel}</body>`);
  }

  // Otherwise append to the end
  return html + pixel;
}

/**
 * Wrap all links in an HTML email for click tracking
 *
 * @param html - The HTML email body
 * @param trackingId - The unique tracking ID for this email
 * @param baseUrl - The base URL of the application
 * @returns HTML with links wrapped for tracking
 */
export function wrapLinksForTracking(
  html: string,
  trackingId: string,
  baseUrl: string
): string {
  // Regex to match href attributes in anchor tags
  // Matches: <a ... href="URL" ...> or <a ... href='URL' ...>
  const linkRegex = /(<a\s+[^>]*href\s*=\s*)(["'])([^"']+)\2/gi;

  return html.replace(linkRegex, (match, prefix, quote, url) => {
    // Skip if already a tracking link
    if (url.includes("/api/track/")) {
      return match;
    }

    // Skip mailto: and tel: links
    if (url.startsWith("mailto:") || url.startsWith("tel:")) {
      return match;
    }

    // Skip anchor links
    if (url.startsWith("#")) {
      return match;
    }

    // Skip unsubscribe links (important for email compliance)
    if (url.toLowerCase().includes("unsubscribe")) {
      return match;
    }

    // Create tracked URL
    const encodedUrl = encodeURIComponent(url);
    const trackedUrl = `${baseUrl}/api/track/click/${trackingId}?url=${encodedUrl}`;

    return `${prefix}${quote}${trackedUrl}${quote}`;
  });
}

/**
 * Extract original URL from a tracked click URL
 *
 * @param trackedUrl - The tracked URL
 * @returns The original URL or null if not valid
 */
export function extractOriginalUrl(trackedUrl: string): string | null {
  try {
    const url = new URL(trackedUrl);
    const originalUrl = url.searchParams.get("url");
    return originalUrl ? decodeURIComponent(originalUrl) : null;
  } catch {
    return null;
  }
}

/**
 * Remove tracking from HTML (useful for displaying in UI)
 *
 * @param html - HTML with tracking
 * @param baseUrl - Base URL to identify tracking elements
 * @returns Clean HTML without tracking
 */
export function removeTracking(html: string, baseUrl: string): string {
  // Remove tracking pixels
  const pixelRegex = new RegExp(
    `<img[^>]*src=["']${escapeRegex(baseUrl)}/api/track/open/[^"']+["'][^>]*>`,
    "gi"
  );
  let clean = html.replace(pixelRegex, "");

  // Unwrap tracked links
  const linkRegex = new RegExp(
    `${escapeRegex(baseUrl)}/api/track/click/[^?]+\\?url=([^"'&]+)`,
    "gi"
  );
  clean = clean.replace(linkRegex, (match, encodedUrl) => {
    try {
      return decodeURIComponent(encodedUrl);
    } catch {
      return match;
    }
  });

  return clean;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
