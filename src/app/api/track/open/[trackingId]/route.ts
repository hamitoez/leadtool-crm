import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { TRACKING_PIXEL_BUFFER } from "@/lib/email/tracking";

/**
 * Tracking Pixel Endpoint
 *
 * Returns a 1x1 transparent PNG and records the email open.
 * This is called when the email client loads the tracking pixel image.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trackingId: string }> }
) {
  const { trackingId } = await params;

  // Record the open asynchronously (don't wait for result)
  recordOpen(trackingId, request).catch((error) => {
    console.error("Error recording email open:", error);
  });

  // Return the tracking pixel immediately
  return new Response(TRACKING_PIXEL_BUFFER, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(TRACKING_PIXEL_BUFFER.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

async function recordOpen(trackingId: string, request: NextRequest) {
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
      console.log(`Tracking: Email not found for trackingId ${trackingId}`);
      return;
    }

    const now = new Date();
    const isFirstOpen = !sentEmail.openedAt;

    // Update sent email
    await prisma.campaignSentEmail.update({
      where: { trackingId },
      data: {
        openedAt: sentEmail.openedAt || now,
        openCount: { increment: 1 },
        status: sentEmail.status === "sent" ? "opened" : sentEmail.status,
      },
    });

    // Only update campaign stats on first open
    if (isFirstOpen) {
      await prisma.campaign.update({
        where: { id: sentEmail.campaignId },
        data: {
          openCount: { increment: 1 },
        },
      });

      // Update variant stats if applicable
      if (sentEmail.variantId) {
        await prisma.campaignSequenceVariant.update({
          where: { id: sentEmail.variantId },
          data: {
            openCount: { increment: 1 },
          },
        });
      }
    }

    console.log(
      `Tracking: Email ${trackingId} opened (${isFirstOpen ? "first" : "repeat"})`
    );
  } catch (error) {
    console.error("Error in recordOpen:", error);
  }
}
