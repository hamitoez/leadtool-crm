import { prisma } from "@/lib/prisma";
import { NotificationType, Prisma } from "@prisma/client";
import { sendEmail } from "@/lib/email/resend";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

interface NotificationData {
  projectId?: string;
  projectName?: string;
  tableId?: string;
  tableName?: string;
  count?: number;
  error?: string;
  link?: string;
  [key: string]: unknown;
}

interface CreateNotificationOptions {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: NotificationData;
  sendEmail?: boolean;
}

// Check if user wants to receive this notification type
async function shouldNotify(userId: string, type: NotificationType): Promise<{ inApp: boolean; email: boolean }> {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: {
      notifyScrapingComplete: true,
      notifyScrapingFailed: true,
      notifyImportComplete: true,
      notifyImportFailed: true,
      emailNotifications: true,
    },
  });

  // Default to true for in-app, false for email
  if (!settings) {
    return { inApp: true, email: false };
  }

  let inApp = true;
  switch (type) {
    case "SCRAPE_COMPLETED":
      inApp = settings.notifyScrapingComplete;
      break;
    case "SCRAPE_FAILED":
      inApp = settings.notifyScrapingFailed;
      break;
    case "IMPORT_COMPLETED":
      inApp = settings.notifyImportComplete;
      break;
    case "IMPORT_FAILED":
      inApp = settings.notifyImportFailed;
      break;
    case "SYSTEM":
      inApp = true; // System notifications always shown
      break;
  }

  return {
    inApp,
    email: inApp && settings.emailNotifications,
  };
}

// Create a notification
export async function createNotification({
  userId,
  type,
  title,
  message,
  data = {},
  sendEmail: shouldSendEmail = true,
}: CreateNotificationOptions) {
  const shouldNotifyResult = await shouldNotify(userId, type);

  // Don't create notification if user disabled it
  if (!shouldNotifyResult.inApp) {
    return null;
  }

  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      data: data as Prisma.InputJsonValue,
    },
  });

  // Send email if enabled
  if (shouldSendEmail && shouldNotifyResult.email) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (user?.email) {
      try {
        await sendNotificationEmail(user.email, user.name || undefined, type, title, message, data);
      } catch (error) {
        console.error("Failed to send notification email:", error);
      }
    }
  }

  return notification;
}

// Helper functions for specific notification types
export async function notifyScrapingComplete(
  userId: string,
  tableName: string,
  count: number,
  tableId?: string,
  projectId?: string
) {
  return createNotification({
    userId,
    type: "SCRAPE_COMPLETED",
    title: "Scraping abgeschlossen",
    message: `${count} Kontaktdaten wurden erfolgreich aus "${tableName}" extrahiert.`,
    data: {
      tableId,
      projectId,
      tableName,
      count,
      link: tableId && projectId ? `/projects/${projectId}/tables/${tableId}` : undefined,
    },
  });
}

export async function notifyScrapingFailed(
  userId: string,
  tableName: string,
  error: string,
  tableId?: string,
  projectId?: string
) {
  return createNotification({
    userId,
    type: "SCRAPE_FAILED",
    title: "Scraping fehlgeschlagen",
    message: `Fehler beim Scraping von "${tableName}": ${error}`,
    data: {
      tableId,
      projectId,
      tableName,
      error,
      link: tableId && projectId ? `/projects/${projectId}/tables/${tableId}` : undefined,
    },
  });
}

export async function notifyImportComplete(
  userId: string,
  tableName: string,
  count: number,
  tableId?: string,
  projectId?: string
) {
  return createNotification({
    userId,
    type: "IMPORT_COMPLETED",
    title: "Import abgeschlossen",
    message: `${count} Leads wurden erfolgreich in "${tableName}" importiert.`,
    data: {
      tableId,
      projectId,
      tableName,
      count,
      link: tableId && projectId ? `/projects/${projectId}/tables/${tableId}` : undefined,
    },
  });
}

export async function notifyImportFailed(
  userId: string,
  tableName: string,
  error: string,
  tableId?: string,
  projectId?: string
) {
  return createNotification({
    userId,
    type: "IMPORT_FAILED",
    title: "Import fehlgeschlagen",
    message: `Fehler beim Import in "${tableName}": ${error}`,
    data: {
      tableId,
      projectId,
      tableName,
      error,
    },
  });
}

export async function notifySystem(userId: string, title: string, message: string, data?: NotificationData) {
  return createNotification({
    userId,
    type: "SYSTEM",
    title,
    message,
    data,
  });
}

// Email template for notifications
async function sendNotificationEmail(
  email: string,
  name: string | undefined,
  type: NotificationType,
  title: string,
  message: string,
  data: NotificationData
) {
  const displayName = name || email.split("@")[0];
  const link = data.link ? `${APP_URL}${data.link}` : `${APP_URL}/dashboard`;

  // Determine icon and color based on type
  let iconColor = "#667eea";
  let statusText = "Benachrichtigung";

  switch (type) {
    case "SCRAPE_COMPLETED":
    case "IMPORT_COMPLETED":
      iconColor = "#10b981";
      statusText = "Erfolgreich";
      break;
    case "SCRAPE_FAILED":
    case "IMPORT_FAILED":
      iconColor = "#ef4444";
      statusText = "Fehler";
      break;
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Performanty</h1>
  </div>

  <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <div style="display: flex; align-items: center; margin-bottom: 20px;">
      <span style="display: inline-block; width: 12px; height: 12px; background-color: ${iconColor}; border-radius: 50%; margin-right: 10px;"></span>
      <span style="color: ${iconColor}; font-weight: 600;">${statusText}</span>
    </div>

    <h2 style="color: #1f2937; margin-top: 0;">${title}</h2>

    <p style="color: #4b5563;">Hallo ${displayName},</p>

    <p style="color: #4b5563;">${message}</p>

    <div style="text-align: center; margin: 40px 0;">
      <a href="${link}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Zum Dashboard</a>
    </div>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

    <p style="color: #9ca3af; font-size: 13px; margin-bottom: 0;">
      Du erhältst diese E-Mail, weil du E-Mail-Benachrichtigungen aktiviert hast. Du kannst diese in deinen <a href="${APP_URL}/settings" style="color: #667eea;">Einstellungen</a> deaktivieren.
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>&copy; ${new Date().getFullYear()} Performanty. Alle Rechte vorbehalten.</p>
  </div>
</body>
</html>
  `;

  const text = `
${title}

Hallo ${displayName},

${message}

Zum Dashboard: ${link}

---
Du erhältst diese E-Mail, weil du E-Mail-Benachrichtigungen aktiviert hast.
Du kannst diese in deinen Einstellungen deaktivieren: ${APP_URL}/settings

© ${new Date().getFullYear()} Performanty
  `;

  return sendEmail({
    to: email,
    subject: `${title} - Performanty`,
    html,
    text,
  });
}
