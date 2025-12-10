import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Enable construction mode via environment variable (defaults to false)
const CONSTRUCTION_MODE = process.env.CONSTRUCTION_MODE === "true";

// Paths that should always be accessible
const PUBLIC_PATHS = [
  "/construction",
  "/api/construction/verify",
  "/_next",
  "/favicon.ico",
];

export function middleware(request: NextRequest) {
  // Skip if construction mode is disabled
  if (!CONSTRUCTION_MODE) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check for construction access cookie
  const hasAccess = request.cookies.get("construction_access")?.value === "granted";

  if (hasAccess) {
    return NextResponse.next();
  }

  // Redirect to construction page
  const constructionUrl = new URL("/construction", request.url);
  return NextResponse.redirect(constructionUrl);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
