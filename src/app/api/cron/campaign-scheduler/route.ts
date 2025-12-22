import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  sendCampaignEmail,
  getAvailableAccount,
  resetDailySendingCounters,
} from "@/lib/email/campaign-sender";

// Secret key for cron authentication
const CRON_SECRET = process.env.CRON_SECRET || "leadtool-cron-secret-2024";

// Maximum emails to process per cron run
const MAX_EMAILS_PER_RUN = 50;

/**
 * Campaign Scheduler Cron Job
 *
 * This endpoint should be called every 5-10 minutes by a cron job.
 * It processes active campaigns and sends emails to recipients who are due.
 *
 * Usage:
 *   curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
 *        https://your-domain.com/api/cron/campaign-scheduler
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    const providedSecret = authHeader?.replace("Bearer ", "");

    if (providedSecret !== CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[CampaignScheduler] Starting campaign processing...");
    const startTime = Date.now();

    // Reset daily counters at the start of each day
    await resetDailySendingCounters();

    // Get current time info for schedule checking
    const now = new Date();
    const currentHour = now.getHours();
    const dayOfWeek = getDayOfWeek(now);

    // Find active campaigns that are within their schedule
    const campaigns = await prisma.campaign.findMany({
      where: {
        status: "ACTIVE",
        // Check if schedule has started
        OR: [
          { scheduleStartAt: null },
          { scheduleStartAt: { lte: now } },
        ],
        // Check if schedule hasn't ended
        AND: [
          {
            OR: [
              { scheduleEndAt: null },
              { scheduleEndAt: { gte: now } },
            ],
          },
        ],
      },
      include: {
        sequences: {
          orderBy: { stepNumber: "asc" },
        },
      },
    });

    let totalProcessed = 0;
    let totalSent = 0;
    let totalErrors = 0;

    for (const campaign of campaigns) {
      // Check if current hour is within sending hours
      if (
        currentHour < campaign.sendingHoursStart ||
        currentHour >= campaign.sendingHoursEnd
      ) {
        console.log(
          `[CampaignScheduler] Campaign ${campaign.id} outside sending hours (${currentHour} not in ${campaign.sendingHoursStart}-${campaign.sendingHoursEnd})`
        );
        continue;
      }

      // Check if current day is a sending day
      if (!campaign.sendingDays.includes(dayOfWeek)) {
        console.log(
          `[CampaignScheduler] Campaign ${campaign.id} not scheduled for ${dayOfWeek}`
        );
        continue;
      }

      // Check if campaign has reached daily limit
      if (campaign.sentTodayCount >= campaign.dailyLimit) {
        console.log(
          `[CampaignScheduler] Campaign ${campaign.id} reached daily limit (${campaign.sentTodayCount}/${campaign.dailyLimit})`
        );
        continue;
      }

      // Get an available email account
      const accountId = await getAvailableAccount(campaign.accountIds);
      if (!accountId) {
        console.log(
          `[CampaignScheduler] Campaign ${campaign.id} no available accounts`
        );
        continue;
      }

      // Find recipients who are ready to receive an email
      const remainingLimit = Math.min(
        campaign.dailyLimit - campaign.sentTodayCount,
        MAX_EMAILS_PER_RUN - totalProcessed
      );

      if (remainingLimit <= 0) {
        continue;
      }

      const recipients = await prisma.campaignRecipient.findMany({
        where: {
          campaignId: campaign.id,
          status: "ACTIVE",
          nextSendAt: { lte: now },
        },
        take: remainingLimit,
        orderBy: { nextSendAt: "asc" },
      });

      for (const recipient of recipients) {
        if (totalProcessed >= MAX_EMAILS_PER_RUN) {
          break;
        }

        // Get the next sequence step for this recipient
        const nextStep = recipient.currentStep + 1;
        const sequence = campaign.sequences.find(
          (s) => s.stepNumber === nextStep
        );

        if (!sequence) {
          // No more steps, mark as completed
          await prisma.campaignRecipient.update({
            where: { id: recipient.id },
            data: {
              status: "COMPLETED",
              completedAt: now,
              nextSendAt: null,
            },
          });
          continue;
        }

        // Send the email
        const result = await sendCampaignEmail({
          accountId,
          recipientId: recipient.id,
          sequenceId: sequence.id,
          campaignId: campaign.id,
        });

        totalProcessed++;

        if (result.success) {
          totalSent++;

          // Calculate next send time
          const nextSendAt = calculateNextSendAt(
            now,
            sequence.delayDays,
            sequence.delayHours,
            campaign.sequences,
            nextStep
          );

          // Update recipient status
          await prisma.campaignRecipient.update({
            where: { id: recipient.id },
            data: {
              currentStep: nextStep,
              nextSendAt,
            },
          });

          console.log(
            `[CampaignScheduler] Sent step ${nextStep} to ${recipient.email}`
          );
        } else {
          totalErrors++;
          console.error(
            `[CampaignScheduler] Failed to send to ${recipient.email}: ${result.error}`
          );

          // Check if this is a bounce (SMTP error indicating delivery failure)
          if (
            result.error?.includes("rejected") ||
            result.error?.includes("bounce") ||
            result.error?.includes("invalid")
          ) {
            await handleBounce(recipient.id, campaign.id, result.error || "Unknown error");
          }
        }
      }

      // Check if campaign is complete (all recipients done)
      const pendingRecipients = await prisma.campaignRecipient.count({
        where: {
          campaignId: campaign.id,
          status: { in: ["PENDING", "ACTIVE"] },
        },
      });

      if (pendingRecipients === 0) {
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { status: "COMPLETED" },
        });
        console.log(`[CampaignScheduler] Campaign ${campaign.id} completed`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `[CampaignScheduler] Completed: ${totalSent} sent, ${totalErrors} errors in ${duration}ms`
    );

    return NextResponse.json({
      success: true,
      message: `Processed ${totalProcessed} emails`,
      stats: {
        processed: totalProcessed,
        sent: totalSent,
        errors: totalErrors,
        duration: `${duration}ms`,
        campaignsChecked: campaigns.length,
      },
    });
  } catch (error) {
    console.error("[CampaignScheduler] Error:", error);
    return NextResponse.json(
      { error: "Campaign scheduler failed" },
      { status: 500 }
    );
  }
}

// POST for manual trigger
export async function POST(request: NextRequest) {
  return GET(request);
}

/**
 * Get day of week as abbreviated string (MON, TUE, etc.)
 */
function getDayOfWeek(date: Date): string {
  const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  return days[date.getDay()];
}

/**
 * Calculate the next send time based on delay settings
 */
function calculateNextSendAt(
  from: Date,
  delayDays: number,
  delayHours: number,
  sequences: Array<{ stepNumber: number; delayDays: number; delayHours: number }>,
  currentStep: number
): Date | null {
  // Check if there's a next step
  const nextSequence = sequences.find((s) => s.stepNumber === currentStep + 1);
  if (!nextSequence) {
    return null; // No more steps
  }

  const nextSendAt = new Date(from);
  nextSendAt.setDate(nextSendAt.getDate() + nextSequence.delayDays);
  nextSendAt.setHours(nextSendAt.getHours() + nextSequence.delayHours);

  return nextSendAt;
}

/**
 * Handle a bounced email
 */
async function handleBounce(
  recipientId: string,
  campaignId: string,
  reason: string
): Promise<void> {
  try {
    // Update recipient status
    await prisma.campaignRecipient.update({
      where: { id: recipientId },
      data: {
        status: "BOUNCED",
        bouncedAt: new Date(),
        nextSendAt: null,
      },
    });

    // Update campaign bounce count
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        bounceCount: { increment: 1 },
      },
    });

    console.log(`[CampaignScheduler] Marked recipient ${recipientId} as bounced: ${reason}`);
  } catch (error) {
    console.error("Error handling bounce:", error);
  }
}
