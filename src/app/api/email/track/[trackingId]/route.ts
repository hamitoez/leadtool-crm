import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// 1x1 transparent GIF (base64)
const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

// GET /api/email/track/[trackingId] - Tracking Pixel
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trackingId: string }> }
) {
  try {
    const { trackingId } = await params;

    if (!trackingId) {
      return new NextResponse(TRANSPARENT_GIF, {
        headers: {
          "Content-Type": "image/gif",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        },
      });
    }

    // Update email tracking in background (don't block response)
    // Silently ignore errors - trackingId might not exist (invalid/test requests)
    prisma.emailMessage
      .update({
        where: { trackingId },
        data: {
          openCount: { increment: 1 },
          lastOpenedAt: new Date(),
        },
      })
      .catch(() => {
        // Silently ignore - email might not exist (invalid tracking ID)
      });

    // Return transparent 1x1 GIF immediately
    return new NextResponse(TRANSPARENT_GIF, {
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch {
    // Always return the GIF even on error
    return new NextResponse(TRANSPARENT_GIF, {
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  }
}
