/**
 * Configuration and Environment Variables
 * Strict validation and fallback handling for Vercel Serverless environment.
 */

export interface AppConfig {
  databaseUrl: string;
  telegramBotToken: string;
  telegramAdminIds: string[];
  telegramWebhookSecret: string;
  cronSecret: string;
  websiteUrl: string;
  gscSiteUrl: string;
  googleClientEmail?: string;
  googlePrivateKey?: string;
  googleCredentialsJson?: string;
  environment: string;
}

function parseAdminIds(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0);
}

function cleanPrivateKey(raw?: string): string | undefined {
  if (!raw) return undefined;
  // Handle escaped newlines from environment variable strings
  return raw.replace(/\\n/g, '\n');
}

export const config: AppConfig = {
  databaseUrl: process.env.DATABASE_URL || '',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramAdminIds: parseAdminIds(process.env.TELEGRAM_ADMIN_IDS),
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || '',
  cronSecret: process.env.CRON_SECRET || '',
  websiteUrl: (process.env.WEBSITE_URL || 'https://robinsonj.vercel.app').replace(/\/+$/, ''),
  gscSiteUrl: process.env.GSC_SITE_URL || 'https://robinsonj.vercel.app/',
  googleClientEmail: process.env.GOOGLE_CLIENT_EMAIL,
  googlePrivateKey: cleanPrivateKey(process.env.GOOGLE_PRIVATE_KEY),
  googleCredentialsJson: process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
  environment: process.env.NODE_ENV || 'production',
};

/**
 * Checks if a given Telegram user ID is authorized as an administrator.
 */
export function isTelegramAdmin(userId: number | string): boolean {
  if (!config.telegramAdminIds || config.telegramAdminIds.length === 0) {
    // If no admin IDs are configured yet, inform or allow bootstrap
    return false;
  }
  const idStr = String(userId).trim();
  return config.telegramAdminIds.includes(idStr);
}

/**
 * Sanitizes an object or string for logging to avoid exposing secrets.
 */
export function sanitizeLog(data: unknown): string {
  try {
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    return str
      .replace(/bot[0-9]+:[a-zA-Z0-9_-]+/gi, 'bot[REDACTED]')
      .replace(/postgres(?:ql)?:\/\/[^:]+:[^@]+@/gi, 'postgres://user:REDACTED@')
      .replace(/-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/g, '[REDACTED_PRIVATE_KEY]');
  } catch {
    return '[Unserializable data]';
  }
}
