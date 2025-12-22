import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import dns from "dns";
import { promisify } from "util";

const resolveTxt = promisify(dns.resolveTxt);

interface DnsCheckResult {
  spf: { valid: boolean; record: string | null; error: string | null };
  dkim: { valid: boolean; record: string | null; error: string | null; selector: string };
  dmarc: { valid: boolean; record: string | null; error: string | null };
}

// POST /api/email/accounts/[accountId]/verify-dns - Check SPF, DKIM, DMARC
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { accountId } = await params;

    // Get account
    const account = await prisma.emailAccount.findFirst({
      where: { id: accountId, userId: session.user.id },
    });

    if (!account) {
      return NextResponse.json({ error: "Konto nicht gefunden" }, { status: 404 });
    }

    // Extract domain from email
    const domain = account.email.split("@")[1];
    if (!domain) {
      return NextResponse.json({ error: "Ungültige E-Mail-Domain" }, { status: 400 });
    }

    // Check DNS records
    const result = await checkDnsRecords(domain);

    // Calculate health score based on DNS
    const dnsScore = calculateDnsScore(result);

    // Update account
    await prisma.emailAccount.update({
      where: { id: account.id },
      data: {
        spfValid: result.spf.valid,
        dkimValid: result.dkim.valid,
        dmarcValid: result.dmarc.valid,
        dnsCheckedAt: new Date(),
        dnsError: result.spf.error || result.dkim.error || result.dmarc.error || null,
        // Update health score (weighted average with existing score)
        healthScore: Math.round((account.healthScore * 0.5) + (dnsScore * 0.5)),
        lastHealthCheckAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      domain,
      results: result,
      score: dnsScore,
      recommendations: getRecommendations(result),
    });
  } catch (error) {
    console.error("DNS check error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "DNS-Prüfung fehlgeschlagen" },
      { status: 500 }
    );
  }
}

async function checkDnsRecords(domain: string): Promise<DnsCheckResult> {
  const result: DnsCheckResult = {
    spf: { valid: false, record: null, error: null },
    dkim: { valid: false, record: null, error: null, selector: "default" },
    dmarc: { valid: false, record: null, error: null },
  };

  // Check SPF
  try {
    const spfRecords = await resolveTxt(domain);
    const spfRecord = spfRecords.flat().find((r) => r.startsWith("v=spf1"));
    if (spfRecord) {
      result.spf.valid = true;
      result.spf.record = spfRecord;
    } else {
      result.spf.error = "Kein SPF-Record gefunden";
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOTFOUND" ||
        (error as NodeJS.ErrnoException).code === "ENODATA") {
      result.spf.error = "Kein SPF-Record gefunden";
    } else {
      result.spf.error = `DNS-Fehler: ${(error as Error).message}`;
    }
  }

  // Check DKIM (common selectors)
  const dkimSelectors = ["default", "selector1", "selector2", "google", "k1", "dkim", "mail"];
  for (const selector of dkimSelectors) {
    try {
      const dkimDomain = `${selector}._domainkey.${domain}`;
      const dkimRecords = await resolveTxt(dkimDomain);
      const dkimRecord = dkimRecords.flat().find((r) => r.includes("v=DKIM1") || r.includes("k=rsa"));
      if (dkimRecord) {
        result.dkim.valid = true;
        result.dkim.record = dkimRecord.substring(0, 100) + (dkimRecord.length > 100 ? "..." : "");
        result.dkim.selector = selector;
        break;
      }
    } catch {
      // Try next selector
    }
  }
  if (!result.dkim.valid) {
    result.dkim.error = "Kein DKIM-Record gefunden (getestete Selektoren: " + dkimSelectors.join(", ") + ")";
  }

  // Check DMARC
  try {
    const dmarcRecords = await resolveTxt(`_dmarc.${domain}`);
    const dmarcRecord = dmarcRecords.flat().find((r) => r.startsWith("v=DMARC1"));
    if (dmarcRecord) {
      result.dmarc.valid = true;
      result.dmarc.record = dmarcRecord;
    } else {
      result.dmarc.error = "Kein DMARC-Record gefunden";
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOTFOUND" ||
        (error as NodeJS.ErrnoException).code === "ENODATA") {
      result.dmarc.error = "Kein DMARC-Record gefunden";
    } else {
      result.dmarc.error = `DNS-Fehler: ${(error as Error).message}`;
    }
  }

  return result;
}

function calculateDnsScore(result: DnsCheckResult): number {
  let score = 0;

  // SPF: 40 points
  if (result.spf.valid) {
    score += 40;
    // Bonus for strict SPF
    if (result.spf.record?.includes("-all")) {
      score += 5;
    } else if (result.spf.record?.includes("~all")) {
      score += 2;
    }
  }

  // DKIM: 35 points
  if (result.dkim.valid) {
    score += 35;
  }

  // DMARC: 25 points
  if (result.dmarc.valid) {
    score += 20;
    // Bonus for strict DMARC
    if (result.dmarc.record?.includes("p=reject")) {
      score += 5;
    } else if (result.dmarc.record?.includes("p=quarantine")) {
      score += 3;
    }
  }

  return Math.min(100, score);
}

function getRecommendations(result: DnsCheckResult): string[] {
  const recommendations: string[] = [];

  if (!result.spf.valid) {
    recommendations.push(
      "SPF-Record fehlt! Füge einen TXT-Record hinzu: v=spf1 include:_spf.google.com ~all (Beispiel für Gmail)"
    );
  } else if (result.spf.record?.includes("?all")) {
    recommendations.push(
      "SPF-Policy ist zu locker (?all). Verwende ~all oder -all für bessere Sicherheit."
    );
  }

  if (!result.dkim.valid) {
    recommendations.push(
      "DKIM fehlt! Konfiguriere DKIM bei deinem E-Mail-Provider und füge den DNS-Record hinzu."
    );
  }

  if (!result.dmarc.valid) {
    recommendations.push(
      "DMARC fehlt! Füge einen TXT-Record bei _dmarc.domain.de hinzu: v=DMARC1; p=none; rua=mailto:dmarc@domain.de"
    );
  } else if (result.dmarc.record?.includes("p=none")) {
    recommendations.push(
      "DMARC-Policy ist auf 'none' gesetzt. Für besseren Schutz auf 'quarantine' oder 'reject' ändern."
    );
  }

  if (recommendations.length === 0) {
    recommendations.push("Alle DNS-Records sind korrekt konfiguriert!");
  }

  return recommendations;
}
