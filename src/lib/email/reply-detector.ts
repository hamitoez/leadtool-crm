/**
 * Reply and Bounce Detection
 *
 * Analyzes incoming emails to detect:
 * 1. Replies to campaign emails (via In-Reply-To / References headers)
 * 2. Bounces (delivery failures, mailer-daemon messages)
 */

export interface EmailAnalysisInput {
  messageId: string;
  inReplyTo: string;
  references: string;
  from: string;
  fromName: string;
  subject: string;
  body: string;
  date: Date;
}

export interface EmailAnalysisResult {
  isReply: boolean;
  isBounce: boolean;
  isAutoReply: boolean;
  originalMessageId?: string;
  bouncedRecipient?: string;
  bounceReason?: string;
  bounceType?: "hard" | "soft" | "unknown";
}

// Patterns to detect bounce emails
const BOUNCE_FROM_PATTERNS = [
  /mailer-daemon/i,
  /postmaster/i,
  /mail-delivery/i,
  /mailerdaemon/i,
  /noreply.*bounce/i,
  /bounce.*noreply/i,
  /failed.*delivery/i,
  /delivery.*failed/i,
];

const BOUNCE_SUBJECT_PATTERNS = [
  /undelivered/i,
  /undeliverable/i,
  /delivery.*failed/i,
  /delivery.*status/i,
  /mail.*delivery.*failed/i,
  /returned.*mail/i,
  /failure.*notice/i,
  /delivery.*notification/i,
  /nicht.*zustellbar/i, // German
  /zustellung.*fehlgeschlagen/i, // German
  /nicht.*erreichbar/i, // German
];

// Patterns to detect auto-replies (out of office, etc.)
const AUTO_REPLY_PATTERNS = [
  /out.*of.*office/i,
  /automatic.*reply/i,
  /auto.*reply/i,
  /automatische.*antwort/i, // German
  /abwesenheit/i, // German
  /ich.*bin.*nicht.*im.*büro/i, // German
  /vacation.*reply/i,
  /away.*from.*office/i,
];

// Hard bounce indicators (permanent failures)
const HARD_BOUNCE_PATTERNS = [
  /user.*unknown/i,
  /user.*not.*found/i,
  /mailbox.*not.*found/i,
  /address.*rejected/i,
  /recipient.*rejected/i,
  /invalid.*recipient/i,
  /no.*such.*user/i,
  /does.*not.*exist/i,
  /mailbox.*unavailable/i,
  /account.*disabled/i,
  /550/i, // SMTP permanent failure code
  /551/i,
  /552/i,
  /553/i,
  /554/i,
];

// Soft bounce indicators (temporary failures)
const SOFT_BOUNCE_PATTERNS = [
  /mailbox.*full/i,
  /over.*quota/i,
  /temporarily.*unavailable/i,
  /try.*again.*later/i,
  /connection.*timed.*out/i,
  /too.*many.*connections/i,
  /rate.*limit/i,
  /421/i, // SMTP temporary failure codes
  /450/i,
  /451/i,
  /452/i,
];

/**
 * Analyze an email to detect if it's a reply or bounce
 */
export async function detectReplyOrBounce(
  email: EmailAnalysisInput
): Promise<EmailAnalysisResult> {
  const result: EmailAnalysisResult = {
    isReply: false,
    isBounce: false,
    isAutoReply: false,
  };

  // Check for bounces first (they have higher priority)
  if (isBounceEmail(email)) {
    result.isBounce = true;
    result.bounceType = detectBounceType(email.body);
    result.bouncedRecipient = extractBouncedRecipient(email.body);
    result.bounceReason = extractBounceReason(email.body, email.subject);
    return result;
  }

  // Check for auto-replies
  if (isAutoReply(email)) {
    result.isAutoReply = true;
    // Auto-replies can also be considered replies for campaign purposes
    result.isReply = true;
    result.originalMessageId = extractOriginalMessageId(email);
    return result;
  }

  // Check for normal replies
  if (isReplyEmail(email)) {
    result.isReply = true;
    result.originalMessageId = extractOriginalMessageId(email);
    return result;
  }

  return result;
}

/**
 * Check if email is a bounce
 */
function isBounceEmail(email: EmailAnalysisInput): boolean {
  const fromLower = email.from.toLowerCase();
  const fromNameLower = email.fromName.toLowerCase();
  const subjectLower = email.subject.toLowerCase();

  // Check from address patterns
  for (const pattern of BOUNCE_FROM_PATTERNS) {
    if (pattern.test(fromLower) || pattern.test(fromNameLower)) {
      return true;
    }
  }

  // Check subject patterns
  for (const pattern of BOUNCE_SUBJECT_PATTERNS) {
    if (pattern.test(subjectLower)) {
      return true;
    }
  }

  // Check for delivery status notification content type
  if (email.body.includes("Content-Type: multipart/report")) {
    if (email.body.includes("report-type=delivery-status")) {
      return true;
    }
  }

  return false;
}

/**
 * Check if email is an auto-reply
 */
function isAutoReply(email: EmailAnalysisInput): boolean {
  const subjectLower = email.subject.toLowerCase();
  const bodyLower = email.body.toLowerCase().substring(0, 2000); // Check first 2000 chars

  for (const pattern of AUTO_REPLY_PATTERNS) {
    if (pattern.test(subjectLower) || pattern.test(bodyLower)) {
      return true;
    }
  }

  // Check for auto-submitted header
  if (email.body.includes("Auto-Submitted:")) {
    return true;
  }

  // Check for X-Auto-Response-Suppress header
  if (email.body.includes("X-Auto-Response-Suppress:")) {
    return true;
  }

  return false;
}

/**
 * Check if email is a reply based on headers
 */
function isReplyEmail(email: EmailAnalysisInput): boolean {
  // Has In-Reply-To header
  if (email.inReplyTo && email.inReplyTo.trim().length > 0) {
    return true;
  }

  // Has References header
  if (email.references && email.references.trim().length > 0) {
    return true;
  }

  // Subject starts with Re: or similar
  const subjectLower = email.subject.toLowerCase().trim();
  if (
    subjectLower.startsWith("re:") ||
    subjectLower.startsWith("aw:") || // German
    subjectLower.startsWith("antw:") || // German
    subjectLower.startsWith("antwort:")
  ) {
    return true;
  }

  return false;
}

/**
 * Extract the original message ID from reply headers
 */
function extractOriginalMessageId(email: EmailAnalysisInput): string | undefined {
  // In-Reply-To is the most reliable
  if (email.inReplyTo) {
    return email.inReplyTo.replace(/[<>]/g, "").trim();
  }

  // References contains a list of message IDs, the last one is often the direct parent
  if (email.references) {
    const refs = email.references.split(/\s+/).filter(Boolean);
    if (refs.length > 0) {
      // Return the last reference (most recent parent)
      return refs[refs.length - 1].replace(/[<>]/g, "").trim();
    }
  }

  return undefined;
}

/**
 * Detect if bounce is hard (permanent) or soft (temporary)
 */
function detectBounceType(body: string): "hard" | "soft" | "unknown" {
  const bodyLower = body.toLowerCase();

  for (const pattern of HARD_BOUNCE_PATTERNS) {
    if (pattern.test(bodyLower)) {
      return "hard";
    }
  }

  for (const pattern of SOFT_BOUNCE_PATTERNS) {
    if (pattern.test(bodyLower)) {
      return "soft";
    }
  }

  return "unknown";
}

/**
 * Extract the bounced recipient email from bounce message
 */
function extractBouncedRecipient(body: string): string | undefined {
  // Look for email address patterns in the body
  // Common patterns in bounce messages
  const patterns = [
    /Final-Recipient:.*?;\s*<?([^\s<>]+@[^\s<>]+)>?/i,
    /Original-Recipient:.*?;\s*<?([^\s<>]+@[^\s<>]+)>?/i,
    /To:\s*<?([^\s<>]+@[^\s<>]+)>?/im,
    /failed.*?<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/i,
    /recipient.*?<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/i,
    /<([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>/,
  ];

  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match && match[1]) {
      const email = match[1].toLowerCase().trim();
      // Validate it looks like an email
      if (email.includes("@") && email.includes(".")) {
        // Exclude common system addresses
        if (
          !email.includes("mailer-daemon") &&
          !email.includes("postmaster") &&
          !email.includes("noreply")
        ) {
          return email;
        }
      }
    }
  }

  return undefined;
}

/**
 * Extract a human-readable bounce reason
 */
function extractBounceReason(body: string, subject: string): string {
  // Common bounce reason patterns
  const reasonPatterns = [
    { pattern: /user.*unknown/i, reason: "User unknown" },
    { pattern: /mailbox.*not.*found/i, reason: "Mailbox not found" },
    { pattern: /address.*rejected/i, reason: "Address rejected" },
    { pattern: /mailbox.*full/i, reason: "Mailbox full" },
    { pattern: /over.*quota/i, reason: "Over quota" },
    { pattern: /spam.*detected/i, reason: "Spam detected" },
    { pattern: /blocked/i, reason: "Blocked by recipient" },
    { pattern: /no.*such.*user/i, reason: "No such user" },
    { pattern: /invalid.*address/i, reason: "Invalid address" },
    { pattern: /does.*not.*exist/i, reason: "Address does not exist" },
    { pattern: /connection.*refused/i, reason: "Connection refused" },
    { pattern: /timeout/i, reason: "Connection timeout" },
  ];

  const textToCheck = (subject + " " + body.substring(0, 3000)).toLowerCase();

  for (const { pattern, reason } of reasonPatterns) {
    if (pattern.test(textToCheck)) {
      return reason;
    }
  }

  // Try to extract SMTP error code
  const smtpMatch = textToCheck.match(/\b(4\d{2}|5\d{2})\s+[\d.]+\s+(.{10,100})/);
  if (smtpMatch) {
    return `SMTP ${smtpMatch[1]}: ${smtpMatch[2].substring(0, 50)}`;
  }

  return "Delivery failed";
}
