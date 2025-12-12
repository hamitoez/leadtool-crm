import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type Params = Promise<{ tableId: string }>;

interface DuplicateCheckRequest {
  urls?: string[];
  emails?: string[];
}

interface DuplicateResult {
  value: string;
  type: "url" | "email";
  existingRowId: string;
}

export async function POST(
  request: NextRequest,
  context: { params: Params }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tableId } = await context.params;
    const body: DuplicateCheckRequest = await request.json();
    const { urls = [], emails = [] } = body;

    if (urls.length === 0 && emails.length === 0) {
      return NextResponse.json({ duplicates: [] });
    }

    // Check authorization
    const table = await prisma.table.findUnique({
      where: { id: tableId },
      include: {
        project: {
          select: { userId: true },
        },
        columns: true,
      },
    });

    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    if (table.project.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Find URL and Email columns
    const urlColumns = table.columns.filter(
      (c) =>
        c.type === "URL" ||
        c.name.toLowerCase().includes("website") ||
        c.name.toLowerCase().includes("url") ||
        c.name.toLowerCase().includes("webseite")
    );

    const emailColumns = table.columns.filter(
      (c) =>
        c.type === "EMAIL" ||
        c.name.toLowerCase().includes("email") ||
        c.name.toLowerCase().includes("e-mail")
    );

    const duplicates: DuplicateResult[] = [];

    // Check for URL duplicates
    if (urls.length > 0 && urlColumns.length > 0) {
      // Normalize URLs for comparison
      const normalizedUrls = urls.map((url) => {
        try {
          const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
          return parsed.hostname.replace("www.", "").toLowerCase();
        } catch {
          return url.toLowerCase();
        }
      });

      const urlColumnIds = urlColumns.map((c) => c.id);

      // Find existing cells with matching URLs
      const existingCells = await prisma.cell.findMany({
        where: {
          columnId: { in: urlColumnIds },
          row: { tableId },
        },
        include: {
          row: { select: { id: true } },
        },
      });

      for (const cell of existingCells) {
        const cellValue = cell.value as string;
        if (!cellValue) continue;

        try {
          const existingNormalized = new URL(
            cellValue.startsWith("http") ? cellValue : `https://${cellValue}`
          ).hostname.replace("www.", "").toLowerCase();

          const matchIndex = normalizedUrls.findIndex(
            (url) => url === existingNormalized
          );

          if (matchIndex !== -1) {
            duplicates.push({
              value: urls[matchIndex],
              type: "url",
              existingRowId: cell.row.id,
            });
          }
        } catch {
          // Skip invalid URLs
        }
      }
    }

    // Check for Email duplicates
    if (emails.length > 0 && emailColumns.length > 0) {
      const normalizedEmails = emails.map((e) => e.toLowerCase().trim());
      const emailColumnIds = emailColumns.map((c) => c.id);

      const existingCells = await prisma.cell.findMany({
        where: {
          columnId: { in: emailColumnIds },
          row: { tableId },
        },
        include: {
          row: { select: { id: true } },
        },
      });

      for (const cell of existingCells) {
        const cellValue = cell.value as string;
        if (!cellValue) continue;

        const existingNormalized = cellValue.toLowerCase().trim();
        const matchIndex = normalizedEmails.findIndex(
          (email) => email === existingNormalized
        );

        if (matchIndex !== -1) {
          duplicates.push({
            value: emails[matchIndex],
            type: "email",
            existingRowId: cell.row.id,
          });
        }
      }
    }

    // Remove duplicates from result (same value might match multiple columns)
    const uniqueDuplicates = duplicates.filter(
      (dup, index, self) =>
        index === self.findIndex((d) => d.value === dup.value && d.type === dup.type)
    );

    return NextResponse.json({
      duplicates: uniqueDuplicates,
      hasDuplicates: uniqueDuplicates.length > 0,
    });
  } catch (error) {
    console.error("Error checking duplicates:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
