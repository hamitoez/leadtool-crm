import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import nodemailer from "nodemailer";

// POST /api/email/accounts/[accountId]/test - Test SMTP/IMAP connection
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
    const body = await request.json().catch(() => ({}));
    const testType = body.type || "smtp"; // "smtp" or "imap"

    // Get account with passwords
    const account = await prisma.emailAccount.findFirst({
      where: { id: accountId, userId: session.user.id },
    });

    if (!account) {
      return NextResponse.json({ error: "Konto nicht gefunden" }, { status: 404 });
    }

    if (testType === "smtp") {
      return await testSmtp(account);
    } else if (testType === "imap") {
      return await testImap(account);
    } else {
      return NextResponse.json({ error: "Ungültiger Testtyp" }, { status: 400 });
    }
  } catch (error) {
    console.error("Connection test error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Verbindungstest fehlgeschlagen"
      },
      { status: 500 }
    );
  }
}

async function testSmtp(account: {
  id: string;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUser: string | null;
  smtpPassword: string | null;
  email: string;
}): Promise<NextResponse> {
  if (!account.smtpHost || !account.smtpUser || !account.smtpPassword) {
    return NextResponse.json(
      { success: false, error: "SMTP-Einstellungen unvollständig" },
      { status: 400 }
    );
  }

  try {
    const transporter = nodemailer.createTransport({
      host: account.smtpHost,
      port: account.smtpPort || 587,
      secure: account.smtpSecure && account.smtpPort === 465, // true for 465, false for other ports
      auth: {
        user: account.smtpUser,
        pass: account.smtpPassword,
      },
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });

    // Verify connection
    await transporter.verify();

    // Update account with verified status
    await prisma.emailAccount.update({
      where: { id: account.id },
      data: {
        smtpVerified: true,
        lastVerifiedAt: new Date(),
        verificationError: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "SMTP-Verbindung erfolgreich",
      details: {
        host: account.smtpHost,
        port: account.smtpPort || 587,
        secure: account.smtpSecure,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unbekannter Fehler";

    // Update account with error
    await prisma.emailAccount.update({
      where: { id: account.id },
      data: {
        smtpVerified: false,
        verificationError: errorMessage,
      },
    });

    // Provide helpful error messages
    let userMessage = errorMessage;
    if (errorMessage.includes("ECONNREFUSED")) {
      userMessage = "Verbindung abgelehnt. Bitte Host und Port prüfen.";
    } else if (errorMessage.includes("ETIMEDOUT")) {
      userMessage = "Verbindungs-Timeout. Server nicht erreichbar.";
    } else if (errorMessage.includes("ENOTFOUND")) {
      userMessage = "Server nicht gefunden. Bitte Hostname prüfen.";
    } else if (errorMessage.includes("authentication") || errorMessage.includes("AUTH")) {
      userMessage = "Authentifizierung fehlgeschlagen. Bitte Zugangsdaten prüfen.";
    } else if (errorMessage.includes("certificate")) {
      userMessage = "SSL/TLS-Zertifikatfehler. Versuchen Sie TLS zu deaktivieren.";
    }

    return NextResponse.json(
      { success: false, error: userMessage, details: errorMessage },
      { status: 400 }
    );
  }
}

async function testImap(account: {
  id: string;
  imapHost: string | null;
  imapPort: number | null;
  imapSecure: boolean;
  imapUser: string | null;
  imapPassword: string | null;
}): Promise<NextResponse> {
  if (!account.imapHost || !account.imapUser || !account.imapPassword) {
    return NextResponse.json(
      { success: false, error: "IMAP-Einstellungen unvollständig" },
      { status: 400 }
    );
  }

  try {
    // Dynamic import to avoid issues
    const imapSimple = await import("imap-simple");

    const config = {
      imap: {
        user: account.imapUser,
        password: account.imapPassword,
        host: account.imapHost,
        port: account.imapPort || 993,
        tls: account.imapSecure,
        authTimeout: 10000,
        connTimeout: 10000,
        tlsOptions: { rejectUnauthorized: false },
      },
    };

    const connection = await imapSimple.connect(config);

    // Get mailbox list to verify access
    const boxes = await connection.getBoxes();
    const mailboxCount = Object.keys(boxes).length;

    await connection.end();

    // Update account with verified status
    await prisma.emailAccount.update({
      where: { id: account.id },
      data: {
        imapVerified: true,
        lastVerifiedAt: new Date(),
        verificationError: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "IMAP-Verbindung erfolgreich",
      details: {
        host: account.imapHost,
        port: account.imapPort || 993,
        mailboxes: mailboxCount,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unbekannter Fehler";

    // Update account with error
    await prisma.emailAccount.update({
      where: { id: account.id },
      data: {
        imapVerified: false,
        verificationError: errorMessage,
      },
    });

    // Provide helpful error messages
    let userMessage = errorMessage;
    if (errorMessage.includes("ECONNREFUSED")) {
      userMessage = "Verbindung abgelehnt. Bitte Host und Port prüfen.";
    } else if (errorMessage.includes("ETIMEDOUT") || errorMessage.includes("Timed out")) {
      userMessage = "Verbindungs-Timeout. Server nicht erreichbar.";
    } else if (errorMessage.includes("ENOTFOUND")) {
      userMessage = "Server nicht gefunden. Bitte Hostname prüfen.";
    } else if (errorMessage.includes("auth") || errorMessage.includes("AUTH") || errorMessage.includes("credentials")) {
      userMessage = "Authentifizierung fehlgeschlagen. Bei Gmail: App-Passwort verwenden!";
    } else if (errorMessage.includes("certificate")) {
      userMessage = "SSL/TLS-Zertifikatfehler.";
    }

    return NextResponse.json(
      { success: false, error: userMessage, details: errorMessage },
      { status: 400 }
    );
  }
}
