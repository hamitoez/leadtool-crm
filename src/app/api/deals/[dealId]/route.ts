import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const updateDealSchema = z.object({
  value: z.number().min(0).nullable().optional(),
  probability: z.number().int().min(0).max(100).optional(),
  expectedClose: z.string().datetime().nullable().optional(),
  lostReason: z.string().nullable().optional(),
});

// Helper to verify deal access
async function verifyDealAccess(dealId: string, userId: string) {
  return prisma.deal.findFirst({
    where: {
      id: dealId,
      row: { table: { project: { userId } } },
    },
    include: {
      stage: true,
      row: {
        include: {
          cells: { include: { column: true } },
        },
      },
    },
  });
}

// GET /api/deals/[dealId]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { dealId } = await params;
    const deal = await verifyDealAccess(dealId, session.user.id);

    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    return NextResponse.json(deal);
  } catch (error) {
    console.error("Error fetching deal:", error);
    return NextResponse.json({ error: "Failed to fetch deal" }, { status: 500 });
  }
}

// PATCH /api/deals/[dealId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { dealId } = await params;
    const deal = await verifyDealAccess(dealId, session.user.id);

    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    const body = await request.json();
    const data = updateDealSchema.parse(body);

    // Track value changes for history
    const historyEntries: Array<{
      rowId: string;
      userId: string;
      eventType: "VALUE_CHANGED" | "PROBABILITY_CHANGED";
      title: string;
      oldValue: { value: number | null } | { probability: number };
      newValue: { value: number | null } | { probability: number };
      fieldName: string;
    }> = [];

    if (data.value !== undefined && data.value !== deal.value) {
      historyEntries.push({
        rowId: deal.rowId,
        userId: session.user.id,
        eventType: "VALUE_CHANGED" as const,
        title: "Deal-Wert geändert",
        oldValue: { value: deal.value },
        newValue: { value: data.value },
        fieldName: "value",
      });
    }

    if (data.probability !== undefined && data.probability !== deal.probability) {
      historyEntries.push({
        rowId: deal.rowId,
        userId: session.user.id,
        eventType: "PROBABILITY_CHANGED" as const,
        title: "Wahrscheinlichkeit geändert",
        oldValue: { probability: deal.probability },
        newValue: { probability: data.probability },
        fieldName: "probability",
      });
    }

    const updated = await prisma.deal.update({
      where: { id: dealId },
      data: {
        value: data.value,
        probability: data.probability,
        expectedClose: data.expectedClose ? new Date(data.expectedClose) : undefined,
        lostReason: data.lostReason,
      },
      include: {
        row: {
          include: {
            cells: { include: { column: true } },
          },
        },
        stage: true,
      },
    });

    // Create history entries
    if (historyEntries.length > 0) {
      await prisma.contactHistory.createMany({
        data: historyEntries,
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating deal:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update deal" }, { status: 500 });
  }
}

// DELETE /api/deals/[dealId] - Remove deal from pipeline
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { dealId } = await params;
    const deal = await verifyDealAccess(dealId, session.user.id);

    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    await prisma.deal.delete({
      where: { id: dealId },
    });

    // Reorder remaining deals in stage
    const remainingDeals = await prisma.deal.findMany({
      where: { stageId: deal.stageId },
      orderBy: { position: "asc" },
    });

    await Promise.all(
      remainingDeals.map((d, index) =>
        prisma.deal.update({
          where: { id: d.id },
          data: { position: index },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting deal:", error);
    return NextResponse.json({ error: "Failed to delete deal" }, { status: 500 });
  }
}
