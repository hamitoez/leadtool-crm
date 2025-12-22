import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/export?type=leads|deals|activities&format=csv&projectId=xxx&tableId=xxx
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "leads";
    const projectId = searchParams.get("projectId");
    const tableId = searchParams.get("tableId");
    const pipelineId = searchParams.get("pipelineId");

    let data: string;
    let filename: string;

    switch (type) {
      case "leads":
        data = await exportLeads(session.user.id, tableId);
        filename = `leads-export-${new Date().toISOString().split("T")[0]}.csv`;
        break;

      case "deals":
        data = await exportDeals(session.user.id, pipelineId);
        filename = `deals-export-${new Date().toISOString().split("T")[0]}.csv`;
        break;

      case "activities":
        data = await exportActivities(session.user.id, projectId);
        filename = `activities-export-${new Date().toISOString().split("T")[0]}.csv`;
        break;

      case "pipeline-report":
        data = await exportPipelineReport(session.user.id, pipelineId);
        filename = `pipeline-report-${new Date().toISOString().split("T")[0]}.csv`;
        break;

      default:
        return NextResponse.json({ error: "Invalid export type" }, { status: 400 });
    }

    // Return CSV
    return new NextResponse(data, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}

async function exportLeads(userId: string, tableId: string | null): Promise<string> {
  const where: { table: { project: { userId: string }; id?: string } } = {
    table: { project: { userId } },
  };

  if (tableId) {
    where.table.id = tableId;
  }

  const rows = await prisma.row.findMany({
    where,
    include: {
      cells: { include: { column: true } },
      table: { select: { name: true } },
      deal: {
        select: {
          value: true,
          probability: true,
          stage: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 10000, // Limit to 10k rows
  });

  if (rows.length === 0) {
    return "Keine Daten vorhanden";
  }

  // Get all unique column names
  const columnNames = new Set<string>();
  rows.forEach((row) => {
    row.cells.forEach((cell) => {
      columnNames.add(cell.column.name);
    });
  });

  // Build CSV header
  const headers = [
    "Tabelle",
    "Erstellt am",
    ...Array.from(columnNames),
    "Deal Stage",
    "Deal Wert",
    "Deal Wahrscheinlichkeit",
  ];

  // Build CSV rows
  const csvRows = rows.map((row) => {
    const cellValues: Record<string, string> = {};
    row.cells.forEach((cell) => {
      cellValues[cell.column.name] = formatCellValue(cell.value);
    });

    return [
      escapeCsv(row.table.name),
      new Date(row.createdAt).toLocaleDateString("de-DE"),
      ...Array.from(columnNames).map((col) => escapeCsv(cellValues[col] || "")),
      escapeCsv(row.deal?.stage?.name || ""),
      row.deal?.value?.toString() || "",
      row.deal?.probability?.toString() || "",
    ];
  });

  return [headers.map(escapeCsv).join(";"), ...csvRows.map((r) => r.join(";"))].join("\n");
}

async function exportDeals(userId: string, pipelineId: string | null): Promise<string> {
  const where: {
    stage: { pipeline: { project: { userId: string }; id?: string } };
  } = {
    stage: { pipeline: { project: { userId } } },
  };

  if (pipelineId) {
    where.stage.pipeline.id = pipelineId;
  }

  const deals = await prisma.deal.findMany({
    where,
    include: {
      stage: { select: { name: true, stageType: true } },
      row: {
        include: {
          cells: {
            where: { column: { type: { in: ["COMPANY", "PERSON", "EMAIL", "PHONE"] } } },
            include: { column: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 10000,
  });

  if (deals.length === 0) {
    return "Keine Deals vorhanden";
  }

  const headers = [
    "ID",
    "Firma/Name",
    "E-Mail",
    "Telefon",
    "Stage",
    "Status",
    "Wert (EUR)",
    "Wahrscheinlichkeit (%)",
    "Erwarteter Abschluss",
    "Erstellt am",
    "Stage geaendert am",
    "Gewonnen am",
    "Verloren am",
    "Verlustgrund",
  ];

  const csvRows = deals.map((deal) => {
    const cells = deal.row?.cells || [];
    const companyCell = cells.find((c) => c.column.type === "COMPANY");
    const personCell = cells.find((c) => c.column.type === "PERSON");
    const emailCell = cells.find((c) => c.column.type === "EMAIL");
    const phoneCell = cells.find((c) => c.column.type === "PHONE");

    const name = formatCellValue(companyCell?.value) || formatCellValue(personCell?.value) || "";

    let status = "Offen";
    if (deal.wonAt) status = "Gewonnen";
    else if (deal.lostAt) status = "Verloren";

    return [
      deal.id,
      escapeCsv(name),
      escapeCsv(formatCellValue(emailCell?.value)),
      escapeCsv(formatCellValue(phoneCell?.value)),
      escapeCsv(deal.stage.name),
      status,
      deal.value?.toString() || "0",
      deal.probability.toString(),
      deal.expectedClose ? new Date(deal.expectedClose).toLocaleDateString("de-DE") : "",
      new Date(deal.createdAt).toLocaleDateString("de-DE"),
      new Date(deal.stageChangedAt).toLocaleDateString("de-DE"),
      deal.wonAt ? new Date(deal.wonAt).toLocaleDateString("de-DE") : "",
      deal.lostAt ? new Date(deal.lostAt).toLocaleDateString("de-DE") : "",
      escapeCsv(deal.lostReason || ""),
    ];
  });

  return [headers.map(escapeCsv).join(";"), ...csvRows.map((r) => r.join(";"))].join("\n");
}

async function exportActivities(userId: string, projectId: string | null): Promise<string> {
  const where: {
    userId: string;
    row?: { table: { projectId: string } };
  } = { userId };

  if (projectId) {
    where.row = { table: { projectId } };
  }

  const activities = await prisma.activity.findMany({
    where,
    include: {
      row: {
        include: {
          cells: {
            where: { column: { type: { in: ["COMPANY", "PERSON"] } } },
            include: { column: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 10000,
  });

  if (activities.length === 0) {
    return "Keine Aktivitaeten vorhanden";
  }

  const headers = [
    "ID",
    "Typ",
    "Status",
    "Titel",
    "Beschreibung",
    "Kontakt",
    "Prioritaet",
    "Faellig am",
    "Erledigt am",
    "Anrufdauer (Sek)",
    "Erstellt am",
  ];

  const csvRows = activities.map((a) => {
    const cells = a.row?.cells || [];
    const companyCell = cells.find((c) => c.column.type === "COMPANY");
    const personCell = cells.find((c) => c.column.type === "PERSON");
    const contact = formatCellValue(companyCell?.value) || formatCellValue(personCell?.value) || "";

    return [
      a.id,
      a.type,
      a.status,
      escapeCsv(a.title),
      escapeCsv(a.description || ""),
      escapeCsv(contact),
      a.priority || "",
      a.dueDate ? new Date(a.dueDate).toLocaleDateString("de-DE") : "",
      a.completedAt ? new Date(a.completedAt).toLocaleDateString("de-DE") : "",
      a.callDuration?.toString() || "",
      new Date(a.createdAt).toLocaleDateString("de-DE"),
    ];
  });

  return [headers.map(escapeCsv).join(";"), ...csvRows.map((r) => r.join(";"))].join("\n");
}

async function exportPipelineReport(userId: string, pipelineId: string | null): Promise<string> {
  const where: { project: { userId: string }; id?: string } = { project: { userId } };

  if (pipelineId) {
    where.id = pipelineId;
  }

  const pipelines = await prisma.pipeline.findMany({
    where,
    include: {
      stages: {
        orderBy: { position: "asc" },
        include: {
          deals: {
            select: {
              value: true,
              probability: true,
              wonAt: true,
              lostAt: true,
              createdAt: true,
              stageChangedAt: true,
            },
          },
        },
      },
    },
  });

  if (pipelines.length === 0) {
    return "Keine Pipelines vorhanden";
  }

  const lines: string[] = ["Pipeline Report", ""];

  for (const pipeline of pipelines) {
    lines.push(`Pipeline: ${pipeline.name}`);
    lines.push("");
    lines.push("Stage;Deals;Offene Deals;Gewonnen;Verloren;Gesamtwert;Gewichteter Wert;Durchschn. Tage in Stage");

    for (const stage of pipeline.stages) {
      const openDeals = stage.deals.filter((d) => !d.wonAt && !d.lostAt);
      const wonDeals = stage.deals.filter((d) => d.wonAt);
      const lostDeals = stage.deals.filter((d) => d.lostAt);
      const totalValue = openDeals.reduce((sum, d) => sum + (d.value || 0), 0);
      const weightedValue = openDeals.reduce(
        (sum, d) => sum + (d.value || 0) * (d.probability / 100),
        0
      );

      // Average days in stage
      const now = new Date();
      const avgDays =
        openDeals.length > 0
          ? Math.round(
              openDeals.reduce((sum, d) => {
                const days = Math.floor(
                  (now.getTime() - new Date(d.stageChangedAt).getTime()) / (1000 * 60 * 60 * 24)
                );
                return sum + days;
              }, 0) / openDeals.length
            )
          : 0;

      lines.push(
        [
          escapeCsv(stage.name),
          stage.deals.length.toString(),
          openDeals.length.toString(),
          wonDeals.length.toString(),
          lostDeals.length.toString(),
          totalValue.toFixed(2),
          weightedValue.toFixed(2),
          avgDays.toString(),
        ].join(";")
      );
    }

    lines.push("");

    // Summary
    const allDeals = pipeline.stages.flatMap((s) => s.deals);
    const totalOpen = allDeals.filter((d) => !d.wonAt && !d.lostAt).length;
    const totalWon = allDeals.filter((d) => d.wonAt).length;
    const totalLost = allDeals.filter((d) => d.lostAt).length;
    const totalClosed = totalWon + totalLost;
    const winRate = totalClosed > 0 ? ((totalWon / totalClosed) * 100).toFixed(1) : "0";

    lines.push("Zusammenfassung");
    lines.push(`Offene Deals;${totalOpen}`);
    lines.push(`Gewonnene Deals;${totalWon}`);
    lines.push(`Verlorene Deals;${totalLost}`);
    lines.push(`Win Rate;${winRate}%`);
    lines.push("");
  }

  return lines.join("\n");
}

function escapeCsv(value: string): string {
  if (!value) return "";
  // If value contains semicolon, newline, or quotes, wrap in quotes
  if (value.includes(";") || value.includes("\n") || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
