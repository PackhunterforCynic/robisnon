// server/_lib/db.ts
import { Pool } from "pg";

// server/_lib/config.ts
function parseAdminIds(raw) {
  if (!raw) return [];
  return raw.split(",").map((id) => id.trim()).filter((id) => id.length > 0);
}
function cleanPrivateKey(raw) {
  if (!raw) return void 0;
  return raw.replace(/\\n/g, "\n");
}
var appConfig = {
  databaseUrl: process.env.DATABASE_URL || "",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
  telegramAdminIds: parseAdminIds(process.env.TELEGRAM_ADMIN_IDS),
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || "",
  cronSecret: process.env.CRON_SECRET || "",
  websiteUrl: (process.env.WEBSITE_URL || "https://robinsonj.vercel.app").replace(/\/+$/, ""),
  gscSiteUrl: process.env.GSC_SITE_URL || "https://robinsonj.vercel.app/",
  googleClientEmail: process.env.GOOGLE_CLIENT_EMAIL,
  googlePrivateKey: cleanPrivateKey(process.env.GOOGLE_PRIVATE_KEY),
  googleCredentialsJson: process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
  environment: process.env.NODE_ENV || "production"
};

// server/_lib/db.ts
var pool = null;
var initialized = false;
function getDbPool() {
  if (!appConfig.databaseUrl) {
    return null;
  }
  if (!pool) {
    const isLocalhost = appConfig.databaseUrl.includes("localhost") || appConfig.databaseUrl.includes("127.0.0.1");
    pool = new Pool({
      connectionString: appConfig.databaseUrl,
      ssl: isLocalhost ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 3e4,
      connectionTimeoutMillis: 5e3
    });
    pool.on("error", (err) => {
      console.error("[DB] Unexpected error on idle PostgreSQL client:", err.message);
    });
  }
  return pool;
}
async function query(text, params) {
  const p = getDbPool();
  if (!p) {
    return {
      rows: [],
      command: "",
      rowCount: 0,
      oid: 0,
      fields: []
    };
  }
  if (!initialized) {
    await ensureSchemaInitialized();
  }
  const start = Date.now();
  const res = await p.query(text, params);
  const duration = Date.now() - start;
  if (process.env.DEBUG_SQL === "true") {
    console.log("[DB] Executed query in", duration, "ms:", text.slice(0, 100));
  }
  return res;
}
async function ensureSchemaInitialized() {
  if (initialized) return;
  const p = getDbPool();
  if (!p) return;
  try {
    const schemaSql = getEmbeddedSchemaSql();
    await p.query(schemaSql);
    initialized = true;
    console.log("[DB] Schema initialized successfully.");
  } catch (err) {
    console.error("[DB] Schema initialization warning/error:", err.message);
    initialized = true;
  }
}
function getEmbeddedSchemaSql() {
  return `
    CREATE TABLE IF NOT EXISTS visitor_sessions (
        id BIGSERIAL PRIMARY KEY,
        session_id VARCHAR(64) NOT NULL UNIQUE,
        visitor_id VARCHAR(64) NOT NULL,
        is_returning BOOLEAN DEFAULT FALSE,
        landing_page VARCHAR(1024),
        exit_page VARCHAR(1024),
        page_views_count INTEGER DEFAULT 1,
        duration_seconds INTEGER DEFAULT 0,
        device_category VARCHAR(32) DEFAULT 'desktop',
        browser VARCHAR(64),
        os VARCHAR(64),
        country VARCHAR(8) DEFAULT 'XX',
        referrer VARCHAR(2048),
        referrer_domain VARCHAR(255),
        utm_source VARCHAR(255),
        utm_medium VARCHAR(255),
        utm_campaign VARCHAR(255),
        started_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
        last_activity_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
        created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON visitor_sessions(session_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_visitor_id ON visitor_sessions(visitor_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON visitor_sessions(started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON visitor_sessions(last_activity_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sessions_country ON visitor_sessions(country);
    CREATE INDEX IF NOT EXISTS idx_sessions_device ON visitor_sessions(device_category);
    CREATE INDEX IF NOT EXISTS idx_sessions_utm_source ON visitor_sessions(utm_source);

    CREATE TABLE IF NOT EXISTS analytics_events (
        id BIGSERIAL PRIMARY KEY,
        session_id VARCHAR(64) NOT NULL,
        event_type VARCHAR(64) NOT NULL DEFAULT 'pageview',
        event_name VARCHAR(128) NOT NULL DEFAULT 'pageview',
        url VARCHAR(2048) NOT NULL,
        path VARCHAR(1024) NOT NULL,
        referrer VARCHAR(2048),
        referrer_domain VARCHAR(255),
        utm_source VARCHAR(255),
        utm_medium VARCHAR(255),
        utm_campaign VARCHAR(255),
        device_category VARCHAR(32),
        browser VARCHAR(64),
        os VARCHAR(64),
        country VARCHAR(8),
        screen_width INTEGER,
        screen_height INTEGER,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
    );

    CREATE INDEX IF NOT EXISTS idx_events_session_id ON analytics_events(session_id);
    CREATE INDEX IF NOT EXISTS idx_events_created_at ON analytics_events(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_events_path ON analytics_events(path);
    CREATE INDEX IF NOT EXISTS idx_events_event_type ON analytics_events(event_type);

    CREATE TABLE IF NOT EXISTS page_views (
        id BIGSERIAL PRIMARY KEY,
        session_id VARCHAR(64) NOT NULL,
        path VARCHAR(1024) NOT NULL,
        title VARCHAR(512),
        duration_seconds INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
    );

    CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_page_views_path ON page_views(path);
    CREATE INDEX IF NOT EXISTS idx_page_views_session ON page_views(session_id);

    CREATE TABLE IF NOT EXISTS seo_audits (
        id BIGSERIAL PRIMARY KEY,
        url VARCHAR(1024) NOT NULL,
        score INTEGER NOT NULL,
        pages_crawled INTEGER NOT NULL DEFAULT 1,
        total_issues INTEGER NOT NULL DEFAULT 0,
        critical_issues INTEGER NOT NULL DEFAULT 0,
        warnings INTEGER NOT NULL DEFAULT 0,
        info_count INTEGER NOT NULL DEFAULT 0,
        summary_json JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
    );

    CREATE INDEX IF NOT EXISTS idx_seo_audits_created_at ON seo_audits(created_at DESC);

    CREATE TABLE IF NOT EXISTS seo_issues (
        id BIGSERIAL PRIMARY KEY,
        audit_id BIGINT REFERENCES seo_audits(id) ON DELETE CASCADE,
        url VARCHAR(1024) NOT NULL,
        rule_id VARCHAR(64) NOT NULL,
        severity VARCHAR(16) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        recommendation TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
    );

    CREATE INDEX IF NOT EXISTS idx_seo_issues_audit_id ON seo_issues(audit_id);
    CREATE INDEX IF NOT EXISTS idx_seo_issues_severity ON seo_issues(severity);
    CREATE INDEX IF NOT EXISTS idx_seo_issues_rule_id ON seo_issues(rule_id);

    CREATE TABLE IF NOT EXISTS search_console_metrics (
        id BIGSERIAL PRIMARY KEY,
        site_url VARCHAR(1024) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        days_range INTEGER NOT NULL DEFAULT 28,
        clicks INTEGER NOT NULL DEFAULT 0,
        impressions INTEGER NOT NULL DEFAULT 0,
        ctr NUMERIC(6, 4) NOT NULL DEFAULT 0,
        position NUMERIC(6, 2) NOT NULL DEFAULT 0,
        top_queries_json JSONB DEFAULT '[]'::jsonb,
        top_pages_json JSONB DEFAULT '[]'::jsonb,
        countries_json JSONB DEFAULT '[]'::jsonb,
        devices_json JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
    );

    CREATE INDEX IF NOT EXISTS idx_gsc_created_at ON search_console_metrics(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_gsc_range ON search_console_metrics(site_url, days_range);

    CREATE TABLE IF NOT EXISTS bot_settings (
        key VARCHAR(128) PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
    );

    INSERT INTO bot_settings (key, value) VALUES
        ('alert_traffic_surge_pct', '200'::jsonb),
        ('alert_traffic_drop_pct', '60'::jsonb),
        ('alert_notifications_enabled', 'true'::jsonb),
        ('daily_report_enabled', 'true'::jsonb),
        ('weekly_report_enabled', 'true'::jsonb),
        ('data_retention_days', '180'::jsonb)
    ON CONFLICT (key) DO NOTHING;

    CREATE TABLE IF NOT EXISTS scheduled_reports (
        id BIGSERIAL PRIMARY KEY,
        report_type VARCHAR(64) NOT NULL,
        recipient_id VARCHAR(64) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'sent',
        message_summary TEXT,
        sent_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
    );

    CREATE INDEX IF NOT EXISTS idx_scheduled_reports_sent_at ON scheduled_reports(sent_at DESC);
    CREATE INDEX IF NOT EXISTS idx_scheduled_reports_type ON scheduled_reports(report_type);
  `;
}

// server/_lib/botFilter.ts
var BOT_PATTERNS = [
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
  /vercel-screenshot/i
];
function isBotOrCrawler(userAgent) {
  if (!userAgent || typeof userAgent !== "string") return true;
  if (userAgent.trim().length === 0) return true;
  for (const pattern of BOT_PATTERNS) {
    if (pattern.test(userAgent)) {
      return true;
    }
  }
  return false;
}
function validateTrackingPayload(body) {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Payload must be a JSON object" };
  }
  const sessionId = String(body.sessionId || "").trim();
  const visitorId = String(body.visitorId || "").trim();
  const url = String(body.url || "").trim();
  const path2 = String(body.path || "").trim();
  if (!sessionId || sessionId.length < 8 || sessionId.length > 64) {
    return { valid: false, error: "Invalid or missing sessionId" };
  }
  if (!visitorId || visitorId.length < 8 || visitorId.length > 64) {
    return { valid: false, error: "Invalid or missing visitorId" };
  }
  if (!url || !path2) {
    return { valid: false, error: "Invalid or missing url or path" };
  }
  let deviceCategory = "desktop";
  if (body.deviceCategory === "mobile" || body.deviceCategory === "tablet") {
    deviceCategory = body.deviceCategory;
  }
  const payload = {
    sessionId: sessionId.slice(0, 64),
    visitorId: visitorId.slice(0, 64),
    eventType: (body.eventType || "pageview").slice(0, 64),
    eventName: (body.eventName || "pageview").slice(0, 128),
    url: url.slice(0, 2048),
    path: path2.slice(0, 1024),
    title: body.title ? String(body.title).slice(0, 512) : void 0,
    referrer: body.referrer ? String(body.referrer).slice(0, 2048) : void 0,
    utmSource: body.utmSource ? String(body.utmSource).slice(0, 255) : void 0,
    utmMedium: body.utmMedium ? String(body.utmMedium).slice(0, 255) : void 0,
    utmCampaign: body.utmCampaign ? String(body.utmCampaign).slice(0, 255) : void 0,
    deviceCategory,
    browser: body.browser ? String(body.browser).slice(0, 64) : "Unknown",
    os: body.os ? String(body.os).slice(0, 64) : "Unknown",
    screenWidth: typeof body.screenWidth === "number" ? Math.floor(body.screenWidth) : void 0,
    screenHeight: typeof body.screenHeight === "number" ? Math.floor(body.screenHeight) : void 0,
    metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
    durationSeconds: typeof body.durationSeconds === "number" ? Math.max(0, Math.floor(body.durationSeconds)) : 0,
    isNewSession: Boolean(body.isNewSession)
  };
  return { valid: true, payload };
}
function extractReferrerDomain(referrer) {
  if (!referrer) return null;
  try {
    const parsed = new URL(referrer);
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

// server/_lib/jsonStore.ts
import fs from "fs";
import path from "path";
var STORAGE_FILE = path.join("/tmp", "portfolio_analytics.json");
var MAX_SESSIONS = 500;
var MAX_PAGEVIEWS = 1e3;
var memoryStore = {
  totalVisitorsCount: 0,
  totalPageViewsCount: 0,
  sessions: [],
  pageViews: [],
  lastSavedAt: (/* @__PURE__ */ new Date()).toISOString()
};
try {
  if (fs.existsSync(STORAGE_FILE)) {
    const raw = fs.readFileSync(STORAGE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      memoryStore = {
        totalVisitorsCount: parsed.totalVisitorsCount || 0,
        totalPageViewsCount: parsed.totalPageViewsCount || 0,
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        pageViews: Array.isArray(parsed.pageViews) ? parsed.pageViews : [],
        lastSavedAt: parsed.lastSavedAt || (/* @__PURE__ */ new Date()).toISOString()
      };
    }
  }
} catch {
}
function persistToDisk() {
  try {
    memoryStore.lastSavedAt = (/* @__PURE__ */ new Date()).toISOString();
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(memoryStore));
  } catch {
  }
}
var JsonAnalyticsStore = class {
  /**
   * Record a new or existing visitor session and pageview
   */
  static recordEvent(payload) {
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    let isNewSession = false;
    let existingSession = memoryStore.sessions.find((s) => s.sessionId === payload.sessionId);
    const isReturningVisitor = memoryStore.sessions.some(
      (s) => s.visitorId === payload.visitorId && s.sessionId !== payload.sessionId
    );
    if (!existingSession) {
      isNewSession = true;
      existingSession = {
        sessionId: payload.sessionId,
        visitorId: payload.visitorId,
        isReturning: isReturningVisitor,
        landingPage: payload.path,
        exitPage: payload.path,
        pageViewsCount: 1,
        durationSeconds: payload.durationSeconds || 0,
        deviceCategory: payload.deviceCategory || "desktop",
        browser: payload.browser || "Unknown",
        os: payload.os || "Unknown",
        country: payload.country || "XX",
        referrer: payload.referrer || "Direct",
        referrerDomain: payload.referrerDomain || "Direct",
        utmSource: payload.utmSource,
        startedAt: nowIso,
        lastActivityAt: nowIso
      };
      memoryStore.sessions.unshift(existingSession);
      memoryStore.totalVisitorsCount++;
      if (memoryStore.sessions.length > MAX_SESSIONS) {
        memoryStore.sessions.pop();
      }
    } else {
      existingSession.lastActivityAt = nowIso;
      existingSession.exitPage = payload.path;
      existingSession.pageViewsCount++;
      if (payload.durationSeconds) {
        existingSession.durationSeconds = Math.max(existingSession.durationSeconds, payload.durationSeconds);
      }
    }
    memoryStore.totalPageViewsCount++;
    memoryStore.pageViews.unshift({
      path: payload.path,
      title: payload.title,
      timestamp: nowIso,
      sessionId: payload.sessionId
    });
    if (memoryStore.pageViews.length > MAX_PAGEVIEWS) {
      memoryStore.pageViews.pop();
    }
    persistToDisk();
    return { isNewSession, isReturningVisitor };
  }
  /**
   * Get overall metrics for period
   */
  static getMetrics(period) {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1e3;
    let filtered = memoryStore.sessions;
    if (period === "today") {
      const todayStart = /* @__PURE__ */ new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      filtered = memoryStore.sessions.filter((s) => new Date(s.startedAt).getTime() >= todayStart.getTime());
    } else if (period === "yesterday") {
      const todayStart = /* @__PURE__ */ new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const yesterdayStart = new Date(todayStart.getTime() - oneDay);
      filtered = memoryStore.sessions.filter((s) => {
        const t = new Date(s.startedAt).getTime();
        return t >= yesterdayStart.getTime() && t < todayStart.getTime();
      });
    } else if (period === "7_days") {
      filtered = memoryStore.sessions.filter((s) => now - new Date(s.startedAt).getTime() <= 7 * oneDay);
    } else if (period === "30_days") {
      filtered = memoryStore.sessions.filter((s) => now - new Date(s.startedAt).getTime() <= 30 * oneDay);
    }
    const totalVisitors = new Set(filtered.map((s) => s.visitorId)).size;
    const totalPageViews = filtered.reduce((acc, s) => acc + s.pageViewsCount, 0);
    const newSessions = filtered.filter((s) => !s.isReturning).length;
    const returningSessions = filtered.filter((s) => s.isReturning).length;
    const avgDurationSeconds = filtered.length > 0 ? Math.round(filtered.reduce((acc, s) => acc + s.durationSeconds, 0) / filtered.length) : 0;
    const avgPagesPerSession = filtered.length > 0 ? parseFloat((totalPageViews / filtered.length).toFixed(1)) : 1;
    return {
      totalVisitors: period === "all_time" ? Math.max(totalVisitors, memoryStore.totalVisitorsCount) : totalVisitors,
      totalPageViews: period === "all_time" ? Math.max(totalPageViews, memoryStore.totalPageViewsCount) : totalPageViews,
      newSessions,
      returningSessions,
      avgDurationSeconds,
      avgPagesPerSession
    };
  }
  /**
   * Get Top Pages
   */
  static getTopPages(limit = 10, offset = 0) {
    const counts = /* @__PURE__ */ new Map();
    for (const pv of memoryStore.pageViews) {
      const existing = counts.get(pv.path) || { views: 0, uniqueVisitors: /* @__PURE__ */ new Set() };
      existing.views++;
      existing.uniqueVisitors.add(pv.sessionId);
      counts.set(pv.path, existing);
    }
    const sorted = Array.from(counts.entries()).map(([path2, data]) => ({
      path: path2,
      views: data.views,
      uniqueVisitors: data.uniqueVisitors.size
    })).sort((a, b) => b.views - a.views);
    return {
      pages: sorted.slice(offset, offset + limit),
      total: sorted.length
    };
  }
  /**
   * Get Referrers
   */
  static getReferrers(limit = 10, offset = 0) {
    const counts = /* @__PURE__ */ new Map();
    for (const s of memoryStore.sessions) {
      const domain = s.referrerDomain || "Direct";
      counts.set(domain, (counts.get(domain) || 0) + 1);
    }
    const total = memoryStore.sessions.length || 1;
    const sorted = Array.from(counts.entries()).map(([domain, count]) => ({
      domain,
      count,
      percentage: parseFloat((count / total * 100).toFixed(1))
    })).sort((a, b) => b.count - a.count);
    return {
      referrers: sorted.slice(offset, offset + limit),
      total: sorted.length
    };
  }
  /**
   * Get Devices
   */
  static getDevices() {
    const counts = /* @__PURE__ */ new Map();
    for (const s of memoryStore.sessions) {
      counts.set(s.deviceCategory, (counts.get(s.deviceCategory) || 0) + 1);
    }
    const total = memoryStore.sessions.length || 1;
    return Array.from(counts.entries()).map(([device, count]) => ({
      device,
      count,
      percentage: parseFloat((count / total * 100).toFixed(1))
    }));
  }
  /**
   * Get Countries
   */
  static getCountries(limit = 10, offset = 0) {
    const counts = /* @__PURE__ */ new Map();
    for (const s of memoryStore.sessions) {
      counts.set(s.country, (counts.get(s.country) || 0) + 1);
    }
    const total = memoryStore.sessions.length || 1;
    const sorted = Array.from(counts.entries()).map(([country, count]) => ({
      country,
      count,
      percentage: parseFloat((count / total * 100).toFixed(1))
    })).sort((a, b) => b.count - a.count);
    return {
      countries: sorted.slice(offset, offset + limit),
      total: sorted.length
    };
  }
  /**
   * Get Realtime Activity
   */
  static getRealtime() {
    const now = Date.now();
    const halfHour = 30 * 60 * 1e3;
    const activeSessions = memoryStore.sessions.filter(
      (s) => now - new Date(s.lastActivityAt).getTime() <= halfHour
    );
    const recentSessions = memoryStore.sessions.slice(0, 8).map((s) => ({
      path: s.exitPage || s.landingPage || "/",
      device: s.deviceCategory || "desktop",
      country: s.country || "XX",
      minutesAgo: Math.max(0, Math.round((now - new Date(s.lastActivityAt).getTime()) / 6e4))
    }));
    return {
      activeSessions30m: activeSessions.length,
      pageViews30m: activeSessions.reduce((acc, s) => acc + s.pageViewsCount, 0),
      recentSessions
    };
  }
};

// server/_lib/telegram.ts
var TelegramClient = class {
  static getApiUrl(method) {
    if (!appConfig.telegramBotToken) {
      throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
    }
    return `https://api.telegram.org/bot${appConfig.telegramBotToken}/${method}`;
  }
  /**
   * Send a text message to a Telegram chat
   */
  static async sendMessage(chatId, text, options = {}) {
    const url = this.getApiUrl("sendMessage");
    const body = {
      chat_id: chatId,
      text,
      parse_mode: options.parse_mode || "HTML",
      disable_web_page_preview: options.disable_web_page_preview ?? true
    };
    if (options.reply_markup) {
      body.reply_markup = options.reply_markup;
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!data.ok) {
      console.error("[TelegramClient] sendMessage error:", data.description);
    }
    return data;
  }
  /**
   * Edit an existing message text and/or inline keyboard
   */
  static async editMessageText(chatId, messageId, text, options = {}) {
    const url = this.getApiUrl("editMessageText");
    const body = {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: options.parse_mode || "HTML",
      disable_web_page_preview: options.disable_web_page_preview ?? true
    };
    if (options.reply_markup) {
      body.reply_markup = options.reply_markup;
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!data.ok) {
      if (!data.description?.includes("message is not modified")) {
        console.error("[TelegramClient] editMessageText error:", data.description);
      }
    }
    return data;
  }
  /**
   * Acknowledge a callback query button press
   */
  static async answerCallbackQuery(callbackQueryId, text, showAlert = false) {
    const url = this.getApiUrl("answerCallbackQuery");
    const body = {
      callback_query_id: callbackQueryId,
      show_alert: showAlert
    };
    if (text) {
      body.text = text;
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    return res.json();
  }
  /**
   * Show typing or action indicator
   */
  static async sendChatAction(chatId, action = "typing") {
    try {
      const url = this.getApiUrl("sendChatAction");
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, action })
      });
    } catch {
    }
  }
  /**
   * Set webhook URL with secret token
   */
  static async setWebhook(webhookUrl, secretToken) {
    const url = this.getApiUrl("setWebhook");
    const body = {
      url: webhookUrl,
      drop_pending_updates: false,
      allowed_updates: ["message", "callback_query"]
    };
    if (secretToken) {
      body.secret_token = secretToken;
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    return res.json();
  }
  /**
   * Get current webhook info
   */
  static async getWebhookInfo() {
    const url = this.getApiUrl("getWebhookInfo");
    const res = await fetch(url);
    return res.json();
  }
  /**
   * Render an ASCII progress bar for metrics and ratings
   */
  static renderProgressBar(value, max = 100, length = 10) {
    if (max <= 0) return "\u2591".repeat(length);
    const ratio = Math.max(0, Math.min(1, value / max));
    const filled = Math.round(ratio * length);
    return "\u2588".repeat(filled) + "\u2591".repeat(length - filled);
  }
  /**
   * Convert ISO country code into national flag emoji
   */
  static getCountryFlag(code) {
    if (!code || code === "XX" || code.length !== 2) return "\u{1F310}";
    try {
      const upper = code.toUpperCase();
      return String.fromCodePoint(127397 + upper.charCodeAt(0)) + String.fromCodePoint(127397 + upper.charCodeAt(1));
    } catch {
      return "\u{1F310}";
    }
  }
  /**
   * Escape HTML special characters for safe inclusion in Telegram messages
   */
  static escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
};

// server/track.ts
var recentEvents = /* @__PURE__ */ new Map();
function cleanRecentEventsCache() {
  const now = Date.now();
  if (recentEvents.size > 2e3) {
    for (const [key, timestamp] of recentEvents.entries()) {
      if (now - timestamp > 1e4) {
        recentEvents.delete(key);
      }
    }
  }
}
async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const userAgent = req.headers["user-agent"];
    if (isBotOrCrawler(userAgent)) {
      return res.status(200).json({ status: "ignored", reason: "crawler_or_bot" });
    }
    if (req.body && (req.body.eventType === "contact" || req.body.isContactForm || req.body.name && req.body.email && req.body.message)) {
      const name = String(req.body.name || "").trim();
      const email = String(req.body.email || "").trim();
      const message = String(req.body.message || "").trim();
      if (!name || !email || !message) {
        return res.status(400).json({ error: "Name, email, and message are required fields." });
      }
      const country2 = (req.headers["x-vercel-ip-country"] || req.headers["cf-ipcountry"] || "XX").slice(0, 8).toUpperCase();
      const flag = TelegramClient.getCountryFlag(country2);
      const alertMsg = `
\u{1F4EC} <b>NEW PORTFOLIO INQUIRY RECEIVED!</b>
\u{1F310} <code>${TelegramClient.escapeHtml(appConfig.websiteUrl)}</code> \u2022 <b>\u25CF INQUIRY</b>

<pre>
FROM     : ${TelegramClient.escapeHtml(name)}
EMAIL    : ${TelegramClient.escapeHtml(email)}
COUNTRY  : ${flag} ${country2}
TIME     : ${(/* @__PURE__ */ new Date()).toLocaleTimeString("en-US")} UTC
</pre>

<b>Message:</b>
<blockquote>${TelegramClient.escapeHtml(message)}</blockquote>
`.trim();
      const keyboard = {
        inline_keyboard: [
          [
            { text: "\u2709\uFE0F Reply to " + name, url: `mailto:${encodeURIComponent(email)}?subject=Re:%20Inquiry%20via%20Robinson%20Portfolio` }
          ],
          [
            { text: "\u{1F4CA} Dashboard", callback_data: "nav:dashboard" }
          ]
        ]
      };
      for (const adminId of appConfig.telegramAdminIds) {
        TelegramClient.sendMessage(adminId, alertMsg, { reply_markup: keyboard }).catch((err) => {
          console.error("[Track] Telegram contact alert error:", err.message);
        });
      }
      return res.status(200).json({ ok: true, status: "sent", message: "Inquiry received successfully!" });
    }
    const country = (req.headers["x-vercel-ip-country"] || req.headers["cf-ipcountry"] || "XX").slice(0, 8).toUpperCase();
    const { valid, payload, error } = validateTrackingPayload(req.body);
    if (!valid || !payload) {
      return res.status(400).json({ error: error || "Invalid payload" });
    }
    cleanRecentEventsCache();
    const dedupKey = `${payload.sessionId}:${payload.path}:${payload.eventName}`;
    const now = Date.now();
    const lastSeen = recentEvents.get(dedupKey);
    if (lastSeen && now - lastSeen < 2e3 && payload.eventType === "pageview") {
      return res.status(200).json({ status: "deduplicated" });
    }
    recentEvents.set(dedupKey, now);
    const referrerDomain = extractReferrerDomain(payload.referrer) || "Direct";
    const { isNewSession } = JsonAnalyticsStore.recordEvent({
      sessionId: payload.sessionId,
      visitorId: payload.visitorId,
      path: payload.path,
      title: payload.title,
      referrer: payload.referrer,
      referrerDomain,
      deviceCategory: payload.deviceCategory,
      browser: payload.browser,
      os: payload.os,
      country,
      utmSource: payload.utmSource,
      durationSeconds: payload.durationSeconds
    });
    if (isNewSession && appConfig.telegramBotToken && appConfig.telegramAdminIds.length > 0) {
      const flag = TelegramClient.getCountryFlag(country);
      const cleanUrl = `${appConfig.websiteUrl}${payload.path === "/" ? "" : payload.path}`;
      const alertMsg = `
\u26A1 <b>REAL-TIME VISITOR ACTIVITY</b>
\u{1F310} <code>${TelegramClient.escapeHtml(appConfig.websiteUrl)}</code> \u2022 <b>\u25CF ACTIVE</b>

<pre>
ROUTE    : ${payload.path}
ORIGIN   : ${flag} ${country}
DEVICE   : ${payload.deviceCategory} (${payload.browser} / ${payload.os})
SOURCE   : ${referrerDomain}${payload.utmSource ? ` [UTM: ${payload.utmSource}]` : ""}
SESSION  : New First-Time Visitor
</pre>
`.trim();
      const keyboard = {
        inline_keyboard: [
          [
            { text: "\u{1F4CA} Dashboard", callback_data: "nav:dashboard" },
            { text: "\u{1F310} Open Route \u2197", url: cleanUrl }
          ]
        ]
      };
      for (const adminId of appConfig.telegramAdminIds) {
        TelegramClient.sendMessage(adminId, alertMsg, { reply_markup: keyboard }).catch(() => {
        });
      }
    }
    if (appConfig.databaseUrl) {
      try {
        const sessionRes = await query(
          `SELECT id, page_views_count, started_at FROM visitor_sessions WHERE session_id = $1 LIMIT 1`,
          [payload.sessionId]
        );
        if (sessionRes.rows.length === 0) {
          const prevVisitorRes = await query(
            `SELECT id FROM visitor_sessions WHERE visitor_id = $1 LIMIT 1`,
            [payload.visitorId]
          );
          const isReturning = prevVisitorRes.rows.length > 0;
          await query(
            `INSERT INTO visitor_sessions (
              session_id, visitor_id, is_returning, landing_page, exit_page,
              page_views_count, duration_seconds, device_category, browser, os,
              country, referrer, referrer_domain, utm_source, utm_medium, utm_campaign,
              started_at, last_activity_at
            ) VALUES (
              $1, $2, $3, $4, $5,
              $6, $7, $8, $9, $10,
              $11, $12, $13, $14, $15, $16,
              NOW() AT TIME ZONE 'UTC', NOW() AT TIME ZONE 'UTC'
            )`,
            [
              payload.sessionId,
              payload.visitorId,
              isReturning,
              payload.path,
              payload.path,
              1,
              payload.durationSeconds || 0,
              payload.deviceCategory,
              payload.browser,
              payload.os,
              country,
              payload.referrer || null,
              referrerDomain,
              payload.utmSource || null,
              payload.utmMedium || null,
              payload.utmCampaign || null
            ]
          );
        } else {
          const existing = sessionRes.rows[0];
          const newPageViews = payload.eventType === "pageview" ? existing.page_views_count + 1 : existing.page_views_count;
          await query(
            `UPDATE visitor_sessions SET
              last_activity_at = NOW() AT TIME ZONE 'UTC',
              exit_page = $1,
              page_views_count = $2,
              duration_seconds = GREATEST(duration_seconds, $3)
            WHERE session_id = $4`,
            [payload.path, newPageViews, payload.durationSeconds || 0, payload.sessionId]
          );
        }
        if (payload.eventType === "pageview") {
          await query(
            `INSERT INTO page_views (session_id, path, title, duration_seconds)
             VALUES ($1, $2, $3, $4)`,
            [payload.sessionId, payload.path, payload.title || null, payload.durationSeconds || 0]
          );
        }
      } catch (dbErr) {
        console.warn("[Track] Optional DB insert bypassed:", dbErr.message);
      }
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("[Track] Error processing tracking payload:", err.message);
    return res.status(200).json({ success: false, error: "Ingestion bypassed" });
  }
}
export {
  handler as default
};
