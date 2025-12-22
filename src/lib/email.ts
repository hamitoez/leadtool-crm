import nodemailer from "nodemailer";
import prisma from "@/lib/prisma";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  organizationId?: string;
}

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  fromName: string;
}

// Get SMTP config from organization or environment
async function getSmtpConfig(organizationId?: string): Promise<SmtpConfig | null> {
  // First try organization settings
  if (organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        smtpHost: true,
        smtpPort: true,
        smtpSecure: true,
        smtpUser: true,
        smtpPassword: true,
        smtpFrom: true,
        smtpFromName: true,
        name: true,
      },
    });

    if (org?.smtpHost && org?.smtpUser && org?.smtpPassword) {
      return {
        host: org.smtpHost,
        port: org.smtpPort || 587,
        secure: org.smtpSecure,
        user: org.smtpUser,
        pass: org.smtpPassword,
        from: org.smtpFrom || org.smtpUser,
        fromName: org.smtpFromName || org.name,
      };
    }
  }

  // Fallback to environment variables
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!host || !user || !pass) {
    return null;
  }

  return {
    host,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_PORT === "465",
    user,
    pass,
    from: process.env.SMTP_FROM || user,
    fromName: process.env.SMTP_FROM_NAME || "LeadTool",
  };
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const config = await getSmtpConfig(options.organizationId);

  if (!config) {
    console.warn("SMTP not configured. Email not sent:", options.subject);
    return false;
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
  });

  try {
    await transporter.sendMail({
      from: `"${config.fromName}" <${config.from}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ""),
    });
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
}

// Email templates
const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "https://performanty.de";

export async function sendInviteEmail(
  email: string,
  token: string,
  organizationId: string,
  organizationName: string,
  inviterName: string | null,
  role: string,
  message?: string
): Promise<boolean> {
  const inviteUrl = `${baseUrl}/invite/${token}`;

  const roleLabels: Record<string, string> = {
    OWNER: "Eigentümer",
    ADMIN: "Administrator",
    MANAGER: "Manager",
    MEMBER: "Mitglied",
  };

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Team-Einladung</h1>
  </div>

  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">
      ${inviterName ? `<strong>${inviterName}</strong> hat dich eingeladen,` : "Du wurdest eingeladen,"}
      dem Team <strong>${organizationName}</strong> beizutreten.
    </p>

    <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 20px;">
      <p style="margin: 0 0 10px 0;"><strong>Organisation:</strong> ${organizationName}</p>
      <p style="margin: 0;"><strong>Deine Rolle:</strong> ${roleLabels[role] || role}</p>
    </div>

    ${message ? `
    <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; border-left: 4px solid #667eea; margin-bottom: 20px;">
      <p style="margin: 0; font-style: italic; color: #555;">"${message}"</p>
    </div>
    ` : ""}

    <div style="text-align: center; margin: 30px 0;">
      <a href="${inviteUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
        Einladung annehmen
      </a>
    </div>

    <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
      Diese Einladung ist 7 Tage gültig. Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:
    </p>
    <p style="font-size: 12px; color: #9ca3af; word-break: break-all;">
      ${inviteUrl}
    </p>
  </div>

  <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
    <p>Diese E-Mail wurde automatisch von LeadTool gesendet.</p>
  </div>
</body>
</html>
  `;

  const text = `
Team-Einladung

${inviterName ? `${inviterName} hat dich eingeladen,` : "Du wurdest eingeladen,"} dem Team ${organizationName} beizutreten.

Organisation: ${organizationName}
Deine Rolle: ${roleLabels[role] || role}

${message ? `Nachricht: "${message}"` : ""}

Klicke auf den folgenden Link, um die Einladung anzunehmen:
${inviteUrl}

Diese Einladung ist 7 Tage gültig.

---
Diese E-Mail wurde automatisch von LeadTool gesendet.
  `;

  return sendEmail({
    to: email,
    subject: `Einladung zu ${organizationName} - LeadTool`,
    html,
    text,
    organizationId,
  });
}
