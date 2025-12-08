import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const SCRAPER_URL = process.env.SCRAPER_URL || "http://127.0.0.1:8765";

/**
 * GET /api/scrape/job/[jobId]
 * Get status of a bulk scraping job
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobId } = await params;

    const response = await fetch(`${SCRAPER_URL}/scrape/job/${jobId}`);

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
      }
      const error = await response.text();
      throw new Error(error);
    }

    const jobStatus = await response.json();

    return NextResponse.json(jobStatus);

  } catch (error) {
    console.error("Job status error:", error);
    return NextResponse.json(
      {
        error: "Failed to get job status",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
