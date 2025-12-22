import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/activities/available-rows - Get all rows for task creation
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await prisma.row.findMany({
      where: {
        table: {
          project: { userId: session.user.id },
        },
      },
      include: {
        cells: {
          include: {
            column: {
              select: { name: true, type: true },
            },
          },
        },
        table: {
          select: {
            name: true,
            project: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error fetching rows:", error);
    return NextResponse.json({ error: "Failed to fetch rows" }, { status: 500 });
  }
}
