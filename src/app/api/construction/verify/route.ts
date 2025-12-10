import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// Construction password
const CONSTRUCTION_PASSWORD = "LeadToolWeboa123";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    if (password === CONSTRUCTION_PASSWORD) {
      // Set a cookie to remember the user has access
      const cookieStore = await cookies();
      cookieStore.set("construction_access", "granted", {
        httpOnly: true,
        secure: false, // Allow HTTP for local testing
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: "/",
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Invalid password" });
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request" },
      { status: 400 }
    );
  }
}
