import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const SCRAPER_URL = process.env.SCRAPER_URL || "http://127.0.0.1:8765";

/**
 * GET /api/scrape/job/[jobId]
 * Get job status
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
      throw new Error("Failed to get job status");
    }

    const data = await response.json();

    return NextResponse.json(data);

  } catch (error) {
    console.error("Job status error:", error);
    return NextResponse.json(
      { error: "Failed to get job status" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/scrape/job/[jobId]
 * Control job (cancel, etc.)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobId } = await params;
    const body = await request.json();

    const response = await fetch(`${SCRAPER_URL}/scrape/job/${jobId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error("Failed to control job");
    }

    const data = await response.json();

    return NextResponse.json(data);

  } catch (error) {
    console.error("Job control error:", error);
    return NextResponse.json(
      { error: "Failed to control job" },
      { status: 500 }
    );
  }
}
