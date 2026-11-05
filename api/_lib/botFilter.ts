/**
 * Bot, Crawler, and Ingestion Validation
 * Protects analytics from search engine spiders, uptime bots, and invalid payloads.
 */

const BOT_PATTERNS = [
  /bot/i,
  /crawler/i,
  /spider/i,
  /crawling/i,
  /facebookexternalhit/i,
  /whatsapp/i,
  /slackbot/i,
  /telegrambot/i,
  /twitterbot/i,
  /pinterest/i,
  /googlebot/i,
  /bingbot/i,
  /yandex/i,
  /duckduckbot/i,
  /baiduspider/i,
  /semrush/i,
  /ahrefs/i,
  /lighthouse/i,
  /headlesschrome/i,
  /phantomjs/i,
  /wget/i,
  /curl/i,
  /python-requests/i,
  /postmanruntime/i,
  /uptimerobot/i,
  /pingdom/i,
  /site24x7/i,
  /vercel-screenshot/i,
];

export function isBotOrCrawler(userAgent?: string): boolean {
  if (!userAgent || typeof userAgent !== 'string') return true;
  if (userAgent.trim().length === 0) return true;

  for (const pattern of BOT_PATTERNS) {
    if (pattern.test(userAgent)) {
      return true;
    }
  }

  return false;
}

export interface IngestionPayload {
  sessionId: string;
  visitorId: string;
  eventType?: string;
  eventName?: string;
  url: string;
  path: string;
  title?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  deviceCategory?: 'desktop' | 'mobile' | 'tablet';
  browser?: string;
  os?: string;
  screenWidth?: number;
  screenHeight?: number;
  metadata?: Record<string, any>;
  durationSeconds?: number;
  isNewSession?: boolean;
}

/**
 * Validates and sanitizes incoming tracking payloads
 */
export function validateTrackingPayload(body: any): { valid: boolean; payload?: IngestionPayload; error?: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Payload must be a JSON object' };
  }

  const sessionId = String(body.sessionId || '').trim();
  const visitorId = String(body.visitorId || '').trim();
  const url = String(body.url || '').trim();
  const path = String(body.path || '').trim();

  if (!sessionId || sessionId.length < 8 || sessionId.length > 64) {
    return { valid: false, error: 'Invalid or missing sessionId' };
  }

  if (!visitorId || visitorId.length < 8 || visitorId.length > 64) {
    return { valid: false, error: 'Invalid or missing visitorId' };
  }

  if (!url || !path) {
    return { valid: false, error: 'Invalid or missing url or path' };
  }

  // Device category normalization
  let deviceCategory: 'desktop' | 'mobile' | 'tablet' = 'desktop';
  if (body.deviceCategory === 'mobile' || body.deviceCategory === 'tablet') {
    deviceCategory = body.deviceCategory;
  }

  const payload: IngestionPayload = {
    sessionId: sessionId.slice(0, 64),
    visitorId: visitorId.slice(0, 64),
    eventType: (body.eventType || 'pageview').slice(0, 64),
    eventName: (body.eventName || 'pageview').slice(0, 128),
    url: url.slice(0, 2048),
    path: path.slice(0, 1024),
    title: body.title ? String(body.title).slice(0, 512) : undefined,
    referrer: body.referrer ? String(body.referrer).slice(0, 2048) : undefined,
    utmSource: body.utmSource ? String(body.utmSource).slice(0, 255) : undefined,
    utmMedium: body.utmMedium ? String(body.utmMedium).slice(0, 255) : undefined,
    utmCampaign: body.utmCampaign ? String(body.utmCampaign).slice(0, 255) : undefined,
    deviceCategory,
    browser: body.browser ? String(body.browser).slice(0, 64) : 'Unknown',
    os: body.os ? String(body.os).slice(0, 64) : 'Unknown',
    screenWidth: typeof body.screenWidth === 'number' ? Math.floor(body.screenWidth) : undefined,
    screenHeight: typeof body.screenHeight === 'number' ? Math.floor(body.screenHeight) : undefined,
    metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
    durationSeconds: typeof body.durationSeconds === 'number' ? Math.max(0, Math.floor(body.durationSeconds)) : 0,
    isNewSession: Boolean(body.isNewSession),
  };

  return { valid: true, payload };
}

/**
 * Extracts a safe referrer domain without credentials or query params
 */
export function extractReferrerDomain(referrer?: string): string | null {
  if (!referrer) return null;
  try {
    const parsed = new URL(referrer);
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

