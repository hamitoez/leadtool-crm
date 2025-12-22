import { NextRequest, NextResponse } from "next/server";
import { syncAllAccounts } from "@/lib/email/imap-sync";

// Secret key for cron authentication
const CRON_SECRET = process.env.CRON_SECRET || "leadtool-cron-secret-2024";

/**
 * IMAP Sync Cron Job
 *
 * This endpoint should be called every 5-10 minutes by a cron job.
 * It syncs incoming emails from all active accounts and detects replies/bounces.
 *
 * Usage:
 *   curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
 *        https://your-domain.com/api/cron/imap-sync
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    const providedSecret = authHeader?.replace("Bearer ", "");

    if (providedSecret !== CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[IMAP Sync Cron] Starting...");
    const startTime = Date.now();

    // Run the sync
    const stats = await syncAllAccounts();

    const duration = Date.now() - startTime;
    console.log(`[IMAP Sync Cron] Completed in ${duration}ms`);

    return NextResponse.json({
      success: true,
      message: `Synced ${stats.successfulSyncs}/${stats.totalAccounts} accounts`,
      duration: `${duration}ms`,
      stats: {
        totalAccounts: stats.totalAccounts,
        successfulSyncs: stats.successfulSyncs,
        failedSyncs: stats.failedSyncs,
        emailsProcessed: stats.totalEmailsProcessed,
        repliesFound: stats.totalRepliesFound,
        bouncesFound: stats.totalBouncesFound,
      },
      // Include per-account results for debugging
      accounts: stats.results.map((r) => ({
        email: r.accountEmail,
        success: r.success,
        emails: r.emailsProcessed,
        replies: r.repliesFound,
        bounces: r.bouncesFound,
        error: r.error,
      })),
    });
  } catch (error) {
    console.error("[IMAP Sync Cron] Error:", error);
    return NextResponse.json(
      { error: "IMAP sync failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST for manual trigger
export async function POST(request: NextRequest) {
  return GET(request);
}
