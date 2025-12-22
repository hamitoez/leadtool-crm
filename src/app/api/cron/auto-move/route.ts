import { NextRequest, NextResponse } from "next/server";
import { processAutoMoveForAllUsers } from "@/lib/pipeline/auto-move";

// Secret key for cron authentication
const CRON_SECRET = process.env.CRON_SECRET || "leadtool-cron-secret-2024";

// GET /api/cron/auto-move - Process auto-move for all users
// This endpoint should be called by a cron job every hour
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    const providedSecret = authHeader?.replace("Bearer ", "");

    if (providedSecret !== CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[Cron] Starting auto-move processing...");
    const startTime = Date.now();

    const result = await processAutoMoveForAllUsers();

    const duration = Date.now() - startTime;
    console.log(
      `[Cron] Auto-move completed: ${result.totalMoved} deals moved in ${duration}ms`
    );

    return NextResponse.json({
      success: true,
      message: `${result.totalMoved} Deals automatisch verschoben`,
      duration: `${duration}ms`,
      ...result,
    });
  } catch (error) {
    console.error("[Cron] Auto-move error:", error);
    return NextResponse.json(
      { error: "Auto-move processing failed" },
      { status: 500 }
    );
  }
}

// POST for manual trigger (with auth)
export async function POST(request: NextRequest) {
  return GET(request);
}
