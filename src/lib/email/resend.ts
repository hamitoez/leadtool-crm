import { Resend } from "resend";

// Lazy-initialize Resend client to avoid build-time errors
let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not configured. Please set it in your environment variables.");
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

const FROM_EMAIL = process.env.EMAIL_FROM || "Performanty <noreply@performanty.de>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmailOptions) {
  try {
    const resend = getResendClient();
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
      text,
    });

    if (error) {
      console.error("Failed to send email:", error);
      throw new Error(`Failed to send email: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error("Email sending error:", error);
    throw error;
  }
}

export async function sendVerificationEmail(email: string, token: string, name?: string) {
  const verificationUrl = `${APP_URL}/api/auth/verify-email?token=${token}`;
  const displayName = name || email.split("@")[0];

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>E-Mail-Adresse bestätigen</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Performanty</h1>
  </div>

  <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #1f2937; margin-top: 0;">Hallo ${displayName}!</h2>

    <p style="color: #4b5563;">Vielen Dank für deine Registrierung bei Performanty. Bitte bestätige deine E-Mail-Adresse, indem du auf den Button unten klickst.</p>

    <div style="text-align: center; margin: 40px 0;">
      <a href="${verificationUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">E-Mail bestätigen</a>
    </div>

    <p style="color: #6b7280; font-size: 14px;">Oder kopiere diesen Link in deinen Browser:</p>
    <p style="background: #f3f4f6; padding: 12px; border-radius: 6px; word-break: break-all; font-size: 13px; color: #4b5563;">${verificationUrl}</p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

    <p style="color: #9ca3af; font-size: 13px; margin-bottom: 0;">
      Dieser Link ist 24 Stunden gültig. Falls du dich nicht bei Performanty registriert hast, kannst du diese E-Mail ignorieren.
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>&copy; ${new Date().getFullYear()} Performanty. Alle Rechte vorbehalten.</p>
  </div>
</body>
</html>
  `;

  const text = `
Hallo ${displayName}!

Vielen Dank für deine Registrierung bei Performanty. Bitte bestätige deine E-Mail-Adresse, indem du diesen Link öffnest:

${verificationUrl}

Dieser Link ist 24 Stunden gültig. Falls du dich nicht bei Performanty registriert hast, kannst du diese E-Mail ignorieren.

© ${new Date().getFullYear()} Performanty
  `;

  return sendEmail({
    to: email,
    subject: "Bestätige deine E-Mail-Adresse - Performanty",
    html,
    text,
  });
}

export async function sendPasswordResetEmail(email: string, token: string, name?: string) {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;
  const displayName = name || email.split("@")[0];

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Passwort zurücksetzen</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Performanty</h1>
  </div>

  <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #1f2937; margin-top: 0;">Passwort zurücksetzen</h2>

    <p style="color: #4b5563;">Hallo ${displayName},</p>

    <p style="color: #4b5563;">Du hast eine Anfrage zum Zurücksetzen deines Passworts gestellt. Klicke auf den Button unten, um ein neues Passwort zu wählen.</p>

    <div style="text-align: center; margin: 40px 0;">
      <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Passwort zurücksetzen</a>
    </div>

    <p style="color: #6b7280; font-size: 14px;">Oder kopiere diesen Link in deinen Browser:</p>
    <p style="background: #f3f4f6; padding: 12px; border-radius: 6px; word-break: break-all; font-size: 13px; color: #4b5563;">${resetUrl}</p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

    <p style="color: #9ca3af; font-size: 13px;">
      <strong>Wichtig:</strong> Dieser Link ist nur 1 Stunde gültig und kann nur einmal verwendet werden.
    </p>
    <p style="color: #9ca3af; font-size: 13px; margin-bottom: 0;">
      Falls du keine Passwort-Zurücksetzung angefordert hast, kannst du diese E-Mail ignorieren. Dein Passwort bleibt unverändert.
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>&copy; ${new Date().getFullYear()} Performanty. Alle Rechte vorbehalten.</p>
  </div>
</body>
</html>
  `;

  const text = `
Passwort zurücksetzen

Hallo ${displayName},

Du hast eine Anfrage zum Zurücksetzen deines Passworts gestellt. Öffne diesen Link, um ein neues Passwort zu wählen:

${resetUrl}

Wichtig: Dieser Link ist nur 1 Stunde gültig und kann nur einmal verwendet werden.

Falls du keine Passwort-Zurücksetzung angefordert hast, kannst du diese E-Mail ignorieren. Dein Passwort bleibt unverändert.

© ${new Date().getFullYear()} Performanty
  `;

  return sendEmail({
    to: email,
    subject: "Passwort zurücksetzen - Performanty",
    html,
    text,
  });
}

export async function sendWelcomeEmail(email: string, name?: string) {
  const displayName = name || email.split("@")[0];
  const loginUrl = `${APP_URL}/login`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Willkommen bei Performanty</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Performanty</h1>
  </div>

  <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #1f2937; margin-top: 0;">Willkommen bei Performanty!</h2>

    <p style="color: #4b5563;">Hallo ${displayName},</p>

    <p style="color: #4b5563;">Deine E-Mail-Adresse wurde erfolgreich bestätigt. Du kannst dich jetzt anmelden und mit der Lead-Generierung starten!</p>

    <div style="text-align: center; margin: 40px 0;">
      <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Jetzt anmelden</a>
    </div>

    <h3 style="color: #1f2937;">Was dich erwartet:</h3>
    <ul style="color: #4b5563; padding-left: 20px;">
      <li>Automatische Kontaktdaten-Extraktion aus Websites</li>
      <li>KI-gestützte Lead-Personalisierung</li>
      <li>Flexible Import & Export Funktionen</li>
      <li>Übersichtliches Lead-Management</li>
    </ul>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

    <p style="color: #9ca3af; font-size: 13px; margin-bottom: 0;">
      Bei Fragen oder Feedback kannst du uns jederzeit kontaktieren.
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>&copy; ${new Date().getFullYear()} Performanty. Alle Rechte vorbehalten.</p>
  </div>
</body>
</html>
  `;

  const text = `
Willkommen bei Performanty!

Hallo ${displayName},

Deine E-Mail-Adresse wurde erfolgreich bestätigt. Du kannst dich jetzt anmelden und mit der Lead-Generierung starten!

Anmelden: ${loginUrl}

Was dich erwartet:
- Automatische Kontaktdaten-Extraktion aus Websites
- KI-gestützte Lead-Personalisierung
- Flexible Import & Export Funktionen
- Übersichtliches Lead-Management

Bei Fragen oder Feedback kannst du uns jederzeit kontaktieren.

© ${new Date().getFullYear()} Performanty
  `;

  return sendEmail({
    to: email,
    subject: "Willkommen bei Performanty!",
    html,
    text,
  });
}
