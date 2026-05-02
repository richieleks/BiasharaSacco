import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

interface EmailConfig {
  smtpServer: string;
  smtpPort: number;
  emailFromAddress: string;
  emailFromName?: string;
  emailEnabled: boolean;
}

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

let cachedTransporter: Transporter | null = null;
let cachedConfigKey = '';

function getConfigKey(config: EmailConfig): string {
  return `${config.smtpServer}:${config.smtpPort}:${config.emailFromAddress}`;
}

function createTransporter(config: EmailConfig): Transporter {
  const username = process.env.SES_SMTP_USERNAME;
  const password = process.env.SES_SMTP_PASSWORD;

  if (!username || !password) {
    throw new Error('SES SMTP credentials not configured. Set SES_SMTP_USERNAME and SES_SMTP_PASSWORD environment variables.');
  }

  return nodemailer.createTransport({
    host: config.smtpServer,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: {
      user: username,
      pass: password,
    },
  });
}

function getTransporter(config: EmailConfig): Transporter {
  const key = getConfigKey(config);
  if (cachedTransporter && cachedConfigKey === key) {
    return cachedTransporter;
  }
  cachedTransporter = createTransporter(config);
  cachedConfigKey = key;
  return cachedTransporter;
}

export async function sendEmail(config: EmailConfig, options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!config.emailEnabled) {
    return { success: false, error: 'Email system is disabled' };
  }

  if (!config.smtpServer || !config.emailFromAddress) {
    return { success: false, error: 'Email configuration incomplete. Set SMTP server and From address in Admin Settings.' };
  }

  try {
    const transporter = getTransporter(config);
    const fromName = config.emailFromName || 'Biashara SACCO';
    const result = await transporter.sendMail({
      from: `"${fromName}" <${config.emailFromAddress}>`,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''),
    });

    return { success: true, messageId: result.messageId };
  } catch (error: any) {
    console.error('Email send error:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

export async function verifyConnection(config: EmailConfig): Promise<{ success: boolean; error?: string }> {
  if (!config.smtpServer || !config.emailFromAddress) {
    return { success: false, error: 'Email configuration incomplete' };
  }

  try {
    const transporter = getTransporter(config);
    await transporter.verify();
    return { success: true };
  } catch (error: any) {
    cachedTransporter = null;
    cachedConfigKey = '';
    console.error('SMTP verification error:', error);
    return { success: false, error: error.message || 'SMTP connection failed' };
  }
}

export function buildEmailTemplate(title: string, bodyContent: string, footerText?: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f7fa;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <tr>
            <td style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Biashara SACCO</h1>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:12px;text-transform:uppercase;letter-spacing:1px;">Management System</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;">
              <h2 style="margin:0 0 20px;color:#1e293b;font-size:18px;font-weight:600;">${title}</h2>
              ${bodyContent}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px;background-color:#f8fafc;border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
                ${footerText || 'This is an automated message from Biashara SACCO Management System. Please do not reply to this email.'}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function getEmailConfig(storage: any): Promise<EmailConfig> {
  const settings = await storage.getAllSystemSettings();
  const settingsMap: Record<string, string> = {};
  for (const s of settings) {
    settingsMap[s.settingKey] = s.settingValue;
  }

  return {
    emailEnabled: settingsMap['emailEnabled'] !== 'false',
    smtpServer: settingsMap['smtpServer'] || 'email-smtp.us-east-1.amazonaws.com',
    smtpPort: parseInt(settingsMap['smtpPort'] || '587', 10),
    emailFromAddress: settingsMap['emailFromAddress'] || '',
    emailFromName: settingsMap['emailFromName'] || 'Biashara SACCO',
  };
}
