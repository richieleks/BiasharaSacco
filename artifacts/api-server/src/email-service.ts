// Email sending via Resend, using the Replit Resend connector (integration: resend).
// Credentials are handled automatically by the Replit Connectors SDK — no API keys in code.
import { ReplitConnectors } from '@replit/connectors-sdk';
import { logger } from './lib/logger';

const RESEND_CONNECTOR = 'resend';
// Resend's shared sender works without a verified domain (useful before a custom
// domain is verified). Once a domain is verified in Resend, set emailFromAddress
// in Admin Settings to an address on that domain.
const DEFAULT_FROM_ADDRESS = 'onboarding@resend.dev';

interface EmailConfig {
  emailFromAddress: string;
  emailFromName?: string;
  emailEnabled: boolean;
  // Retained for backward compatibility with stored settings; not used by Resend.
  smtpServer?: string;
  smtpPort?: number;
}

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

let cachedConnectors: ReplitConnectors | null = null;

function getConnectors(): ReplitConnectors {
  if (!cachedConnectors) {
    cachedConnectors = new ReplitConnectors();
  }
  return cachedConnectors;
}

export async function sendEmail(config: EmailConfig, options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!config.emailEnabled) {
    return { success: false, error: 'Email system is disabled' };
  }

  const fromAddress = config.emailFromAddress || DEFAULT_FROM_ADDRESS;
  const fromName = config.emailFromName || 'Biashara SACCO';

  try {
    const response = await getConnectors().proxy(RESEND_CONNECTOR, '/emails', {
      method: 'POST',
      body: {
        from: `${fromName} <${fromAddress}>`,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text || options.html.replace(/<[^>]*>/g, ''),
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.error({ status: response.status, body: errText }, 'Resend send error');
      return { success: false, error: `Resend API error (${response.status}): ${errText}` };
    }

    const data = await response.json() as { id?: string };
    return { success: true, messageId: data.id };
  } catch (error: any) {
    logger.error({ err: error }, 'Resend send exception');
    return { success: false, error: error?.message || 'Failed to send email' };
  }
}

export async function verifyConnection(_config: EmailConfig): Promise<{ success: boolean; error?: string }> {
  try {
    const connections = await getConnectors().listConnections({ connector_names: RESEND_CONNECTOR });
    const active = connections.find(c => c.connector_name === RESEND_CONNECTOR);
    if (!active) {
      return { success: false, error: 'Resend is not connected. Connect the Resend integration in the Replit Integrations panel.' };
    }
    if (active.status && active.status.toLowerCase() !== 'active' && active.status.toLowerCase() !== 'connected') {
      return { success: false, error: `Resend connection status: ${active.status}` };
    }
    return { success: true };
  } catch (error: any) {
    logger.error({ err: error }, 'Resend verify exception');
    return { success: false, error: error?.message || 'Resend connection failed' };
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
    emailFromAddress: settingsMap['emailFromAddress'] || DEFAULT_FROM_ADDRESS,
    emailFromName: settingsMap['emailFromName'] || 'Biashara SACCO',
  };
}
