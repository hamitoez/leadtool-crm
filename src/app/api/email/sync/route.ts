import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import Imap from "imap-simple";
import { simpleParser, ParsedMail } from "mailparser";

// POST /api/email/sync - Sync emails from IMAP
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { accountId, folder = "INBOX", limit = 50 } = body;

    // Get email account
    let account;
    if (accountId) {
      account = await prisma.emailAccount.findFirst({
        where: { id: accountId, userId: session.user.id, isActive: true },
      });
    } else {
      account = await prisma.emailAccount.findFirst({
        where: { userId: session.user.id, isDefault: true, isActive: true },
      });
    }

    if (!account) {
      return NextResponse.json(
        { error: "Kein E-Mail-Konto gefunden." },
        { status: 400 }
      );
    }

    // Verify IMAP settings
    if (!account.imapHost || !account.imapUser || !account.imapPassword) {
      return NextResponse.json(
        { error: "IMAP-Einstellungen unvollstaendig. Bitte ueberpruefen Sie die Konto-Einstellungen." },
        { status: 400 }
      );
    }

    // Create sync log
    const syncLog = await prisma.emailSyncLog.create({
      data: {
        emailAccountId: account.id,
        status: "running",
      },
    });

    try {
      // IMAP configuration
      const config = {
        imap: {
          user: account.imapUser,
          password: account.imapPassword,
          host: account.imapHost,
          port: account.imapPort || 993,
          tls: account.imapSecure,
          tlsOptions: { rejectUnauthorized: false },
          authTimeout: 10000,
        },
      };

      // Connect to IMAP
      const connection = await Imap.connect(config);
      await connection.openBox(folder);

      // Search for emails from the last 7 days (not just unseen)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const searchCriteria = [["SINCE", sevenDaysAgo]];
      const fetchOptions = {
        bodies: ["HEADER", "TEXT", ""],
        markSeen: false,
        struct: true,
      };

      const messages = await connection.search(searchCriteria, fetchOptions);
      const limitedMessages = messages.slice(0, limit);

      let newCount = 0;
      const processedEmails = [];

      for (const message of limitedMessages) {
        try {
          // Get the full email
          const all = message.parts.find((p: { which: string }) => p.which === "");
          if (!all) continue;

          const parsed: ParsedMail = await simpleParser(all.body);

          // Check if email already exists by messageId
          const existingEmail = await prisma.emailMessage.findFirst({
            where: { messageId: parsed.messageId || undefined },
          });

          if (existingEmail) continue;

          // Extract from/to addresses
          const fromAddr = parsed.from?.value?.[0];
          const fromEmail = fromAddr?.address || "";
          const fromName = fromAddr?.name || "";

          // Handle to field which can be array or single object
          const toAddresses = Array.isArray(parsed.to)
            ? parsed.to[0]?.value
            : parsed.to?.value;
          const toAddr = toAddresses?.[0];
          const toEmail = toAddr?.address || account.email;
          const toName = toAddr?.name || "";

          // Try to find matching contact by email
          const matchingRow = await prisma.row.findFirst({
            where: {
              cells: {
                some: {
                  column: { type: "EMAIL" },
                  value: { equals: fromEmail },
                },
              },
            },
          });

          // Create email message
          const emailMessage = await prisma.emailMessage.create({
            data: {
              emailAccountId: account.id,
              rowId: matchingRow?.id,
              messageId: parsed.messageId || undefined,
              inReplyTo: parsed.inReplyTo || undefined,
              threadId: parsed.references?.[0] || parsed.inReplyTo || undefined,
              direction: "INBOUND",
              status: "DELIVERED",
              fromEmail,
              fromName,
              toEmail,
              toName,
              subject: parsed.subject || "(Kein Betreff)",
              bodyHtml: parsed.html || undefined,
              bodyText: parsed.text || undefined,
              headers: parsed.headers ? JSON.parse(JSON.stringify(Object.fromEntries(parsed.headers))) : {},
              sentAt: parsed.date || new Date(),
            },
          });

          // Reply Detection: Check if this email is a reply to one of our sent emails
          if (parsed.inReplyTo) {
            const originalEmail = await prisma.emailMessage.findFirst({
              where: {
                messageId: parsed.inReplyTo,
                direction: "OUTBOUND",
                emailAccountId: account.id,
              },
            });

            if (originalEmail && !originalEmail.isReplied) {
              await prisma.emailMessage.update({
                where: { id: originalEmail.id },
                data: {
                  isReplied: true,
                  repliedAt: parsed.date || new Date(),
                },
              });
            }
          }

          // Also check references for threaded replies
          if (parsed.references && parsed.references.length > 0) {
            for (const ref of parsed.references) {
              const originalEmail = await prisma.emailMessage.findFirst({
                where: {
                  messageId: ref,
                  direction: "OUTBOUND",
                  emailAccountId: account.id,
                  isReplied: false,
                },
              });

              if (originalEmail) {
                await prisma.emailMessage.update({
                  where: { id: originalEmail.id },
                  data: {
                    isReplied: true,
                    repliedAt: parsed.date || new Date(),
                  },
                });
                break; // Only mark first matching original email
              }
            }
          }

          // Create activity and history if contact found
          if (matchingRow) {
            await prisma.activity.create({
              data: {
                rowId: matchingRow.id,
                userId: session.user.id,
                type: "EMAIL",
                status: "COMPLETED",
                title: `E-Mail empfangen: ${parsed.subject || "(Kein Betreff)"}`,
                description: parsed.text?.substring(0, 500),
                emailSubject: parsed.subject,
                emailTo: toEmail,
                isAutomatic: true,
              },
            });

            await prisma.contactHistory.create({
              data: {
                rowId: matchingRow.id,
                userId: session.user.id,
                eventType: "EMAIL_RECEIVED",
                title: `E-Mail empfangen: ${parsed.subject || "(Kein Betreff)"}`,
                description: `Von: ${fromEmail}`,
                metadata: {
                  emailId: emailMessage.id,
                  subject: parsed.subject,
                  from: fromEmail,
                },
              },
            });
          }

          newCount++;
          processedEmails.push({
            id: emailMessage.id,
            from: fromEmail,
            subject: parsed.subject,
            date: parsed.date,
          });
        } catch (parseError) {
          console.error("Error parsing email:", parseError);
        }
      }

      // Close connection
      connection.end();

      // Update account last sync
      await prisma.emailAccount.update({
        where: { id: account.id },
        data: { lastSyncAt: new Date() },
      });

      // Update sync log
      await prisma.emailSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: "completed",
          messagesFound: limitedMessages.length,
          messagesNew: newCount,
          completedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        messagesFound: limitedMessages.length,
        messagesNew: newCount,
        emails: processedEmails,
      });
    } catch (imapError) {
      console.error("IMAP error:", imapError);

      const errorMessage = imapError instanceof Error ? imapError.message : "Unbekannter Fehler";

      // Determine user-friendly error message
      let userMessage = "Fehler bei der IMAP-Verbindung";
      if (errorMessage.includes("Authentication failed")) {
        userMessage = "Authentifizierung fehlgeschlagen. Bitte ueberpruefen Sie Benutzername und Passwort. Bei Gmail: App-Passwort verwenden!";
      } else if (errorMessage.includes("ENOTFOUND") || errorMessage.includes("getaddrinfo")) {
        userMessage = "IMAP-Server nicht gefunden. Bitte ueberpruefen Sie den Hostnamen.";
      } else if (errorMessage.includes("ETIMEDOUT") || errorMessage.includes("timeout")) {
        userMessage = "Verbindung zum IMAP-Server abgelaufen. Bitte ueberpruefen Sie Host und Port.";
      } else if (errorMessage.includes("ECONNREFUSED")) {
        userMessage = "Verbindung abgelehnt. Bitte ueberpruefen Sie Port und SSL-Einstellungen.";
      }

      // Update sync log with error
      await prisma.emailSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: "failed",
          error: errorMessage,
          completedAt: new Date(),
        },
      });

      return NextResponse.json(
        { error: userMessage, details: errorMessage },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in email sync:", error);
    return NextResponse.json({ error: "Fehler beim Verarbeiten der Anfrage" }, { status: 500 });
  }
}

// GET /api/email/sync - Get sync status
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");

    // Get user's email accounts
    const accounts = await prisma.emailAccount.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        lastSyncAt: true,
        syncEnabled: true,
      },
    });

    // Get recent sync logs
    const syncLogs = await prisma.emailSyncLog.findMany({
      where: accountId ? { emailAccountId: accountId } : {
        emailAccountId: { in: accounts.map(a => a.id) }
      },
      orderBy: { startedAt: "desc" },
      take: 10,
    });

    return NextResponse.json({
      accounts,
      syncLogs,
    });
  } catch (error) {
    console.error("Error getting sync status:", error);
    return NextResponse.json({ error: "Fehler beim Abrufen des Sync-Status" }, { status: 500 });
  }
}
