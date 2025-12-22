import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import nodemailer from "nodemailer";

const sendEmailSchema = z.object({
  accountId: z.string().optional(), // Use default if not provided
  rowId: z.string().optional(), // Link to contact
  templateId: z.string().optional(),

  to: z.string().email(),
  toName: z.string().optional(),
  cc: z.string().optional(),
  bcc: z.string().optional(),
  replyTo: z.string().email().optional(),

  subject: z.string().min(1).max(500),
  bodyHtml: z.string().min(1),
  bodyText: z.string().optional(),

  // Template variables
  variables: z.record(z.string(), z.string()).optional(),

  // Scheduling
  scheduledAt: z.string().datetime().optional(),
});

// Helper to replace template variables
function replaceVariables(text: string, variables: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => variables[key] || match);
}

// POST /api/email/send - Send an email
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = sendEmailSchema.parse(body);

    // Get email account
    let account;
    if (data.accountId) {
      account = await prisma.emailAccount.findFirst({
        where: { id: data.accountId, userId: session.user.id, isActive: true },
      });
    } else {
      account = await prisma.emailAccount.findFirst({
        where: { userId: session.user.id, isDefault: true, isActive: true },
      });
    }

    if (!account) {
      return NextResponse.json(
        { error: "Kein E-Mail-Konto gefunden. Bitte richten Sie ein E-Mail-Konto in den Einstellungen ein." },
        { status: 400 }
      );
    }

    // Verify SMTP settings
    if (!account.smtpHost || !account.smtpUser || !account.smtpPassword) {
      return NextResponse.json(
        { error: "SMTP-Einstellungen unvollstaendig. Bitte ueberpruefen Sie die Konto-Einstellungen." },
        { status: 400 }
      );
    }

    // Get template if provided
    let template = null;
    if (data.templateId) {
      template = await prisma.emailTemplate.findFirst({
        where: { id: data.templateId, userId: session.user.id },
      });
    }

    // Prepare email content
    let subject = data.subject;
    let bodyHtml = data.bodyHtml;
    let bodyText = data.bodyText;

    // Apply variables
    if (data.variables) {
      subject = replaceVariables(subject, data.variables);
      bodyHtml = replaceVariables(bodyHtml, data.variables);
      if (bodyText) bodyText = replaceVariables(bodyText, data.variables);
    }

    // Add signature if exists
    if (account.signature) {
      bodyHtml += `<br><br>${account.signature}`;
      if (bodyText) bodyText += `\n\n${account.signature.replace(/<[^>]*>/g, "")}`;
    }

    // Create email message record with tracking ID
    const emailMessage = await prisma.emailMessage.create({
      data: {
        emailAccountId: account.id,
        rowId: data.rowId,
        templateId: data.templateId,
        direction: "OUTBOUND",
        status: data.scheduledAt ? "QUEUED" : "SENDING",
        fromEmail: account.email,
        fromName: session.user.name || undefined,
        toEmail: data.to,
        toName: data.toName,
        ccEmail: data.cc,
        bccEmail: data.bcc,
        replyTo: data.replyTo,
        subject,
        bodyHtml,
        bodyText: bodyText || bodyHtml.replace(/<[^>]*>/g, ""),
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      },
    });

    // Add tracking pixel to HTML body
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "https://performanty.de";
    const trackingPixel = `<img src="${baseUrl}/api/email/track/${emailMessage.trackingId}" width="1" height="1" style="display:none;visibility:hidden;" alt="" />`;
    const bodyHtmlWithTracking = bodyHtml + trackingPixel;

    // If scheduled, just return the message
    if (data.scheduledAt) {
      return NextResponse.json({
        success: true,
        message: "E-Mail geplant",
        emailId: emailMessage.id,
        scheduledAt: data.scheduledAt,
      });
    }

    // Create SMTP transporter
    const transporter = nodemailer.createTransport({
      host: account.smtpHost,
      port: account.smtpPort || 587,
      secure: account.smtpSecure,
      auth: {
        user: account.smtpUser,
        pass: account.smtpPassword,
      },
    });

    // Send email
    try {
      const info = await transporter.sendMail({
        from: `"${session.user.name || account.name}" <${account.email}>`,
        to: data.toName ? `"${data.toName}" <${data.to}>` : data.to,
        cc: data.cc,
        bcc: data.bcc,
        replyTo: data.replyTo,
        subject,
        text: bodyText || bodyHtml.replace(/<[^>]*>/g, ""),
        html: bodyHtmlWithTracking, // Use HTML with tracking pixel
      });

      // Update message as sent
      await prisma.emailMessage.update({
        where: { id: emailMessage.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          messageId: info.messageId,
        },
      });

      // Update template usage
      if (template) {
        await prisma.emailTemplate.update({
          where: { id: template.id },
          data: {
            usageCount: { increment: 1 },
            lastUsedAt: new Date(),
          },
        });
      }

      // Create activity record
      if (data.rowId) {
        await prisma.activity.create({
          data: {
            rowId: data.rowId,
            userId: session.user.id,
            type: "EMAIL",
            status: "COMPLETED",
            title: `E-Mail gesendet: ${subject}`,
            description: bodyText?.substring(0, 500),
            emailSubject: subject,
            emailTo: data.to,
            emailCc: data.cc,
          },
        });

        // Create history entry
        await prisma.contactHistory.create({
          data: {
            rowId: data.rowId,
            userId: session.user.id,
            eventType: "EMAIL_SENT",
            title: `E-Mail gesendet: ${subject}`,
            description: `An: ${data.to}`,
            metadata: {
              emailId: emailMessage.id,
              subject,
              to: data.to,
            },
          },
        });
      }

      return NextResponse.json({
        success: true,
        message: "E-Mail gesendet",
        emailId: emailMessage.id,
        messageId: info.messageId,
      });
    } catch (sendError) {
      console.error("Error sending email:", sendError);

      // Update message as failed
      await prisma.emailMessage.update({
        where: { id: emailMessage.id },
        data: {
          status: "FAILED",
          errorMessage: sendError instanceof Error ? sendError.message : "Unbekannter Fehler",
        },
      });

      return NextResponse.json(
        { error: "Fehler beim Senden der E-Mail", details: sendError instanceof Error ? sendError.message : undefined },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in email send:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungueltige Eingabe", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Fehler beim Verarbeiten der Anfrage" }, { status: 500 });
  }
}
