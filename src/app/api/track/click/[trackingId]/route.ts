import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * Click Tracking Endpoint
 *
 * Records the click and redirects to the original URL.
 * URL is passed as a query parameter: ?url=encoded_original_url
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trackingId: string }> }
) {
  const { trackingId } = await params;
  const url = request.nextUrl.searchParams.get("url");

  // If no URL provided, redirect to homepage
  if (!url) {
    console.log(`Click tracking: No URL provided for ${trackingId}`);
    return NextResponse.redirect(new URL("/", request.url));
  }

  let originalUrl: string;
  try {
    originalUrl = decodeURIComponent(url);
  } catch {
    console.log(`Click tracking: Invalid URL encoding for ${trackingId}`);
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Record the click asynchronously
  recordClick(trackingId, originalUrl, request).catch((error) => {
    console.error("Error recording click:", error);
  });

  // Redirect to the original URL
  try {
    const redirectUrl = new URL(originalUrl);
    return NextResponse.redirect(redirectUrl);
  } catch {
    // If URL is relative or invalid, try to handle it
    if (originalUrl.startsWith("/")) {
      return NextResponse.redirect(new URL(originalUrl, request.url));
    }
    // Try adding https:// if missing
    if (!originalUrl.startsWith("http")) {
      try {
        return NextResponse.redirect(new URL(`https://${originalUrl}`));
      } catch {
        console.log(`Click tracking: Could not redirect to ${originalUrl}`);
        return NextResponse.redirect(new URL("/", request.url));
      }
    }
    return NextResponse.redirect(new URL("/", request.url));
  }
}

async function recordClick(
  trackingId: string,
  url: string,
  request: NextRequest
) {
  try {
    // Find the sent email
    const sentEmail = await prisma.campaignSentEmail.findUnique({
      where: { trackingId },
      include: {
        campaign: true,
        variant: true,
      },
    });

    if (!sentEmail) {
      console.log(`Click tracking: Email not found for ${trackingId}`);
      return;
    }

    const now = new Date();
    const isFirstClick = !sentEmail.clickedAt;

    // Create click record
    await prisma.campaignEmailClick.create({
      data: {
        sentEmailId: sentEmail.id,
        url,
        userAgent: request.headers.get("user-agent") || undefined,
        ipAddress:
          request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
          request.headers.get("x-real-ip") ||
          undefined,
      },
    });

    // Update sent email
    await prisma.campaignSentEmail.update({
      where: { trackingId },
      data: {
        clickedAt: sentEmail.clickedAt || now,
        clickCount: { increment: 1 },
        // Only update status if not already replied/bounced
        status:
          sentEmail.status === "sent" || sentEmail.status === "opened"
            ? "clicked"
            : sentEmail.status,
        // Also mark as opened if first click (they must have opened to click)
        openedAt: sentEmail.openedAt || now,
        openCount: sentEmail.openedAt ? sentEmail.openCount : 1,
      },
    });

    // Update campaign stats on first click
    if (isFirstClick) {
      await prisma.campaign.update({
        where: { id: sentEmail.campaignId },
        data: {
          clickCount: { increment: 1 },
          // Also count as open if not already opened
          openCount: sentEmail.openedAt
            ? undefined
            : { increment: 1 },
        },
      });

      // Update variant stats if applicable
      if (sentEmail.variantId) {
        await prisma.campaignSequenceVariant.update({
          where: { id: sentEmail.variantId },
          data: {
            clickCount: { increment: 1 },
            openCount: sentEmail.openedAt
              ? undefined
              : { increment: 1 },
          },
        });
      }
    }

    console.log(
      `Click tracking: ${trackingId} clicked ${url} (${isFirstClick ? "first" : "repeat"})`
    );
  } catch (error) {
    console.error("Error in recordClick:", error);
  }
}
