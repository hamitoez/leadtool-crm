// Lead Scoring Engine
// Calculates a score (0-100) based on data quality and signals

interface RowWithCells {
  id: string;
  cells: Array<{
    value: unknown;
    column: {
      type: string;
      name: string;
    };
  }>;
}

interface ScoringResult {
  totalScore: number;
  components: {
    dataCompleteness: number;
    contactability: number;
    businessSignals: number;
  };
  details: {
    hasEmail: boolean;
    hasPhone: boolean;
    hasWebsite: boolean;
    hasCompanyName: boolean;
    hasAddress: boolean;
    filledFields: number;
    totalFields: number;
  };
  recommendation: "hot" | "warm" | "cold" | "unqualified";
}

/**
 * Calculate lead score based on available data
 */
export function calculateLeadScore(row: RowWithCells): ScoringResult {
  const cells = row.cells || [];

  // Extract data presence
  const hasEmail = cells.some(
    (c) => c.column.type === "EMAIL" && c.value && String(c.value).includes("@")
  );
  const hasPhone = cells.some(
    (c) => c.column.type === "PHONE" && c.value && String(c.value).length > 5
  );
  const hasWebsite = cells.some(
    (c) => c.column.type === "URL" && c.value && String(c.value).startsWith("http")
  );
  const hasCompanyName = cells.some(
    (c) =>
      (c.column.name.toLowerCase().includes("firma") ||
        c.column.name.toLowerCase().includes("company") ||
        c.column.name.toLowerCase().includes("unternehmen")) &&
      c.value &&
      String(c.value).length > 2
  );
  const hasAddress = cells.some(
    (c) =>
      (c.column.name.toLowerCase().includes("adresse") ||
        c.column.name.toLowerCase().includes("address") ||
        c.column.name.toLowerCase().includes("plz") ||
        c.column.name.toLowerCase().includes("stadt") ||
        c.column.name.toLowerCase().includes("city")) &&
      c.value
  );

  // Count filled fields
  const filledFields = cells.filter(
    (c) => c.value !== null && c.value !== "" && c.value !== undefined
  ).length;
  const totalFields = cells.length;

  // Calculate component scores (0-100 each)

  // 1. Data Completeness (40% weight)
  const completenessRatio = totalFields > 0 ? filledFields / totalFields : 0;
  const dataCompleteness = Math.round(completenessRatio * 100);

  // 2. Contactability (35% weight)
  let contactabilityScore = 0;
  if (hasEmail) contactabilityScore += 50;
  if (hasPhone) contactabilityScore += 35;
  if (hasWebsite) contactabilityScore += 15;
  const contactability = Math.min(contactabilityScore, 100);

  // 3. Business Signals (25% weight)
  let businessScore = 0;
  if (hasCompanyName) businessScore += 40;
  if (hasAddress) businessScore += 30;
  if (hasWebsite) businessScore += 30;
  const businessSignals = Math.min(businessScore, 100);

  // Calculate weighted total
  const totalScore = Math.round(
    dataCompleteness * 0.4 + contactability * 0.35 + businessSignals * 0.25
  );

  // Determine recommendation
  let recommendation: ScoringResult["recommendation"];
  if (totalScore >= 70) {
    recommendation = "hot";
  } else if (totalScore >= 50) {
    recommendation = "warm";
  } else if (totalScore >= 30) {
    recommendation = "cold";
  } else {
    recommendation = "unqualified";
  }

  return {
    totalScore,
    components: {
      dataCompleteness,
      contactability,
      businessSignals,
    },
    details: {
      hasEmail,
      hasPhone,
      hasWebsite,
      hasCompanyName,
      hasAddress,
      filledFields,
      totalFields,
    },
    recommendation,
  };
}

/**
 * Get score color for UI
 */
export function getScoreColor(score: number): string {
  if (score >= 70) return "text-green-600 bg-green-100";
  if (score >= 50) return "text-yellow-600 bg-yellow-100";
  if (score >= 30) return "text-orange-600 bg-orange-100";
  return "text-red-600 bg-red-100";
}

/**
 * Get recommendation label in German
 */
export function getRecommendationLabel(
  recommendation: ScoringResult["recommendation"]
): string {
  switch (recommendation) {
    case "hot":
      return "Heiss";
    case "warm":
      return "Warm";
    case "cold":
      return "Kalt";
    case "unqualified":
      return "Unqualifiziert";
  }
}

/**
 * Calculate priority based on score and activity
 */
export function calculatePriority(
  score: number,
  lastActivityDate?: Date | null,
  daysInStage?: number
): "high" | "medium" | "low" {
  // High priority: Good score + no recent activity
  const daysSinceActivity = lastActivityDate
    ? Math.floor((Date.now() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  if (score >= 70 && daysSinceActivity > 3) return "high";
  if (score >= 50 && daysSinceActivity > 5) return "high";
  if (score >= 50) return "medium";
  if (daysInStage && daysInStage > 14) return "medium";
  return "low";
}

/**
 * Suggest next action based on deal state
 */
export function suggestNextAction(
  score: number,
  hasEmail: boolean,
  hasPhone: boolean,
  daysSinceLastContact: number
): { action: string; reason: string; urgency: "high" | "medium" | "low" } {
  // No contact in a while + high score = urgent follow-up
  if (score >= 70 && daysSinceLastContact > 5) {
    return {
      action: hasPhone ? "Anrufen" : "E-Mail senden",
      reason: `Heisser Lead seit ${daysSinceLastContact} Tagen ohne Kontakt`,
      urgency: "high",
    };
  }

  // Medium score, needs nurturing
  if (score >= 50 && daysSinceLastContact > 7) {
    return {
      action: "Follow-up E-Mail",
      reason: "Lead reaktivieren",
      urgency: "medium",
    };
  }

  // Low score, needs qualification
  if (score < 50 && !hasEmail && !hasPhone) {
    return {
      action: "Daten ergaenzen",
      reason: "Kontaktdaten fehlen",
      urgency: "medium",
    };
  }

  // Default
  return {
    action: "Weiter beobachten",
    reason: "Kein dringender Handlungsbedarf",
    urgency: "low",
  };
}
