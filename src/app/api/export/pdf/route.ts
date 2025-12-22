import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// GET /api/export/pdf?type=pipeline-report|deals|activities
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "pipeline-report";
    const pipelineId = searchParams.get("pipelineId");

    const doc = new jsPDF();
    let filename: string;

    // Set font
    doc.setFont("helvetica");

    switch (type) {
      case "pipeline-report":
        await generatePipelineReport(doc, session.user.id, pipelineId);
        filename = `pipeline-report-${new Date().toISOString().split("T")[0]}.pdf`;
        break;

      case "deals":
        await generateDealsReport(doc, session.user.id, pipelineId);
        filename = `deals-report-${new Date().toISOString().split("T")[0]}.pdf`;
        break;

      case "activities":
        await generateActivitiesReport(doc, session.user.id);
        filename = `activities-report-${new Date().toISOString().split("T")[0]}.pdf`;
        break;

      case "dashboard":
        await generateDashboardReport(doc, session.user.id);
        filename = `dashboard-report-${new Date().toISOString().split("T")[0]}.pdf`;
        break;

      default:
        return NextResponse.json({ error: "Invalid export type" }, { status: 400 });
    }

    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("PDF Export error:", error);
    return NextResponse.json({ error: "PDF Export failed" }, { status: 500 });
  }
}

async function generatePipelineReport(doc: jsPDF, userId: string, pipelineId: string | null) {
  const where: { project: { userId: string }; id?: string } = { project: { userId } };
  if (pipelineId) where.id = pipelineId;

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
            },
          },
        },
      },
    },
  });

  // Title
  doc.setFontSize(20);
  doc.text("Pipeline Report", 14, 20);
  doc.setFontSize(10);
  doc.text(`Erstellt am: ${new Date().toLocaleDateString("de-DE")}`, 14, 28);

  let yPos = 40;

  for (const pipeline of pipelines) {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.text(`Pipeline: ${pipeline.name}`, 14, yPos);
    yPos += 10;

    // Stage table
    const stageData = pipeline.stages.map((stage) => {
      const openDeals = stage.deals.filter((d) => !d.wonAt && !d.lostAt);
      const wonDeals = stage.deals.filter((d) => d.wonAt);
      const lostDeals = stage.deals.filter((d) => d.lostAt);
      const totalValue = openDeals.reduce((sum, d) => sum + (d.value || 0), 0);
      const weightedValue = openDeals.reduce(
        (sum, d) => sum + (d.value || 0) * (d.probability / 100),
        0
      );

      return [
        stage.name,
        stage.deals.length.toString(),
        openDeals.length.toString(),
        wonDeals.length.toString(),
        lostDeals.length.toString(),
        formatCurrency(totalValue),
        formatCurrency(weightedValue),
      ];
    });

    autoTable(doc, {
      head: [["Stage", "Gesamt", "Offen", "Gewonnen", "Verloren", "Wert", "Gewichtet"]],
      body: stageData,
      startY: yPos,
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 9 },
    });

    // Get final Y position from the document
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    yPos = ((doc as any).lastAutoTable?.finalY || yPos + 50) + 15;

    // Summary
    const allDeals = pipeline.stages.flatMap((s) => s.deals);
    const totalOpen = allDeals.filter((d) => !d.wonAt && !d.lostAt).length;
    const totalWon = allDeals.filter((d) => d.wonAt).length;
    const totalLost = allDeals.filter((d) => d.lostAt).length;
    const totalClosed = totalWon + totalLost;
    const winRate = totalClosed > 0 ? ((totalWon / totalClosed) * 100).toFixed(1) : "0";

    doc.setFontSize(10);
    doc.text(`Zusammenfassung: ${totalOpen} offen, ${totalWon} gewonnen, ${totalLost} verloren, Win Rate: ${winRate}%`, 14, yPos);
    yPos += 20;
  }

  if (pipelines.length === 0) {
    doc.setFontSize(12);
    doc.text("Keine Pipelines vorhanden.", 14, 50);
  }
}

async function generateDealsReport(doc: jsPDF, userId: string, pipelineId: string | null) {
  const where: { stage: { pipeline: { project: { userId: string }; id?: string } } } = {
    stage: { pipeline: { project: { userId } } },
  };
  if (pipelineId) where.stage.pipeline.id = pipelineId;

  const deals = await prisma.deal.findMany({
    where,
    include: {
      stage: { select: { name: true } },
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
    take: 100,
  });

  // Title
  doc.setFontSize(20);
  doc.text("Deals Report", 14, 20);
  doc.setFontSize(10);
  doc.text(`Erstellt am: ${new Date().toLocaleDateString("de-DE")} | ${deals.length} Deals`, 14, 28);

  if (deals.length === 0) {
    doc.setFontSize(12);
    doc.text("Keine Deals vorhanden.", 14, 50);
    return;
  }

  const dealData = deals.map((deal) => {
    const companyCell = deal.row?.cells?.find((c) => c.column.type === "COMPANY");
    const personCell = deal.row?.cells?.find((c) => c.column.type === "PERSON");
    const name = (companyCell?.value as string) || (personCell?.value as string) || "Unbekannt";

    let status = "Offen";
    if (deal.wonAt) status = "Gewonnen";
    else if (deal.lostAt) status = "Verloren";

    return [
      name.substring(0, 25),
      deal.stage.name,
      status,
      formatCurrency(deal.value || 0),
      `${deal.probability}%`,
      new Date(deal.createdAt).toLocaleDateString("de-DE"),
    ];
  });

  autoTable(doc, {
    head: [["Name", "Stage", "Status", "Wert", "Wahrsch.", "Erstellt"]],
    body: dealData,
    startY: 35,
    theme: "striped",
    headStyles: { fillColor: [34, 197, 94] },
    styles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 45 },
      3: { halign: "right" },
      4: { halign: "right" },
    },
  });

  // Summary
  const openDeals = deals.filter((d) => !d.wonAt && !d.lostAt);
  const totalValue = openDeals.reduce((sum, d) => sum + (d.value || 0), 0);
  const wonValue = deals.filter((d) => d.wonAt).reduce((sum, d) => sum + (d.value || 0), 0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = ((doc as any).lastAutoTable?.finalY || 200) + 10;
  doc.setFontSize(10);
  doc.text(`Pipeline-Wert: ${formatCurrency(totalValue)} | Gewonnen: ${formatCurrency(wonValue)}`, 14, finalY);
}

async function generateActivitiesReport(doc: jsPDF, userId: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const activities = await prisma.activity.findMany({
    where: {
      userId,
      createdAt: { gte: thirtyDaysAgo },
    },
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
    take: 100,
  });

  // Title
  doc.setFontSize(20);
  doc.text("Aktivitaeten Report", 14, 20);
  doc.setFontSize(10);
  doc.text(`Letzte 30 Tage | ${activities.length} Aktivitaeten`, 14, 28);

  if (activities.length === 0) {
    doc.setFontSize(12);
    doc.text("Keine Aktivitaeten in den letzten 30 Tagen.", 14, 50);
    return;
  }

  // Summary by type
  const byType: Record<string, number> = {};
  activities.forEach((a) => {
    byType[a.type] = (byType[a.type] || 0) + 1;
  });

  const typeLabels: Record<string, string> = {
    CALL: "Anrufe",
    EMAIL: "E-Mails",
    MEETING: "Meetings",
    NOTE: "Notizen",
    TASK: "Aufgaben",
  };

  let summaryText = "Zusammenfassung: ";
  Object.entries(byType).forEach(([type, count], idx) => {
    summaryText += `${typeLabels[type] || type}: ${count}`;
    if (idx < Object.entries(byType).length - 1) summaryText += ", ";
  });
  doc.text(summaryText, 14, 36);

  const activityData = activities.map((a) => {
    const companyCell = a.row?.cells?.find((c) => c.column.type === "COMPANY");
    const personCell = a.row?.cells?.find((c) => c.column.type === "PERSON");
    const contact = (companyCell?.value as string) || (personCell?.value as string) || "-";

    return [
      new Date(a.createdAt).toLocaleDateString("de-DE"),
      typeLabels[a.type] || a.type,
      a.title.substring(0, 40),
      contact.substring(0, 20),
      a.status,
    ];
  });

  autoTable(doc, {
    head: [["Datum", "Typ", "Titel", "Kontakt", "Status"]],
    body: activityData,
    startY: 42,
    theme: "striped",
    headStyles: { fillColor: [139, 92, 246] },
    styles: { fontSize: 8 },
    columnStyles: {
      2: { cellWidth: 60 },
    },
  });
}

async function generateDashboardReport(doc: jsPDF, userId: string) {
  const now = new Date();
  const oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  // Get pipeline data
  const pipelines = await prisma.pipeline.findMany({
    where: { project: { userId } },
    include: {
      stages: {
        include: {
          deals: {
            select: { value: true, probability: true, wonAt: true, lostAt: true },
          },
        },
      },
    },
  });

  const allDeals = pipelines.flatMap((p) => p.stages.flatMap((s) => s.deals));
  const openDeals = allDeals.filter((d) => !d.wonAt && !d.lostAt);
  const wonDeals = allDeals.filter((d) => d.wonAt);
  const lostDeals = allDeals.filter((d) => d.lostAt);
  const totalValue = openDeals.reduce((sum, d) => sum + (d.value || 0), 0);
  const weightedValue = openDeals.reduce((sum, d) => sum + (d.value || 0) * (d.probability / 100), 0);
  const wonValue = wonDeals.reduce((sum, d) => sum + (d.value || 0), 0);
  const totalClosed = wonDeals.length + lostDeals.length;
  const winRate = totalClosed > 0 ? ((wonDeals.length / totalClosed) * 100).toFixed(1) : "0";

  // Get activity counts
  const [calls, emails, meetings, tasks] = await Promise.all([
    prisma.activity.count({ where: { userId, type: "CALL", createdAt: { gte: oneWeekAgo } } }),
    prisma.activity.count({ where: { userId, type: "EMAIL", createdAt: { gte: oneWeekAgo } } }),
    prisma.activity.count({ where: { userId, type: "MEETING", createdAt: { gte: oneWeekAgo } } }),
    prisma.activity.count({ where: { userId, type: "TASK", createdAt: { gte: oneWeekAgo } } }),
  ]);

  // Title
  doc.setFontSize(22);
  doc.text("CRM Dashboard Report", 14, 20);
  doc.setFontSize(10);
  doc.text(`Erstellt am: ${new Date().toLocaleDateString("de-DE")} ${new Date().toLocaleTimeString("de-DE")}`, 14, 28);

  // Pipeline Overview
  doc.setFontSize(14);
  doc.text("Pipeline Uebersicht", 14, 45);

  autoTable(doc, {
    head: [["Kennzahl", "Wert"]],
    body: [
      ["Offene Deals", openDeals.length.toString()],
      ["Pipeline-Wert", formatCurrency(totalValue)],
      ["Gewichteter Wert", formatCurrency(weightedValue)],
      ["Durchschn. Deal-Groesse", formatCurrency(openDeals.length > 0 ? totalValue / openDeals.length : 0)],
    ],
    startY: 50,
    theme: "grid",
    headStyles: { fillColor: [59, 130, 246] },
    styles: { fontSize: 10 },
    columnStyles: { 1: { halign: "right" } },
    margin: { left: 14, right: 110 },
  });

  // Performance
  doc.setFontSize(14);
  doc.text("Performance", 110, 45);

  autoTable(doc, {
    head: [["Kennzahl", "Wert"]],
    body: [
      ["Gewonnen", `${wonDeals.length} (${formatCurrency(wonValue)})`],
      ["Verloren", lostDeals.length.toString()],
      ["Win Rate", `${winRate}%`],
    ],
    startY: 50,
    theme: "grid",
    headStyles: { fillColor: [34, 197, 94] },
    styles: { fontSize: 10 },
    columnStyles: { 1: { halign: "right" } },
    margin: { left: 110, right: 14 },
  });

  // Activities this week
  doc.setFontSize(14);
  doc.text("Aktivitaeten diese Woche", 14, 110);

  autoTable(doc, {
    head: [["Typ", "Anzahl"]],
    body: [
      ["Anrufe", calls.toString()],
      ["E-Mails", emails.toString()],
      ["Meetings", meetings.toString()],
      ["Aufgaben", tasks.toString()],
      ["Gesamt", (calls + emails + meetings + tasks).toString()],
    ],
    startY: 115,
    theme: "striped",
    headStyles: { fillColor: [139, 92, 246] },
    styles: { fontSize: 10 },
    columnStyles: { 1: { halign: "right" } },
    margin: { left: 14, right: 140 },
  });

  // Footer
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.setTextColor(128);
  doc.text("Generiert von LeadTool CRM", 14, pageHeight - 10);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
