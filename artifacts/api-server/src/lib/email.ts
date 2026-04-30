import nodemailer from "nodemailer";
import { db, systemSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const CACHE_TTL = 60_000;
let smtpCache: { data: Record<string, string>; ts: number } | null = null;

async function getSmtpSettings(): Promise<Record<string, string>> {
  if (smtpCache && Date.now() - smtpCache.ts < CACHE_TTL) {
    return smtpCache.data;
  }
  const rows = await db.select().from(systemSettingsTable);
  const data: Record<string, string> = {};
  for (const row of rows) data[row.key] = row.value ?? "";
  smtpCache = { data, ts: Date.now() };
  return data;
}

function createTransporterFromSettings(s: Record<string, string>) {
  const host = s["smtp_host"] || process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(s["smtp_port"] || process.env.SMTP_PORT || "587", 10);
  const user = s["smtp_user"] || process.env.SMTP_USER || "";
  const pass = s["smtp_password"] || process.env.SMTP_PASS || "";

  return {
    transporter: nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    }),
    fromEmail: s["smtp_from_email"] || process.env.FROM_EMAIL || "noreply@mediaflow.com",
    fromName: s["smtp_from_name"] || process.env.FROM_NAME || "MediaFlow",
    frontendUrl: s["frontend_url"] || process.env.FRONTEND_URL || "http://localhost",
  };
}

function invalidateSmtpCache() {
  smtpCache = null;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function sendPasswordResetEmail(
  toEmail: string,
  userName: string,
  resetToken: string,
): Promise<void> {
  const settings = await getSmtpSettings();
  const { transporter, fromEmail, fromName, frontendUrl } = createTransporterFromSettings(settings);
  const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
  .content { padding: 30px; background: #f9fafb; }
  .button { display: inline-block; padding: 14px 28px; background: #6366f1; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
  .footer { text-align: center; padding: 20px; color: #666; font-size: 13px; border-top: 1px solid #e5e7eb; }
  .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 15px 0; border-radius: 4px; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1 style="margin:0;font-size:28px;">MediaFlow</h1>
    <p style="margin:10px 0 0 0;opacity:0.9;">Password Reset Request</p>
  </div>
  <div class="content">
    <h2 style="color:#1f2937;margin-top:0;">Hello ${escapeHtml(userName)},</h2>
    <p>We received a request to reset your password. Click the button below to create a new password:</p>
    <div style="text-align:center;margin:30px 0;">
      <a href="${resetUrl}" class="button">Reset Password</a>
    </div>
    <p style="color:#6b7280;font-size:14px;">Or copy and paste this link into your browser:</p>
    <p style="word-break:break-all;color:#6366f1;background:white;padding:10px;border-radius:4px;font-size:13px;">${resetUrl}</p>
    <div class="warning">
      <strong>Warning:</strong> This link will expire in 1 hour.
    </div>
    <p style="margin-top:20px;color:#6b7280;font-size:14px;">If you didn't request a password reset, you can safely ignore this email.</p>
  </div>
  <div class="footer">
    <p>&copy; ${new Date().getFullYear()} MediaFlow. All rights reserved.</p>
    <p style="color:#9ca3af;">This is an automated email. Please do not reply.</p>
  </div>
</div>
</body>
</html>`;

  const textContent = `MediaFlow - Password Reset\n\nHello ${userName},\n\nReset your password: ${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, ignore this email.`;

  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: toEmail,
    subject: "Reset Your MediaFlow Password",
    text: textContent,
    html: htmlContent,
  });
}

export async function sendPasswordResetConfirmation(
  toEmail: string,
  userName: string,
): Promise<void> {
  const settings = await getSmtpSettings();
  const { transporter, fromEmail, fromName } = createTransporterFromSettings(settings);

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
  .content { padding: 30px; background: #f0fdf4; }
  .footer { text-align: center; padding: 20px; color: #666; font-size: 13px; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div style="font-size:48px;margin-bottom:10px;">&#10003;</div>
    <h1 style="margin:0;">Password Changed</h1>
  </div>
  <div class="content">
    <p>Hello ${escapeHtml(userName)},</p>
    <p>Your MediaFlow password has been successfully changed.</p>
    <p>If you didn't make this change, please contact our support team immediately.</p>
  </div>
  <div class="footer">
    <p>&copy; ${new Date().getFullYear()} MediaFlow. All rights reserved.</p>
  </div>
</div>
</body>
</html>`;

  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: toEmail,
    subject: "Your MediaFlow Password Was Changed",
    html: htmlContent,
  });
}

export async function sendTestEmail(
  toEmail: string,
  userName: string,
): Promise<void> {
  const settings = await getSmtpSettings();
  const { transporter, fromEmail, fromName } = createTransporterFromSettings(settings);

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 30px; text-align: center; border-radius: 8px; }
  .content { padding: 30px; background: #f9fafb; }
  .footer { text-align: center; padding: 20px; color: #666; font-size: 13px; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1 style="margin:0;">MediaFlow</h1>
    <p style="margin:10px 0 0 0;opacity:0.9;">Test Email</p>
  </div>
  <div class="content">
    <p>Hello ${escapeHtml(userName)},</p>
    <p>This is a test email from your MediaFlow admin panel. If you received this, your SMTP settings are configured correctly.</p>
    <p style="color:#6b7280;font-size:13px;margin-top:20px;">Sent at: ${new Date().toISOString()}</p>
  </div>
  <div class="footer">
    <p>&copy; ${new Date().getFullYear()} MediaFlow. All rights reserved.</p>
  </div>
</div>
</body>
</html>`;

  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: toEmail,
    subject: "MediaFlow Test Email",
    html: htmlContent,
  });
}
