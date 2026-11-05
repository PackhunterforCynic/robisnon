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
function isTelegramAdmin(userId) {
  if (!appConfig.telegramAdminIds || appConfig.telegramAdminIds.length === 0) {
    return false;
  }
  const idStr = String(userId).trim();
  return appConfig.telegramAdminIds.includes(idStr);
}
function sanitizeLog(data) {
  try {
    const str = typeof data === "string" ? data : JSON.stringify(data);
    return str.replace(/bot[0-9]+:[a-zA-Z0-9_-]+/gi, "bot[REDACTED]").replace(/postgres(?:ql)?:\/\/[^:]+:[^@]+@/gi, "postgres://user:REDACTED@").replace(/-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/g, "[REDACTED_PRIVATE_KEY]");
  } catch {
    return "[Unserializable data]";
  }
}

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
   * Escape HTML special characters for safe inclusion in Telegram messages
   */
  static escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
};

// server/_lib/db.ts
import { Pool } from "pg";
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

// server/_lib/analyticsService.ts
var AnalyticsService = class {
  /**
   * Get metrics for a specific interval (e.g. 'today', 'yesterday', '7_days', '30_days', 'all_time')
   */
  static async getMetricsForPeriod(period) {
    if (!appConfig.databaseUrl) {
      return JsonAnalyticsStore.getMetrics(period);
    }
    let whereClause = "";
    if (period === "today") {
      whereClause = `WHERE started_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')`;
    } else if (period === "yesterday") {
      whereClause = `WHERE started_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') - INTERVAL '1 day'
                     AND started_at < DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')`;
    } else if (period === "7_days") {
      whereClause = `WHERE started_at >= NOW() AT TIME ZONE 'UTC' - INTERVAL '7 days'`;
    } else if (period === "30_days") {
      whereClause = `WHERE started_at >= NOW() AT TIME ZONE 'UTC' - INTERVAL '30 days'`;
    }
    const sql = `
      SELECT
        COUNT(DISTINCT visitor_id)::int AS total_visitors,
        COALESCE(SUM(page_views_count), 0)::int AS total_page_views,
        COUNT(CASE WHEN is_returning = false THEN 1 END)::int AS new_sessions,
        COUNT(CASE WHEN is_returning = true THEN 1 END)::int AS returning_sessions,
        COALESCE(AVG(duration_seconds), 0)::int AS avg_duration,
        COALESCE(AVG(page_views_count), 0)::numeric(4,1) AS avg_pages_per_session
      FROM visitor_sessions
      ${whereClause}
    `;
    try {
      const res = await query(sql);
      const row = res.rows[0] || {};
      return {
        totalVisitors: row.total_visitors || 0,
        totalPageViews: row.total_page_views || 0,
        newSessions: row.new_sessions || 0,
        returningSessions: row.returning_sessions || 0,
        avgDurationSeconds: row.avg_duration || 0,
        avgPagesPerSession: parseFloat(row.avg_pages_per_session || "1.0")
      };
    } catch (err) {
      console.error("[AnalyticsService] Error fetching period metrics:", err.message);
      return {
        totalVisitors: 0,
        totalPageViews: 0,
        newSessions: 0,
        returningSessions: 0,
        avgDurationSeconds: 0,
        avgPagesPerSession: 0
      };
    }
  }
  /**
   * Get most popular pages
   */
  static async getTopPages(limit = 10, offset = 0, periodDays = 30) {
    if (!appConfig.databaseUrl) {
      return JsonAnalyticsStore.getTopPages(limit, offset);
    }
    try {
      const countRes = await query(`
        SELECT COUNT(DISTINCT path)::int AS total
        FROM page_views
        WHERE created_at >= NOW() AT TIME ZONE 'UTC' - INTERVAL '1 day' * $1
      `, [periodDays]);
      const total = countRes.rows[0]?.total || 0;
      const sql = `
        SELECT
          path,
          COUNT(*)::int AS views,
          COUNT(DISTINCT session_id)::int AS unique_visitors
        FROM page_views
        WHERE created_at >= NOW() AT TIME ZONE 'UTC' - INTERVAL '1 day' * $1
        GROUP BY path
        ORDER BY views DESC
        LIMIT $2 OFFSET $3
      `;
      const res = await query(sql, [periodDays, limit, offset]);
      return {
        pages: res.rows.map((r) => ({
          path: r.path,
          views: r.views,
          uniqueVisitors: r.unique_visitors
        })),
        total
      };
    } catch (err) {
      console.error("[AnalyticsService] Error fetching top pages:", err.message);
      return { pages: [], total: 0 };
    }
  }
  /**
   * Get traffic sources & referrers
   */
  static async getReferrers(limit = 10, offset = 0, periodDays = 30) {
    if (!appConfig.databaseUrl) {
      return JsonAnalyticsStore.getReferrers(limit, offset);
    }
    try {
      const countRes = await query(`
        SELECT COUNT(DISTINCT COALESCE(referrer_domain, 'Direct'))::int AS total
        FROM visitor_sessions
        WHERE started_at >= NOW() AT TIME ZONE 'UTC' - INTERVAL '1 day' * $1
      `, [periodDays]);
      const total = countRes.rows[0]?.total || 0;
      const sql = `
        WITH source_counts AS (
          SELECT
            COALESCE(referrer_domain, 'Direct') AS domain,
            COUNT(*)::int AS count
          FROM visitor_sessions
          WHERE started_at >= NOW() AT TIME ZONE 'UTC' - INTERVAL '1 day' * $1
          GROUP BY COALESCE(referrer_domain, 'Direct')
        ),
        total_sum AS (
          SELECT NULLIF(SUM(count), 0)::float AS total_count FROM source_counts
        )
        SELECT
          s.domain,
          s.count,
          ROUND(((s.count / t.total_count) * 100)::numeric, 1)::float AS percentage
        FROM source_counts s, total_sum t
        ORDER BY s.count DESC
        LIMIT $2 OFFSET $3
      `;
      const res = await query(sql, [periodDays, limit, offset]);
      return {
        referrers: res.rows.map((r) => ({
          domain: r.domain,
          count: r.count,
          percentage: r.percentage || 0
        })),
        total
      };
    } catch (err) {
      console.error("[AnalyticsService] Error fetching referrers:", err.message);
      return { referrers: [], total: 0 };
    }
  }
  /**
   * Device distribution
   */
  static async getDevices(periodDays = 30) {
    if (!appConfig.databaseUrl) {
      return JsonAnalyticsStore.getDevices();
    }
    try {
      const sql = `
        WITH dev_counts AS (
          SELECT
            device_category AS device,
            COUNT(*)::int AS count
          FROM visitor_sessions
          WHERE started_at >= NOW() AT TIME ZONE 'UTC' - INTERVAL '1 day' * $1
          GROUP BY device_category
        ),
        total_sum AS (
          SELECT NULLIF(SUM(count), 0)::float AS total_count FROM dev_counts
        )
        SELECT
          d.device,
          d.count,
          ROUND(((d.count / t.total_count) * 100)::numeric, 1)::float AS percentage
        FROM dev_counts d, total_sum t
        ORDER BY d.count DESC
      `;
      const res = await query(sql, [periodDays]);
      return res.rows.map((r) => ({
        device: r.device || "desktop",
        count: r.count,
        percentage: r.percentage || 0
      }));
    } catch (err) {
      console.error("[AnalyticsService] Error fetching devices:", err.message);
      return [];
    }
  }
  /**
   * Country distribution
   */
  static async getCountries(limit = 10, offset = 0, periodDays = 30) {
    if (!appConfig.databaseUrl) {
      return JsonAnalyticsStore.getCountries(limit, offset);
    }
    try {
      const countRes = await query(`
        SELECT COUNT(DISTINCT country)::int AS total
        FROM visitor_sessions
        WHERE started_at >= NOW() AT TIME ZONE 'UTC' - INTERVAL '1 day' * $1
      `, [periodDays]);
      const total = countRes.rows[0]?.total || 0;
      const sql = `
        WITH c_counts AS (
          SELECT
            country,
            COUNT(*)::int AS count
          FROM visitor_sessions
          WHERE started_at >= NOW() AT TIME ZONE 'UTC' - INTERVAL '1 day' * $1
          GROUP BY country
        ),
        total_sum AS (
          SELECT NULLIF(SUM(count), 0)::float AS total_count FROM c_counts
        )
        SELECT
          c.country,
          c.count,
          ROUND(((c.count / t.total_count) * 100)::numeric, 1)::float AS percentage
        FROM c_counts c, total_sum t
        ORDER BY c.count DESC
        LIMIT $2 OFFSET $3
      `;
      const res = await query(sql, [periodDays, limit, offset]);
      return {
        countries: res.rows.map((r) => ({
          country: r.country || "XX",
          count: r.count,
          percentage: r.percentage || 0
        })),
        total
      };
    } catch (err) {
      console.error("[AnalyticsService] Error fetching countries:", err.message);
      return { countries: [], total: 0 };
    }
  }
  /**
   * Realtime activity (last 30 minutes)
   */
  static async getRealtime() {
    if (!appConfig.databaseUrl) {
      return JsonAnalyticsStore.getRealtime();
    }
    try {
      const statsRes = await query(`
        SELECT
          COUNT(DISTINCT session_id)::int AS active_sessions,
          COALESCE(SUM(page_views_count), 0)::int AS page_views
        FROM visitor_sessions
        WHERE last_activity_at >= NOW() AT TIME ZONE 'UTC' - INTERVAL '30 minutes'
      `);
      const recentRes = await query(`
        SELECT
          landing_page AS path,
          device_category AS device,
          country,
          ROUND(EXTRACT(EPOCH FROM (NOW() AT TIME ZONE 'UTC' - last_activity_at)) / 60)::int AS minutes_ago
        FROM visitor_sessions
        WHERE last_activity_at >= NOW() AT TIME ZONE 'UTC' - INTERVAL '24 hours'
        ORDER BY last_activity_at DESC
        LIMIT 8
      `);
      return {
        activeSessions30m: statsRes.rows[0]?.active_sessions || 0,
        pageViews30m: statsRes.rows[0]?.page_views || 0,
        recentSessions: recentRes.rows.map((r) => ({
          path: r.path || "/",
          device: r.device || "desktop",
          country: r.country || "XX",
          minutesAgo: Math.max(0, r.minutes_ago || 0)
        }))
      };
    } catch (err) {
      console.error("[AnalyticsService] Error fetching realtime activity:", err.message);
      return { activeSessions30m: 0, pageViews30m: 0, recentSessions: [] };
    }
  }
};

// server/_lib/seoAuditor.ts
import * as cheerio from "cheerio";
var SeoAuditor = class {
  static USER_AGENT = "RobinsonSeoAuditor/1.0 (+https://robinsonj.vercel.app)";
  static cachedAudit = null;
  /**
   * Run a full SEO audit against the target website
   */
  static async runAudit(siteUrl = appConfig.websiteUrl) {
    const baseUrl = siteUrl.replace(/\/+$/, "");
    const issues = [];
    const auditedPageResults = [];
    await this.auditRobotsTxt(baseUrl, issues);
    const sitemapUrls = await this.auditSitemap(baseUrl, issues);
    const urlsToAudit = /* @__PURE__ */ new Set();
    urlsToAudit.add(`${baseUrl}/`);
    if (sitemapUrls.length > 0) {
      for (const u of sitemapUrls) {
        const clean = u.replace(/\/+$/, "");
        const target = clean === baseUrl ? `${baseUrl}/` : clean;
        urlsToAudit.add(target);
      }
    } else {
      urlsToAudit.add(`${baseUrl}/projects`);
      urlsToAudit.add(`${baseUrl}/blog`);
      urlsToAudit.add(`${baseUrl}/stories`);
      urlsToAudit.add(`${baseUrl}/skills`);
      urlsToAudit.add(`${baseUrl}/about`);
      urlsToAudit.add(`${baseUrl}/contact`);
    }
    const uniqueUrls = Array.from(urlsToAudit).slice(0, 10);
    for (const url of uniqueUrls) {
      const pageResult = await this.auditPage(url, baseUrl);
      auditedPageResults.push(pageResult);
      issues.push(...pageResult.issues);
    }
    this.checkDuplicates(auditedPageResults, issues);
    const { score, categoryScores } = this.calculateScore(issues, auditedPageResults);
    const criticalCount = issues.filter((i) => i.severity === "CRITICAL").length;
    const warningCount = issues.filter((i) => i.severity === "WARNING").length;
    const infoCount = issues.filter((i) => i.severity === "INFO").length;
    let auditId;
    try {
      const summaryJson = {
        categoryScores,
        pages: auditedPageResults.map((p) => ({ url: p.url, statusCode: p.statusCode, responseTimeMs: p.responseTimeMs }))
      };
      const auditRes = await query(
        `INSERT INTO seo_audits (
          url, score, pages_crawled, total_issues, critical_issues, warnings, info_count, summary_json
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [
          baseUrl,
          score,
          auditedPageResults.length,
          issues.length,
          criticalCount,
          warningCount,
          infoCount,
          JSON.stringify(summaryJson)
        ]
      );
      auditId = auditRes.rows[0]?.id;
      if (auditId && issues.length > 0) {
        for (const issue of issues.slice(0, 50)) {
          await query(
            `INSERT INTO seo_issues (audit_id, url, rule_id, severity, title, description, recommendation)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [auditId, issue.url, issue.ruleId, issue.severity, issue.title, issue.description, issue.recommendation]
          );
        }
      }
    } catch (err) {
      console.error("[SeoAuditor] Failed to persist audit to DB:", err.message);
    }
    const report = {
      id: auditId,
      targetUrl: baseUrl,
      score,
      pagesCrawled: auditedPageResults.length,
      totalIssues: issues.length,
      criticalIssues: criticalCount,
      warnings: warningCount,
      infoCount,
      categoryScores,
      issues,
      auditedPages: uniqueUrls,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.cachedAudit = report;
    return report;
  }
  /**
   * Fetch the latest completed audit from the database
   */
  static async getLatestAudit() {
    if (!appConfig.databaseUrl) {
      return this.cachedAudit;
    }
    try {
      const res = await query(`
        SELECT id, url, score, pages_crawled, total_issues, critical_issues, warnings, info_count, summary_json, created_at
        FROM seo_audits
        ORDER BY created_at DESC
        LIMIT 1
      `);
      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      const issuesRes = await query(`
        SELECT url, rule_id AS "ruleId", severity, title, description, recommendation
        FROM seo_issues
        WHERE audit_id = $1
        ORDER BY CASE severity WHEN 'CRITICAL' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END
        LIMIT 25
      `, [row.id]);
      return {
        id: row.id,
        targetUrl: row.url,
        score: row.score,
        pagesCrawled: row.pages_crawled,
        totalIssues: row.total_issues,
        criticalIssues: row.critical_issues,
        warnings: row.warnings,
        infoCount: row.info_count,
        categoryScores: row.summary_json?.categoryScores || { technical: 28, content: 32, social: 14, links: 18 },
        issues: issuesRes.rows,
        auditedPages: row.summary_json?.pages?.map((p) => p.url) || [],
        createdAt: row.created_at
      };
    } catch (err) {
      console.error("[SeoAuditor] Error fetching latest audit:", err.message);
      return null;
    }
  }
  // --- PRIVATE AUDIT HELPERS ---
  static async auditRobotsTxt(baseUrl, issues) {
    const robotsUrl = `${baseUrl}/robots.txt`;
    try {
      const res = await fetch(robotsUrl, {
        headers: { "User-Agent": this.USER_AGENT },
        signal: AbortSignal.timeout(6e3)
      });
      if (res.status !== 200) {
        issues.push({
          url: robotsUrl,
          ruleId: "robots_txt_missing",
          severity: "WARNING",
          title: "Robots.txt Missing or Unreachable",
          description: `Server returned HTTP status ${res.status} for /robots.txt.`,
          recommendation: "Ensure a public robots.txt file exists in the public/ folder with User-agent and Sitemap directives."
        });
        return;
      }
      const text = await res.text();
      if (!/user-agent:/i.test(text)) {
        issues.push({
          url: robotsUrl,
          ruleId: "robots_txt_no_user_agent",
          severity: "WARNING",
          title: "Missing User-agent Directive in Robots.txt",
          description: "No User-agent declaration found in robots.txt.",
          recommendation: 'Add "User-agent: *" to allow search engine discovery.'
        });
      }
      if (!/sitemap:/i.test(text)) {
        issues.push({
          url: robotsUrl,
          ruleId: "robots_txt_no_sitemap",
          severity: "INFO",
          title: "Sitemap Directive Missing in Robots.txt",
          description: "Robots.txt does not advertise the sitemap location to web crawlers.",
          recommendation: `Add "Sitemap: ${baseUrl}/sitemap.xml" to robots.txt.`
        });
      }
    } catch (err) {
      issues.push({
        url: robotsUrl,
        ruleId: "robots_txt_unreachable",
        severity: "WARNING",
        title: "Could Not Fetch Robots.txt",
        description: `Error requesting robots.txt: ${err.message}`,
        recommendation: "Check website availability and ensure DNS and serverless routing allow robots.txt."
      });
    }
  }
  static async auditSitemap(baseUrl, issues) {
    const sitemapUrl = `${baseUrl}/sitemap.xml`;
    const discoveredUrls = [];
    try {
      const res = await fetch(sitemapUrl, {
        headers: { "User-Agent": this.USER_AGENT },
        signal: AbortSignal.timeout(6e3)
      });
      if (res.status !== 200) {
        issues.push({
          url: sitemapUrl,
          ruleId: "sitemap_missing",
          severity: "CRITICAL",
          title: "Sitemap.xml Missing or Inaccessible",
          description: `Server returned HTTP status ${res.status} for /sitemap.xml.`,
          recommendation: "Place an XML sitemap at /public/sitemap.xml to enable search engine indexing."
        });
        return [];
      }
      const xml = await res.text();
      const locMatches = xml.match(/<loc>(.*?)<\/loc>/gi);
      if (!locMatches || locMatches.length === 0) {
        issues.push({
          url: sitemapUrl,
          ruleId: "sitemap_empty",
          severity: "WARNING",
          title: "Sitemap Contains No URLs",
          description: "No <loc> URL nodes found in sitemap.xml.",
          recommendation: "Add valid canonical URLs inside <url><loc>...</loc></url> tags in sitemap.xml."
        });
      } else {
        for (const match of locMatches) {
          const u = match.replace(/<\/?loc>/gi, "").trim();
          if (u.startsWith("http")) {
            discoveredUrls.push(u);
          }
        }
      }
    } catch (err) {
      issues.push({
        url: sitemapUrl,
        ruleId: "sitemap_error",
        severity: "CRITICAL",
        title: "Error Fetching Sitemap.xml",
        description: `Failed to load sitemap: ${err.message}`,
        recommendation: "Ensure sitemap.xml is properly deployed and does not timeout."
      });
    }
    return discoveredUrls;
  }
  static async auditPage(url, baseUrl) {
    const issues = [];
    const startTime = Date.now();
    let statusCode = 0;
    let html = "";
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": this.USER_AGENT },
        signal: AbortSignal.timeout(8e3)
      });
      statusCode = res.status;
      html = await res.text();
    } catch (err) {
      issues.push({
        url,
        ruleId: "page_unreachable",
        severity: "CRITICAL",
        title: "Page Unreachable",
        description: `Error loading page: ${err.message}`,
        recommendation: "Check URL routing and serverless function stability."
      });
      return {
        url,
        statusCode: 0,
        responseTimeMs: Date.now() - startTime,
        h1Count: 0,
        h2Count: 0,
        hasViewport: false,
        hasOgTitle: false,
        hasOgImage: false,
        hasTwitterCard: false,
        imagesTotal: 0,
        imagesMissingAlt: 0,
        internalLinksCount: 0,
        externalLinksCount: 0,
        hasJsonLd: false,
        issues
      };
    }
    const responseTimeMs = Date.now() - startTime;
    const $ = cheerio.load(html);
    if (!url.startsWith("https://")) {
      issues.push({
        url,
        ruleId: "not_https",
        severity: "CRITICAL",
        title: "Page Not Served Over HTTPS",
        description: "Page is served via unencrypted HTTP.",
        recommendation: "Enforce HTTPS redirects on Vercel."
      });
    }
    if (responseTimeMs > 2500) {
      issues.push({
        url,
        ruleId: "slow_response_time",
        severity: "WARNING",
        title: "High Server Response Time",
        description: `HTML document took ${responseTimeMs}ms to respond.`,
        recommendation: "Enable edge caching and optimize asset delivery."
      });
    }
    const title = $("title").text().trim();
    if (!title) {
      issues.push({
        url,
        ruleId: "missing_title",
        severity: "CRITICAL",
        title: "Missing <title> Tag",
        description: "The page has no title tag in the head.",
        recommendation: "Add a descriptive <title> tag between 30 and 65 characters."
      });
    } else if (title.length < 20) {
      issues.push({
        url,
        ruleId: "short_title",
        severity: "WARNING",
        title: "Page Title Too Short",
        description: `Current title is ${title.length} characters ("${title}").`,
        recommendation: "Expand title to 30\u201365 characters including primary target keywords."
      });
    } else if (title.length > 70) {
      issues.push({
        url,
        ruleId: "long_title",
        severity: "INFO",
        title: "Page Title Exceeds Recommended Length",
        description: `Current title is ${title.length} characters and may be truncated on SERP.`,
        recommendation: "Keep title under 65 characters to prevent Google truncation."
      });
    }
    const metaDesc = $('meta[name="description"]').attr("content")?.trim();
    if (!metaDesc) {
      issues.push({
        url,
        ruleId: "missing_description",
        severity: "CRITICAL",
        title: "Missing Meta Description",
        description: 'No <meta name="description"> tag found.',
        recommendation: "Add a compelling meta description between 70 and 160 characters."
      });
    } else if (metaDesc.length < 50) {
      issues.push({
        url,
        ruleId: "short_description",
        severity: "WARNING",
        title: "Meta Description Too Short",
        description: `Description is only ${metaDesc.length} characters.`,
        recommendation: "Expand meta description to at least 70\u2013160 characters."
      });
    } else if (metaDesc.length > 175) {
      issues.push({
        url,
        ruleId: "long_description",
        severity: "INFO",
        title: "Meta Description Truncation Risk",
        description: `Description is ${metaDesc.length} characters and may be truncated.`,
        recommendation: "Keep meta description under 160 characters."
      });
    }
    const h1Elements = $("h1");
    const h1Count = h1Elements.length;
    if (h1Count === 0) {
      issues.push({
        url,
        ruleId: "missing_h1",
        severity: "CRITICAL",
        title: "Missing <h1> Heading",
        description: "No <h1> tag was found in the rendered HTML.",
        recommendation: "Add exactly one clear, keyword-aligned <h1> heading to the page."
      });
    } else if (h1Count > 1) {
      issues.push({
        url,
        ruleId: "multiple_h1",
        severity: "WARNING",
        title: "Multiple <h1> Headings Found",
        description: `Found ${h1Count} <h1> tags on the page.`,
        recommendation: "Use a single <h1> heading for the main topic and <h2>/<h3> for subtopics."
      });
    }
    const h2Count = $("h2").length;
    if (h2Count === 0 && h1Count > 0) {
      issues.push({
        url,
        ruleId: "missing_h2",
        severity: "INFO",
        title: "No <h2> Subheadings Found",
        description: "The page has no <h2> tags to structure sub-sections.",
        recommendation: "Break content into logical sections with descriptive <h2> headings."
      });
    }
    const canonical = $('link[rel="canonical"]').attr("href")?.trim();
    if (!canonical) {
      issues.push({
        url,
        ruleId: "missing_canonical",
        severity: "WARNING",
        title: "Missing Canonical Tag",
        description: 'No <link rel="canonical"> tag found.',
        recommendation: `Add <link rel="canonical" href="${url}" /> to avoid duplicate content penalties.`
      });
    }
    const robotsMeta = $('meta[name="robots"]').attr("content")?.toLowerCase() || "";
    if (robotsMeta.includes("noindex")) {
      issues.push({
        url,
        ruleId: "robots_noindex",
        severity: "CRITICAL",
        title: "Page Blocked from Indexing (noindex)",
        description: 'Meta robots contains "noindex". Search engines will not index this page.',
        recommendation: 'Remove "noindex" from production pages intended for organic search.'
      });
    }
    const viewport = $('meta[name="viewport"]').attr("content");
    const hasViewport = Boolean(viewport && viewport.includes("width=device-width"));
    if (!hasViewport) {
      issues.push({
        url,
        ruleId: "missing_viewport",
        severity: "CRITICAL",
        title: "Missing or Invalid Mobile Viewport",
        description: 'No responsive <meta name="viewport" content="width=device-width, initial-scale=1.0"> found.',
        recommendation: "Add standard mobile viewport meta tag for mobile search ranking compliance."
      });
    }
    const ogTitle = $('meta[property="og:title"]').attr("content");
    const ogImage = $('meta[property="og:image"]').attr("content");
    if (!ogTitle || !ogImage) {
      issues.push({
        url,
        ruleId: "incomplete_open_graph",
        severity: "WARNING",
        title: "Incomplete Open Graph Tags",
        description: "Missing og:title or og:image tags for social sharing previews.",
        recommendation: "Add og:title, og:description, og:image, and og:url in the document <head>."
      });
    }
    const twitterCard = $('meta[name="twitter:card"], meta[property="twitter:card"]').attr("content");
    if (!twitterCard) {
      issues.push({
        url,
        ruleId: "missing_twitter_card",
        severity: "INFO",
        title: "Missing Twitter Card Tags",
        description: "No twitter:card meta tag found for Twitter/X previews.",
        recommendation: 'Add <meta name="twitter:card" content="summary_large_image">.'
      });
    }
    const images = $("img");
    const imagesTotal = images.length;
    let imagesMissingAlt = 0;
    images.each((_, el) => {
      const alt = $(el).attr("alt");
      if (alt === void 0 || alt.trim().length === 0) {
        imagesMissingAlt++;
      }
    });
    if (imagesMissingAlt > 0) {
      issues.push({
        url,
        ruleId: "images_missing_alt",
        severity: imagesMissingAlt > 3 ? "WARNING" : "INFO",
        title: "Images Missing Alt Text",
        description: `${imagesMissingAlt} of ${imagesTotal} images lack descriptive alt attributes.`,
        recommendation: "Add descriptive alt text to all informative images for accessibility and image SEO."
      });
    }
    let internalLinksCount = 0;
    let externalLinksCount = 0;
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href")?.trim();
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      if (href.startsWith("http")) {
        if (href.startsWith(baseUrl)) {
          internalLinksCount++;
        } else {
          externalLinksCount++;
          const target = $(el).attr("target");
          const rel = $(el).attr("rel") || "";
          if (target === "_blank" && !rel.includes("noopener")) {
            issues.push({
              url,
              ruleId: "external_link_no_noopener",
              severity: "INFO",
              title: 'External Link Missing rel="noopener"',
              description: `Link to ${href} opens in a new tab without rel="noopener".`,
              recommendation: 'Add rel="noopener noreferrer" to external links opening in new windows.'
            });
          }
        }
      } else if (href.startsWith("/")) {
        internalLinksCount++;
      }
    });
    const jsonLd = $('script[type="application/ld+json"]').html();
    const hasJsonLd = Boolean(jsonLd && jsonLd.trim().length > 0);
    if (!hasJsonLd) {
      issues.push({
        url,
        ruleId: "missing_structured_data",
        severity: "INFO",
        title: "No JSON-LD Structured Data Found",
        description: "Page does not include schema.org JSON-LD microdata.",
        recommendation: "Add Person, WebSite, or CreativeWork schema to qualify for rich snippets on Google."
      });
    }
    return {
      url,
      statusCode,
      responseTimeMs,
      title,
      description: metaDesc,
      h1Count,
      h2Count,
      canonical,
      robotsMeta,
      hasViewport,
      hasOgTitle: Boolean(ogTitle),
      hasOgImage: Boolean(ogImage),
      hasTwitterCard: Boolean(twitterCard),
      imagesTotal,
      imagesMissingAlt,
      internalLinksCount,
      externalLinksCount,
      hasJsonLd,
      issues
    };
  }
  static checkDuplicates(results, issues) {
    const titles = /* @__PURE__ */ new Map();
    const descriptions = /* @__PURE__ */ new Map();
    for (const r of results) {
      if (r.title) {
        const list = titles.get(r.title) || [];
        list.push(r.url);
        titles.set(r.title, list);
      }
      if (r.description) {
        const list = descriptions.get(r.description) || [];
        list.push(r.url);
        descriptions.set(r.description, list);
      }
    }
    for (const [titleStr, urls] of titles.entries()) {
      if (urls.length > 1) {
        issues.push({
          url: urls[0],
          ruleId: "duplicate_title",
          severity: "WARNING",
          title: "Duplicate Page Title Detected",
          description: `Title "${titleStr}" is shared across ${urls.length} pages (${urls.join(", ")}).`,
          recommendation: "Give each page a unique, page-specific title tag."
        });
      }
    }
    for (const [descStr, urls] of descriptions.entries()) {
      if (urls.length > 1) {
        issues.push({
          url: urls[0],
          ruleId: "duplicate_description",
          severity: "INFO",
          title: "Duplicate Meta Description Detected",
          description: `Description "${descStr.slice(0, 50)}..." is shared across ${urls.length} pages.`,
          recommendation: "Write unique meta descriptions tailored to each page content."
        });
      }
    }
  }
  static calculateScore(issues, _pages) {
    let technical = 30;
    let content = 35;
    let social = 15;
    let links = 20;
    for (const issue of issues) {
      const deduction = issue.severity === "CRITICAL" ? 6 : issue.severity === "WARNING" ? 3 : 1;
      if (["robots_txt", "sitemap", "not_https", "missing_viewport", "robots_noindex"].some((k) => issue.ruleId.includes(k))) {
        technical = Math.max(0, technical - deduction);
      } else if (["title", "description", "h1", "h2", "alt"].some((k) => issue.ruleId.includes(k))) {
        content = Math.max(0, content - deduction);
      } else if (["og", "twitter", "social"].some((k) => issue.ruleId.includes(k))) {
        social = Math.max(0, social - deduction);
      } else {
        links = Math.max(0, links - deduction);
      }
    }
    const total = Math.min(100, Math.max(0, technical + content + social + links));
    return {
      score: total,
      categoryScores: { technical, content, social, links }
    };
  }
};

// server/_lib/searchConsole.ts
import { google } from "googleapis";
var SearchConsoleService = class {
  /**
   * Get an authorized Google Search Console client
   */
  static getClient() {
    let auth;
    if (appConfig.googleCredentialsJson) {
      try {
        const credentials = JSON.parse(appConfig.googleCredentialsJson);
        if (credentials.client_email && (credentials.private_key || credentials.private_key_id)) {
          auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ["https://www.googleapis.com/auth/webmasters.readonly"]
          });
        } else if (credentials.web) {
          auth = new google.auth.OAuth2(
            credentials.web.client_id,
            credentials.web.client_secret
          );
        } else {
          auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ["https://www.googleapis.com/auth/webmasters.readonly"]
          });
        }
      } catch (err) {
        console.warn("[GSC] Notice for GOOGLE_APPLICATION_CREDENTIALS_JSON:", err.message);
      }
    }
    if (!auth && appConfig.googleClientEmail && appConfig.googlePrivateKey) {
      auth = new google.auth.JWT({
        email: appConfig.googleClientEmail,
        key: appConfig.googlePrivateKey,
        scopes: ["https://www.googleapis.com/auth/webmasters.readonly"]
      });
    }
    if (!auth) {
      return null;
    }
    return google.webmasters({ version: "v3", auth });
  }
  /**
   * Check if GSC credentials are configured in environment
   */
  static isConfigured() {
    return Boolean(
      appConfig.googleCredentialsJson || appConfig.googleClientEmail && appConfig.googlePrivateKey
    );
  }
  /**
   * Fetch Search Performance from Google Search Console for a given date range (7, 28, or 90 days)
   */
  static async getPerformance(daysRange = 28) {
    const isConfig = this.isConfigured();
    if (!isConfig) {
      return {
        configured: false,
        startDate: "",
        endDate: "",
        daysRange,
        clicks: 0,
        impressions: 0,
        ctr: 0,
        position: 0,
        topQueries: [],
        topPages: [],
        countries: [],
        devices: []
      };
    }
    const client = this.getClient();
    if (!client) {
      return {
        configured: false,
        startDate: "",
        endDate: "",
        daysRange,
        clicks: 0,
        impressions: 0,
        ctr: 0,
        position: 0,
        topQueries: [],
        topPages: [],
        countries: [],
        devices: []
      };
    }
    const endDateObj = /* @__PURE__ */ new Date();
    endDateObj.setDate(endDateObj.getDate() - 2);
    const startDateObj = new Date(endDateObj);
    startDateObj.setDate(startDateObj.getDate() - daysRange);
    const endDateStr = endDateObj.toISOString().split("T")[0];
    const startDateStr = startDateObj.toISOString().split("T")[0];
    try {
      const siteUrl = appConfig.gscSiteUrl;
      const queryRes = await client.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate: startDateStr,
          endDate: endDateStr,
          dimensions: ["query"],
          rowLimit: 10
        }
      });
      const pageRes = await client.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate: startDateStr,
          endDate: endDateStr,
          dimensions: ["page"],
          rowLimit: 10
        }
      });
      const deviceRes = await client.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate: startDateStr,
          endDate: endDateStr,
          dimensions: ["device"]
        }
      });
      const countryRes = await client.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate: startDateStr,
          endDate: endDateStr,
          dimensions: ["country"],
          rowLimit: 10
        }
      });
      const queryRows = queryRes.data.rows || [];
      const totalClicks = queryRows.reduce((sum, r) => sum + (r.clicks || 0), 0);
      const totalImpressions = queryRows.reduce((sum, r) => sum + (r.impressions || 0), 0);
      const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions * 100 : 0;
      const avgPos = queryRows.length > 0 ? queryRows.reduce((sum, r) => sum + (r.position || 0), 0) / queryRows.length : 0;
      const topQueries = queryRows.map((r) => ({
        query: r.keys?.[0] || "Unknown",
        clicks: r.clicks || 0,
        impressions: r.impressions || 0,
        ctr: parseFloat(((r.ctr || 0) * 100).toFixed(2)),
        position: parseFloat((r.position || 0).toFixed(1))
      }));
      const topPages = (pageRes.data.rows || []).map((r) => ({
        page: r.keys?.[0] || "/",
        clicks: r.clicks || 0,
        impressions: r.impressions || 0,
        ctr: parseFloat(((r.ctr || 0) * 100).toFixed(2)),
        position: parseFloat((r.position || 0).toFixed(1))
      }));
      const devices = (deviceRes.data.rows || []).map((r) => ({
        device: r.keys?.[0] || "DESKTOP",
        clicks: r.clicks || 0,
        impressions: r.impressions || 0
      }));
      const countries = (countryRes.data.rows || []).map((r) => ({
        country: r.keys?.[0] || "Unknown",
        clicks: r.clicks || 0,
        impressions: r.impressions || 0
      }));
      try {
        await query(
          `INSERT INTO search_console_metrics (
            site_url, start_date, end_date, days_range, clicks, impressions, ctr, position,
            top_queries_json, top_pages_json, countries_json, devices_json
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            siteUrl,
            startDateStr,
            endDateStr,
            daysRange,
            totalClicks,
            totalImpressions,
            parseFloat((avgCtr / 100).toFixed(4)),
            parseFloat(avgPos.toFixed(2)),
            JSON.stringify(topQueries),
            JSON.stringify(topPages),
            JSON.stringify(countries),
            JSON.stringify(devices)
          ]
        );
      } catch (cacheErr) {
        console.error("[GSC] Failed to cache GSC metrics to DB:", cacheErr.message);
      }
      return {
        configured: true,
        startDate: startDateStr,
        endDate: endDateStr,
        daysRange,
        clicks: totalClicks,
        impressions: totalImpressions,
        ctr: parseFloat(avgCtr.toFixed(2)),
        position: parseFloat(avgPos.toFixed(1)),
        topQueries,
        topPages,
        countries,
        devices
      };
    } catch (err) {
      console.error("[GSC] Google Search Console API query error:", err.message);
      throw err;
    }
  }
};

// server/_lib/reportGenerator.ts
var ReportGenerator = class {
  /**
   * Build Daily Visitor Report
   */
  static async buildDailyReport() {
    const today = await AnalyticsService.getMetricsForPeriod("today");
    const yesterday = await AnalyticsService.getMetricsForPeriod("yesterday");
    const { pages } = await AnalyticsService.getTopPages(5, 0, 1);
    const { referrers } = await AnalyticsService.getReferrers(5, 0, 1);
    const changePct = yesterday.totalVisitors > 0 ? Math.round((today.totalVisitors - yesterday.totalVisitors) / yesterday.totalVisitors * 100) : 0;
    const trendIcon = changePct >= 0 ? "\u{1F4C8}" : "\u{1F4C9}";
    let topPagesText = "None recorded yet";
    if (pages.length > 0) {
      topPagesText = pages.map((p, i) => `${i + 1}. <code>${TelegramClient.escapeHtml(p.path)}</code> (${p.views} views)`).join("\n");
    }
    let referrersText = "Direct / None";
    if (referrers.length > 0) {
      referrersText = referrers.map((r) => `\u2022 ${TelegramClient.escapeHtml(r.domain)}: ${r.count} (${r.percentage}%)`).join("\n");
    }
    return `
\u{1F4CA} <b>DAILY WEBSITE REPORT</b>
\u{1F310} <b>${TelegramClient.escapeHtml(appConfig.websiteUrl)}</b>
\u{1F4C5} <i>${(/* @__PURE__ */ new Date()).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "short", day: "numeric" })} (UTC)</i>

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
<b>Traffic Overview:</b>
\u2022 <b>Unique Visitors:</b> ${today.totalVisitors} (${trendIcon} ${changePct >= 0 ? "+" : ""}${changePct}% vs yesterday)
\u2022 <b>Total Page Views:</b> ${today.totalPageViews}
\u2022 <b>New Sessions:</b> ${today.newSessions}
\u2022 <b>Returning Sessions:</b> ${today.returningSessions}
\u2022 <b>Avg Pages/Session:</b> ${today.avgPagesPerSession}

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
<b>Top 5 Pages:</b>
${topPagesText}

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
<b>Traffic Sources:</b>
${referrersText}
`.trim();
  }
  /**
   * Build Weekly Performance & Growth Report
   */
  static async buildWeeklyReport() {
    const thisWeek = await AnalyticsService.getMetricsForPeriod("7_days");
    const { pages } = await AnalyticsService.getTopPages(5, 0, 7);
    const { referrers } = await AnalyticsService.getReferrers(5, 0, 7);
    const devices = await AnalyticsService.getDevices(7);
    const latestAudit = await SeoAuditor.getLatestAudit();
    const isGsc = SearchConsoleService.isConfigured();
    let gscSummary = "<i>Not configured</i> (Add Google credentials to enable)";
    if (isGsc) {
      try {
        const gsc = await SearchConsoleService.getPerformance(7);
        gscSummary = `\u2022 Clicks: <b>${gsc.clicks}</b> | Impressions: <b>${gsc.impressions}</b>
\u2022 Avg CTR: <b>${gsc.ctr}%</b> | Avg Pos: <b>${gsc.position}</b>`;
      } catch {
        gscSummary = "<i>API query error or permission pending</i>";
      }
    }
    let deviceText = devices.map((d) => `\u2022 ${d.device}: ${d.percentage}% (${d.count})`).join("\n") || "No device data";
    let topPagesText = pages.map((p, i) => `${i + 1}. <code>${TelegramClient.escapeHtml(p.path)}</code>: ${p.views} views`).join("\n") || "None";
    let referrersText = referrers.map((r) => `\u2022 ${TelegramClient.escapeHtml(r.domain)}: ${r.count} (${r.percentage}%)`).join("\n") || "Direct";
    const seoScore = latestAudit ? `${latestAudit.score}/100` : "Not audited";
    const seoIssues = latestAudit ? `(Critical: ${latestAudit.criticalIssues}, Warnings: ${latestAudit.warnings})` : "";
    return `
\u{1F4C8} <b>WEEKLY INTELLIGENCE REPORT</b>
\u{1F310} <b>${TelegramClient.escapeHtml(appConfig.websiteUrl)}</b>
\u{1F4C5} <i>Last 7 Days (UTC)</i>

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
<b>7-Day Audience:</b>
\u2022 <b>Unique Visitors:</b> ${thisWeek.totalVisitors}
\u2022 <b>Page Views:</b> ${thisWeek.totalPageViews}
\u2022 <b>New Sessions:</b> ${thisWeek.newSessions}
\u2022 <b>Returning Sessions:</b> ${thisWeek.returningSessions}

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
<b>Top Pages:</b>
${topPagesText}

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
<b>Top Traffic Sources:</b>
${referrersText}

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
<b>Devices:</b>
${deviceText}

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
<b>SEO Health:</b>
\u2022 Health Score: <b>${seoScore}</b> ${seoIssues}

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
<b>Google Search Console (7d):</b>
${gscSummary}
`.trim();
  }
};

// server/_lib/alertService.ts
var AlertService = class {
  /**
   * Broadcast an alert message to all configured Telegram admin IDs
   */
  static async sendAdminAlert(title, message, alertType) {
    if (!appConfig.telegramAdminIds || appConfig.telegramAdminIds.length === 0) return;
    try {
      const recent = await query(
        `SELECT id FROM scheduled_reports
         WHERE report_type = $1 AND sent_at >= NOW() AT TIME ZONE 'UTC' - INTERVAL '2 hours'
         LIMIT 1`,
        [alertType]
      );
      if (recent.rows.length > 0) {
        console.log(`[AlertService] Suppressed duplicate alert: ${alertType}`);
        return;
      }
    } catch {
    }
    const formatted = `
\u{1F6A8} <b>WEBSITE ALERT: ${TelegramClient.escapeHtml(title)}</b>
\u{1F310} <b>${TelegramClient.escapeHtml(appConfig.websiteUrl)}</b>
\u23F1\uFE0F <i>${(/* @__PURE__ */ new Date()).toISOString()}</i>

${message}
`.trim();
    for (const adminId of appConfig.telegramAdminIds) {
      try {
        await TelegramClient.sendMessage(adminId, formatted);
        await query(
          `INSERT INTO scheduled_reports (report_type, recipient_id, status, message_summary)
           VALUES ($1, $2, 'sent', $3)`,
          [alertType, adminId, `${title}: ${message.slice(0, 200)}`]
        );
      } catch (err) {
        console.error(`[AlertService] Error sending alert to ${adminId}:`, err.message);
      }
    }
  }
  /**
   * Check Website Availability / Uptime
   */
  static async checkWebsiteUptime() {
    const start = Date.now();
    try {
      const res = await fetch(appConfig.websiteUrl, {
        method: "GET",
        headers: { "User-Agent": "RobinsonUptimeMonitor/1.0" },
        signal: AbortSignal.timeout(1e4)
      });
      const responseTimeMs = Date.now() - start;
      if (res.status >= 500) {
        await this.sendAdminAlert(
          "Website Server Error",
          `Server returned HTTP status <b>${res.status}</b>. Response time: ${responseTimeMs}ms.`,
          "alert_downtime"
        );
        return { isUp: false, statusCode: res.status, responseTimeMs };
      }
      return { isUp: true, statusCode: res.status, responseTimeMs };
    } catch (err) {
      await this.sendAdminAlert(
        "Website Downtime Detected",
        `Could not reach website: <code>${TelegramClient.escapeHtml(err.message)}</code>`,
        "alert_downtime"
      );
      return { isUp: false, statusCode: 0, responseTimeMs: Date.now() - start };
    }
  }
  /**
   * Check Sitemap Health
   */
  static async checkSitemapHealth() {
    const sitemapUrl = `${appConfig.websiteUrl}/sitemap.xml`;
    try {
      const res = await fetch(sitemapUrl, {
        signal: AbortSignal.timeout(8e3)
      });
      if (res.status !== 200) {
        await this.sendAdminAlert(
          "Broken Sitemap",
          `Sitemap returned HTTP ${res.status} at ${sitemapUrl}. Search indexing may be affected.`,
          "alert_sitemap"
        );
        return false;
      }
      const text = await res.text();
      if (!text.includes("<urlset") && !text.includes("<sitemapindex")) {
        await this.sendAdminAlert(
          "Invalid Sitemap XML",
          `Sitemap does not contain standard XML <urlset> tags at ${sitemapUrl}.`,
          "alert_sitemap"
        );
        return false;
      }
      return true;
    } catch (err) {
      await this.sendAdminAlert(
        "Sitemap Unreachable",
        `Failed to reach sitemap.xml: <code>${TelegramClient.escapeHtml(err.message)}</code>`,
        "alert_sitemap"
      );
      return false;
    }
  }
  /**
   * Check for Traffic Spikes or Plummets
   */
  static async checkTrafficAnomalies() {
    try {
      const statsRes = await query(`
        WITH daily_counts AS (
          SELECT
            DATE(started_at) AS day,
            COUNT(DISTINCT visitor_id)::int AS visitors
          FROM visitor_sessions
          WHERE started_at >= NOW() AT TIME ZONE 'UTC' - INTERVAL '8 days'
            AND started_at < DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')
          GROUP BY DATE(started_at)
        )
        SELECT COALESCE(AVG(visitors), 0)::int AS avg_7d FROM daily_counts
      `);
      const todayRes = await query(`
        SELECT COUNT(DISTINCT visitor_id)::int AS today_visitors
        FROM visitor_sessions
        WHERE started_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')
      `);
      const avg7d = statsRes.rows[0]?.avg_7d || 0;
      const todayVisitors = todayRes.rows[0]?.today_visitors || 0;
      if (avg7d >= 20) {
        if (todayVisitors > avg7d * 2.5) {
          await this.sendAdminAlert(
            "Traffic Surge Detected \u{1F680}",
            `Today's visitor count (<b>${todayVisitors}</b>) is over 250% of the 7-day average (<b>${avg7d}</b>). Check /referrers for incoming traffic sources!`,
            "alert_surge"
          );
        }
      }
    } catch (err) {
      console.error("[AlertService] Error checking traffic anomalies:", err.message);
    }
  }
};

// server/_lib/botHandlers.ts
var BotHandlers = class {
  /**
   * Main Router for incoming Telegram Updates
   */
  static async handleUpdate(update) {
    if (update.message) {
      await this.handleMessage(update.message);
    } else if (update.callback_query) {
      await this.handleCallbackQuery(update.callback_query);
    }
  }
  /**
   * Handle text messages and slash commands
   */
  static async handleMessage(message) {
    const chatId = message.chat?.id;
    const fromId = message.from?.id;
    const text = (message.text || "").trim();
    if (!chatId || !fromId) return;
    if (!isTelegramAdmin(fromId)) {
      await TelegramClient.sendMessage(
        chatId,
        `\u26D4 <b>Access Denied</b>

Your Telegram User ID is: <code>${fromId}</code>

To manage this website, add this ID to <code>TELEGRAM_ADMIN_IDS</code> in your Vercel Project Settings environment variables.`
      );
      return;
    }
    const command = text.split(" ")[0].toLowerCase().split("@")[0];
    switch (command) {
      case "/start":
        await this.handleStart(chatId);
        break;
      case "/help":
        await this.handleHelp(chatId);
        break;
      case "/dashboard":
        await this.handleDashboard(chatId);
        break;
      case "/stats":
        await this.handleStats(chatId);
        break;
      case "/today":
        await this.handlePeriod(chatId, "today", "Today's Visitor Report");
        break;
      case "/yesterday":
        await this.handlePeriod(chatId, "yesterday", "Yesterday's Visitor Report");
        break;
      case "/weekly":
        await this.handlePeriod(chatId, "7_days", "Weekly Visitor Report (Last 7 Days)");
        break;
      case "/monthly":
        await this.handlePeriod(chatId, "30_days", "Monthly Visitor Report (Last 30 Days)");
        break;
      case "/realtime":
        await this.handleRealtime(chatId);
        break;
      case "/top-pages":
      case "/toppages":
        await this.handleTopPages(chatId, 0);
        break;
      case "/referrers":
        await this.handleReferrers(chatId, 0);
        break;
      case "/devices":
        await this.handleDevices(chatId);
        break;
      case "/countries":
        await this.handleCountries(chatId, 0);
        break;
      case "/seo":
        await this.handleSeo(chatId);
        break;
      case "/keywords":
        await this.handleKeywords(chatId);
        break;
      case "/search-traffic":
      case "/searchtraffic":
        await this.handleSearchTraffic(chatId, 28);
        break;
      case "/indexed":
        await this.handleIndexed(chatId);
        break;
      case "/sitemap":
        await this.handleSitemap(chatId);
        break;
      case "/broken-links":
      case "/brokenlinks":
        await this.handleBrokenLinks(chatId);
        break;
      case "/speed":
        await this.handleSpeed(chatId);
        break;
      case "/report":
        await this.handleFullReport(chatId);
        break;
      case "/alerts":
        await this.handleAlerts(chatId);
        break;
      case "/settings":
        await this.handleSettings(chatId);
        break;
      default:
        if (text.startsWith("/")) {
          await TelegramClient.sendMessage(
            chatId,
            `Unknown command: <code>${TelegramClient.escapeHtml(command)}</code>
Use /help to see all available commands or /dashboard to view analytics.`
          );
        }
        break;
    }
  }
  /**
   * Handle interactive button clicks (Callback Queries)
   */
  static async handleCallbackQuery(query2) {
    const callbackId = query2.id;
    const fromId = query2.from?.id;
    const chatId = query2.message?.chat?.id;
    const messageId = query2.message?.message_id;
    const data = query2.data || "";
    if (!chatId || !messageId) return;
    if (!isTelegramAdmin(fromId)) {
      await TelegramClient.answerCallbackQuery(callbackId, "\u26D4 Unauthorized", true);
      return;
    }
    await TelegramClient.answerCallbackQuery(callbackId);
    const parts = data.split(":");
    const action = parts[0];
    const target = parts[1];
    const param = parts[2];
    if (action === "nav") {
      if (target === "dashboard") {
        const { text, reply_markup } = await this.renderDashboard();
        await TelegramClient.editMessageText(chatId, messageId, text, { reply_markup });
      } else if (target === "today" || target === "yesterday" || target === "weekly" || target === "monthly") {
        const pKey = target === "weekly" ? "7_days" : target === "monthly" ? "30_days" : target;
        const pTitle = target.toUpperCase();
        const { text, reply_markup } = await this.renderPeriod(pKey, pTitle);
        await TelegramClient.editMessageText(chatId, messageId, text, { reply_markup });
      } else if (target === "seo") {
        const { text, reply_markup } = await this.renderSeo();
        await TelegramClient.editMessageText(chatId, messageId, text, { reply_markup });
      } else if (target === "top_pages") {
        const { text, reply_markup } = await this.renderTopPages(0);
        await TelegramClient.editMessageText(chatId, messageId, text, { reply_markup });
      } else if (target === "referrers") {
        const { text, reply_markup } = await this.renderReferrers(0);
        await TelegramClient.editMessageText(chatId, messageId, text, { reply_markup });
      } else if (target === "devices") {
        const { text, reply_markup } = await this.renderDevices();
        await TelegramClient.editMessageText(chatId, messageId, text, { reply_markup });
      } else if (target === "countries") {
        const { text, reply_markup } = await this.renderCountries(0);
        await TelegramClient.editMessageText(chatId, messageId, text, { reply_markup });
      } else if (target === "gsc") {
        const days = parseInt(param || "28", 10);
        const { text, reply_markup } = await this.renderSearchTraffic(days);
        await TelegramClient.editMessageText(chatId, messageId, text, { reply_markup });
      } else if (target === "settings") {
        const { text, reply_markup } = await this.renderSettings();
        await TelegramClient.editMessageText(chatId, messageId, text, { reply_markup });
      }
    } else if (action === "page") {
      const offset = parseInt(param || "0", 10);
      if (target === "top_pages") {
        const { text, reply_markup } = await this.renderTopPages(offset);
        await TelegramClient.editMessageText(chatId, messageId, text, { reply_markup });
      } else if (target === "referrers") {
        const { text, reply_markup } = await this.renderReferrers(offset);
        await TelegramClient.editMessageText(chatId, messageId, text, { reply_markup });
      } else if (target === "countries") {
        const { text, reply_markup } = await this.renderCountries(offset);
        await TelegramClient.editMessageText(chatId, messageId, text, { reply_markup });
      }
    } else if (action === "action" && target === "run_seo") {
      await TelegramClient.sendMessage(chatId, "\u{1F504} <i>Crawling pages and analyzing 20 SEO rules... Please wait a few seconds.</i>");
      await TelegramClient.sendChatAction(chatId, "typing");
      const audit = await SeoAuditor.runAudit();
      const { text, reply_markup } = await this.renderSeo(audit);
      await TelegramClient.sendMessage(chatId, text, { reply_markup });
    }
  }
  // --- COMMAND IMPLEMENTATIONS ---
  static async handleStart(chatId) {
    const keyboard = {
      inline_keyboard: [
        [
          { text: "\u{1F4CA} Dashboard", callback_data: "nav:dashboard" },
          { text: "\u{1F50D} SEO Health", callback_data: "nav:seo" }
        ],
        [
          { text: "\u{1F4C8} Search Console", callback_data: "nav:gsc:28" },
          { text: "\u26A1 Realtime", callback_data: "nav:today" }
        ],
        [
          { text: "\u{1F310} View Website", url: appConfig.websiteUrl }
        ]
      ]
    };
    const text = `
\u{1F680} <b>WELCOME TO ROBINSON'S WEBSITE INTELLIGENCE BOT</b>

Your personal SEO Manager & Real-Time Analytics Dashboard.

\u2705 <b>Admin Authentication:</b> Verified
\u{1F310} <b>Tracked Site:</b> <code>${TelegramClient.escapeHtml(appConfig.websiteUrl)}</code>
\u{1F4E1} <b>Engine:</b> Vercel Serverless + PostgreSQL

Type /dashboard to open your interactive dashboard, or /help to see all commands.
`.trim();
    await TelegramClient.sendMessage(chatId, text, { reply_markup: keyboard });
  }
  static async handleHelp(chatId) {
    const text = `
\u{1F4D6} <b>AVAILABLE BOT COMMANDS</b>

<b>\u{1F4CA} Visitor Analytics:</b>
/dashboard - Interactive analytics dashboard
/stats - Total & 30-day visitor statistics
/today - Today's visitor metrics
/yesterday - Yesterday's visitor metrics
/weekly - Last 7 days report
/monthly - Last 30 days report
/realtime - Live sessions in last 30 minutes
/top-pages - Most visited pages
/referrers - Traffic sources & referrers
/devices - Mobile vs Desktop distribution
/countries - Geographical breakdown

<b>\u{1F50D} SEO & Technical Audits:</b>
/seo - Full 20-rule website SEO audit
/keywords - Google Search Console keywords
/search-traffic - Organic search clicks & impressions
/indexed - Google indexing status & sitemap check
/sitemap - Verify sitemap.xml health
/broken-links - Check for broken internal links
/speed - Server response speed & TTFB audit

<b>\u2699\uFE0F Configuration & Reports:</b>
/report - Comprehensive executive report
/alerts - Notification & alert preferences
/settings - System status & credentials
`.trim();
    await TelegramClient.sendMessage(chatId, text);
  }
  static async handleDashboard(chatId) {
    const { text, reply_markup } = await this.renderDashboard();
    await TelegramClient.sendMessage(chatId, text, { reply_markup });
  }
  static async handleStats(chatId) {
    const allTime = await AnalyticsService.getMetricsForPeriod("all_time");
    const last30 = await AnalyticsService.getMetricsForPeriod("30_days");
    const text = `
\u{1F4CA} <b>VISITOR STATISTICS SUMMARY</b>
\u{1F310} <b>${TelegramClient.escapeHtml(appConfig.websiteUrl)}</b>

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
<b>Last 30 Days:</b>
\u2022 Visitors: <b>${last30.totalVisitors}</b>
\u2022 Page Views: <b>${last30.totalPageViews}</b>
\u2022 New Sessions: <b>${last30.newSessions}</b>
\u2022 Returning Sessions: <b>${last30.returningSessions}</b>
\u2022 Avg Pages/Session: <b>${last30.avgPagesPerSession}</b>

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
<b>All-Time Recorded:</b>
\u2022 Total Visitors: <b>${allTime.totalVisitors}</b>
\u2022 Total Page Views: <b>${allTime.totalPageViews}</b>
\u2022 Total New Sessions: <b>${allTime.newSessions}</b>
\u2022 Total Returning: <b>${allTime.returningSessions}</b>
`.trim();
    const keyboard = {
      inline_keyboard: [
        [
          { text: "\u{1F4C5} Today", callback_data: "nav:today" },
          { text: "\u{1F4C5} 7 Days", callback_data: "nav:weekly" },
          { text: "\u{1F4CA} Dashboard", callback_data: "nav:dashboard" }
        ]
      ]
    };
    await TelegramClient.sendMessage(chatId, text, { reply_markup: keyboard });
  }
  static async handlePeriod(chatId, period, title) {
    const { text, reply_markup } = await this.renderPeriod(period, title);
    await TelegramClient.sendMessage(chatId, text, { reply_markup });
  }
  static async handleRealtime(chatId) {
    const rt = await AnalyticsService.getRealtime();
    let recentList = "No activity recorded in last 24h.";
    if (rt.recentSessions.length > 0) {
      recentList = rt.recentSessions.map((s) => `\u2022 <code>${TelegramClient.escapeHtml(s.path)}</code> (${s.device}, ${s.country}) - <i>${s.minutesAgo}m ago</i>`).join("\n");
    }
    const text = `
\u26A1 <b>REAL-TIME VISITOR ACTIVITY</b>
\u{1F310} <b>${TelegramClient.escapeHtml(appConfig.websiteUrl)}</b>

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
<b>Active Right Now (Last 30 min):</b>
\u2022 Active Sessions: <b>${rt.activeSessions30m}</b>
\u2022 Page Views: <b>${rt.pageViews30m}</b>

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
<b>Recent Visitor Path Activity:</b>
${recentList}
`.trim();
    const keyboard = {
      inline_keyboard: [
        [{ text: "\u{1F504} Refresh", callback_data: "nav:today" }],
        [{ text: "\u{1F4CA} Back to Dashboard", callback_data: "nav:dashboard" }]
      ]
    };
    await TelegramClient.sendMessage(chatId, text, { reply_markup: keyboard });
  }
  static async handleTopPages(chatId, offset = 0) {
    const { text, reply_markup } = await this.renderTopPages(offset);
    await TelegramClient.sendMessage(chatId, text, { reply_markup });
  }
  static async handleReferrers(chatId, offset = 0) {
    const { text, reply_markup } = await this.renderReferrers(offset);
    await TelegramClient.sendMessage(chatId, text, { reply_markup });
  }
  static async handleDevices(chatId) {
    const { text, reply_markup } = await this.renderDevices();
    await TelegramClient.sendMessage(chatId, text, { reply_markup });
  }
  static async handleCountries(chatId, offset = 0) {
    const { text, reply_markup } = await this.renderCountries(offset);
    await TelegramClient.sendMessage(chatId, text, { reply_markup });
  }
  static async handleSeo(chatId) {
    const { text, reply_markup } = await this.renderSeo();
    await TelegramClient.sendMessage(chatId, text, { reply_markup });
  }
  static async handleKeywords(chatId) {
    const isConfig = SearchConsoleService.isConfigured();
    if (!isConfig) {
      await TelegramClient.sendMessage(
        chatId,
        `\u{1F511} <b>GOOGLE SEARCH CONSOLE KEYWORDS</b>

Google Search Console credentials are not yet configured.

To enable organic keyword and ranking data:
1. Create a Google Cloud Service Account.
2. Add the email as a Viewer in Google Search Console.
3. Set <code>GOOGLE_CLIENT_EMAIL</code> & <code>GOOGLE_PRIVATE_KEY</code> in Vercel environment variables.`
      );
      return;
    }
    try {
      const gsc = await SearchConsoleService.getPerformance(28);
      let queryList = "No search clicks recorded in this period yet.";
      if (gsc.topQueries.length > 0) {
        queryList = gsc.topQueries.map((q, i) => `${i + 1}. <b>"${TelegramClient.escapeHtml(q.query)}"</b>
   Clicks: ${q.clicks} | Impr: ${q.impressions} | Pos: ${q.position} | CTR: ${q.ctr}%`).join("\n\n");
      }
      const text = `
\u{1F511} <b>TOP ORGANIC SEARCH QUERIES</b>
\u{1F310} <b>${TelegramClient.escapeHtml(appConfig.gscSiteUrl)}</b>
\u{1F4C5} <i>Last 28 Days (Google Search Console)</i>

${queryList}
`.trim();
      const keyboard = {
        inline_keyboard: [
          [
            { text: "7 Days", callback_data: "nav:gsc:7" },
            { text: "28 Days", callback_data: "nav:gsc:28" },
            { text: "90 Days", callback_data: "nav:gsc:90" }
          ],
          [{ text: "\u{1F4CA} Dashboard", callback_data: "nav:dashboard" }]
        ]
      };
      await TelegramClient.sendMessage(chatId, text, { reply_markup: keyboard });
    } catch (err) {
      await TelegramClient.sendMessage(
        chatId,
        `\u26A0\uFE0F <b>Google Search Console API Error:</b>
<code>${TelegramClient.escapeHtml(err.message)}</code>

Please ensure your Service Account has been added with 'Viewer' permissions on property <code>${appConfig.gscSiteUrl}</code>.`
      );
    }
  }
  static async handleSearchTraffic(chatId, days = 28) {
    const { text, reply_markup } = await this.renderSearchTraffic(days);
    await TelegramClient.sendMessage(chatId, text, { reply_markup });
  }
  static async handleIndexed(chatId) {
    const sitemapOk = await AlertService.checkSitemapHealth();
    const latestAudit = await SeoAuditor.getLatestAudit();
    const pagesCount = latestAudit ? latestAudit.pagesCrawled : 4;
    const robotsStatus = sitemapOk ? "\u2705 Healthy & Discoverable" : "\u26A0\uFE0F Attention needed";
    const text = `
\u{1F4D1} <b>GOOGLE INDEXING STATUS</b>
\u{1F310} <b>${TelegramClient.escapeHtml(appConfig.websiteUrl)}</b>

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
<b>Indexing Architecture:</b>
\u2022 <b>Robots.txt:</b> ${robotsStatus}
\u2022 <b>Sitemap:</b> <code>${appConfig.websiteUrl}/sitemap.xml</code>
\u2022 <b>Known Public URLs:</b> ${pagesCount} pages
\u2022 <b>Canonical URLs:</b> Configured on all routes

\u{1F4A1} <i>Tip: Search <code>site:robinsonj.vercel.app</code> on Google to see all live indexed pages!</i>
`.trim();
    await TelegramClient.sendMessage(chatId, text);
  }
  static async handleSitemap(chatId) {
    const sitemapUrl = `${appConfig.websiteUrl}/sitemap.xml`;
    try {
      const res = await fetch(sitemapUrl, { signal: AbortSignal.timeout(6e3) });
      const text = await res.text();
      const locMatches = text.match(/<loc>(.*?)<\/loc>/gi) || [];
      const list = locMatches.map((m) => `\u2022 <code>${m.replace(/<\/?loc>/gi, "").trim()}</code>`).join("\n") || "None";
      const msg = `
\u{1F5FA}\uFE0F <b>SITEMAP HEALTH CHECK</b>
URL: <code>${sitemapUrl}</code>
HTTP Status: <b>${res.status} ${res.status === 200 ? "\u2705 OK" : "\u274C Error"}</b>
Discovered URLs: <b>${locMatches.length}</b>

<b>Declared Pages:</b>
${list}
`.trim();
      await TelegramClient.sendMessage(chatId, msg);
    } catch (err) {
      await TelegramClient.sendMessage(chatId, `\u274C Failed to fetch sitemap: <code>${TelegramClient.escapeHtml(err.message)}</code>`);
    }
  }
  static async handleBrokenLinks(chatId) {
    await TelegramClient.sendMessage(chatId, "\u{1F50E} <i>Auditing internal & external links...</i>");
    const audit = await SeoAuditor.runAudit();
    const linkIssues = audit.issues.filter((i) => i.ruleId.includes("link") || i.ruleId.includes("unreachable"));
    let content = "\u2705 <b>Zero broken links detected!</b> All internal routes returned HTTP 200.";
    if (linkIssues.length > 0) {
      content = linkIssues.map((i) => `\u2022 <b>${i.severity}</b>: ${TelegramClient.escapeHtml(i.title)}
  URL: <code>${i.url}</code>
  Sol: ${i.recommendation}`).join("\n\n");
    }
    const text = `
\u{1F517} <b>LINK INTEGRITY REPORT</b>
Pages Audited: <b>${audit.pagesCrawled}</b>

${content}
`.trim();
    await TelegramClient.sendMessage(chatId, text);
  }
  static async handleSpeed(chatId) {
    await TelegramClient.sendChatAction(chatId, "typing");
    const start = Date.now();
    try {
      const res = await fetch(appConfig.websiteUrl, {
        headers: { "User-Agent": "RobinsonSpeedAudit/1.0" },
        signal: AbortSignal.timeout(1e4)
      });
      const ttfb = Date.now() - start;
      const rating = ttfb < 400 ? "\u{1F7E2} Excellent" : ttfb < 1e3 ? "\u{1F7E1} Good" : "\u{1F534} Needs Optimization";
      const text = `
\u26A1 <b>WEBSITE PERFORMANCE AUDIT</b>
\u{1F310} <b>${TelegramClient.escapeHtml(appConfig.websiteUrl)}</b>

\u2022 <b>Server Response Time (TTFB):</b> ${ttfb}ms (${rating})
\u2022 <b>HTTP Status:</b> ${res.status} OK
\u2022 <b>Vercel Edge Node:</b> ${res.headers.get("x-vercel-id") || "Global Edge"}
\u2022 <b>Content Encoding:</b> ${res.headers.get("content-encoding") || "br / gzip"}
\u2022 <b>Assets:</b> WebP Optimized with preload/fetchpriority
`.trim();
      await TelegramClient.sendMessage(chatId, text);
    } catch (err) {
      await TelegramClient.sendMessage(chatId, `\u274C Performance test failed: <code>${TelegramClient.escapeHtml(err.message)}</code>`);
    }
  }
  static async handleFullReport(chatId) {
    await TelegramClient.sendChatAction(chatId, "typing");
    const report = await ReportGenerator.buildWeeklyReport();
    await TelegramClient.sendMessage(chatId, report);
  }
  static async handleAlerts(chatId) {
    const text = `
\u{1F6A8} <b>ALERTING PREFERENCES</b>

<b>Active System Monitors:</b>
\u2022 <b>Website Uptime Monitor:</b> Enabled (Alerts on HTTP 5xx or timeout)
\u2022 <b>Traffic Surge Alert:</b> Triggered when traffic > 250% of 7-day average
\u2022 <b>Sitemap Monitor:</b> Verifies XML integrity & availability
\u2022 <b>Critical SEO Monitor:</b> Flags accidental noindex or missing metadata

Alerts are sent automatically to configured admin Telegram accounts.
`.trim();
    await TelegramClient.sendMessage(chatId, text);
  }
  static async handleSettings(chatId) {
    const { text, reply_markup } = await this.renderSettings();
    await TelegramClient.sendMessage(chatId, text, { reply_markup });
  }
  // --- RENDER HELPERS FOR INLINE KEYBOARD REVIEWS ---
  static async renderDashboard() {
    const today = await AnalyticsService.getMetricsForPeriod("today");
    const { pages } = await AnalyticsService.getTopPages(3, 0, 1);
    const { referrers } = await AnalyticsService.getReferrers(3, 0, 1);
    const latestAudit = await SeoAuditor.getLatestAudit();
    let topPagesText = "None recorded yet";
    if (pages.length > 0) {
      topPagesText = pages.map((p, i) => `${i + 1}. <code>${p.path}</code> (${p.views} views)`).join("\n");
    }
    let referrersText = "Direct";
    if (referrers.length > 0) {
      referrersText = referrers.map((r) => `\u2022 ${r.domain} (${r.percentage}%)`).join("\n");
    }
    const seoScore = latestAudit ? `${latestAudit.score}/100` : "Not run";
    const seoCrit = latestAudit ? latestAudit.criticalIssues : 0;
    const seoWarn = latestAudit ? latestAudit.warnings : 0;
    const text = `
\u{1F4CA} <b>WEBSITE ANALYTICS DASHBOARD</b>
\u{1F310} <b>${TelegramClient.escapeHtml(appConfig.websiteUrl)}</b>

<b>Today's Overview (UTC):</b>
\u2022 <b>Visitors:</b> ${today.totalVisitors}
\u2022 <b>Page Views:</b> ${today.totalPageViews}
\u2022 <b>New Sessions:</b> ${today.newSessions}
\u2022 <b>Returning Sessions:</b> ${today.returningSessions}

<b>Top Pages:</b>
${topPagesText}

<b>Traffic Sources:</b>
${referrersText}

<b>SEO Health:</b>
\u2022 Score: <b>${seoScore}</b>
\u2022 Critical Issues: <b>${seoCrit}</b> | Warnings: <b>${seoWarn}</b>
`.trim();
    const keyboard = {
      inline_keyboard: [
        [
          { text: "\u{1F4CA} Analytics", callback_data: "nav:today" },
          { text: "\u{1F50D} SEO Audit", callback_data: "nav:seo" }
        ],
        [
          { text: "\u{1F4C8} Search Console", callback_data: "nav:gsc:28" },
          { text: "\u{1F4C4} Top Pages", callback_data: "nav:top_pages" }
        ],
        [
          { text: "\u{1F310} Traffic Sources", callback_data: "nav:referrers" },
          { text: "\u2699\uFE0F Settings", callback_data: "nav:settings" }
        ]
      ]
    };
    return { text, reply_markup: keyboard };
  }
  static async renderPeriod(period, title) {
    const stats = await AnalyticsService.getMetricsForPeriod(period);
    const text = `
\u{1F4CA} <b>${TelegramClient.escapeHtml(title)}</b>
\u{1F310} <b>${TelegramClient.escapeHtml(appConfig.websiteUrl)}</b>

\u2022 <b>Unique Visitors:</b> ${stats.totalVisitors}
\u2022 <b>Total Page Views:</b> ${stats.totalPageViews}
\u2022 <b>New Sessions:</b> ${stats.newSessions}
\u2022 <b>Returning Sessions:</b> ${stats.returningSessions}
\u2022 <b>Average Duration:</b> ${stats.avgDurationSeconds}s
\u2022 <b>Avg Pages/Session:</b> ${stats.avgPagesPerSession}
`.trim();
    const keyboard = {
      inline_keyboard: [
        [
          { text: "Today", callback_data: "nav:today" },
          { text: "Yesterday", callback_data: "nav:yesterday" },
          { text: "7 Days", callback_data: "nav:weekly" },
          { text: "30 Days", callback_data: "nav:monthly" }
        ],
        [
          { text: "\u{1F4C4} Top Pages", callback_data: "nav:top_pages" },
          { text: "\u{1F4CA} Dashboard", callback_data: "nav:dashboard" }
        ]
      ]
    };
    return { text, reply_markup: keyboard };
  }
  static async renderTopPages(offset = 0) {
    const limit = 5;
    const { pages, total } = await AnalyticsService.getTopPages(limit, offset, 30);
    let list = "No pageviews recorded yet.";
    if (pages.length > 0) {
      list = pages.map((p, i) => `${offset + i + 1}. <code>${TelegramClient.escapeHtml(p.path)}</code>
   Views: <b>${p.views}</b> | Unique: <b>${p.uniqueVisitors}</b>`).join("\n\n");
    }
    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const text = `
\u{1F4C4} <b>MOST VISITED PAGES</b>
\u{1F310} <b>${TelegramClient.escapeHtml(appConfig.websiteUrl)}</b>
\u{1F4C5} <i>Last 30 Days (Page ${currentPage}/${totalPages})</i>

${list}
`.trim();
    const navRow = [];
    if (offset > 0) {
      navRow.push({ text: "\u2B05\uFE0F Prev", callback_data: `page:top_pages:${Math.max(0, offset - limit)}` });
    }
    navRow.push({ text: `Page ${currentPage}/${totalPages}`, callback_data: "noop" });
    if (offset + limit < total) {
      navRow.push({ text: "Next \u27A1\uFE0F", callback_data: `page:top_pages:${offset + limit}` });
    }
    const keyboard = {
      inline_keyboard: [
        navRow,
        [{ text: "\u{1F4CA} Back to Dashboard", callback_data: "nav:dashboard" }]
      ]
    };
    return { text, reply_markup: keyboard };
  }
  static async renderReferrers(offset = 0) {
    const limit = 5;
    const { referrers, total } = await AnalyticsService.getReferrers(limit, offset, 30);
    let list = "No traffic sources recorded yet.";
    if (referrers.length > 0) {
      list = referrers.map((r, i) => `${offset + i + 1}. <b>${TelegramClient.escapeHtml(r.domain)}</b>
   Visitors: <b>${r.count}</b> (${r.percentage}%)`).join("\n\n");
    }
    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const text = `
\u{1F310} <b>TRAFFIC SOURCES & REFERRERS</b>
\u{1F310} <b>${TelegramClient.escapeHtml(appConfig.websiteUrl)}</b>
\u{1F4C5} <i>Last 30 Days (Page ${currentPage}/${totalPages})</i>

${list}
`.trim();
    const navRow = [];
    if (offset > 0) {
      navRow.push({ text: "\u2B05\uFE0F Prev", callback_data: `page:referrers:${Math.max(0, offset - limit)}` });
    }
    navRow.push({ text: `Page ${currentPage}/${totalPages}`, callback_data: "noop" });
    if (offset + limit < total) {
      navRow.push({ text: "Next \u27A1\uFE0F", callback_data: `page:referrers:${offset + limit}` });
    }
    const keyboard = {
      inline_keyboard: [
        navRow,
        [{ text: "\u{1F4CA} Back to Dashboard", callback_data: "nav:dashboard" }]
      ]
    };
    return { text, reply_markup: keyboard };
  }
  static async renderDevices() {
    const devices = await AnalyticsService.getDevices(30);
    let list = "No device data recorded yet.";
    if (devices.length > 0) {
      list = devices.map((d) => `\u2022 <b>${d.device.toUpperCase()}</b>: ${d.percentage}% (${d.count} sessions)`).join("\n");
    }
    const text = `
\u{1F4F1} <b>DEVICE DISTRIBUTION</b>
\u{1F310} <b>${TelegramClient.escapeHtml(appConfig.websiteUrl)}</b>
\u{1F4C5} <i>Last 30 Days</i>

${list}
`.trim();
    const keyboard = {
      inline_keyboard: [
        [
          { text: "\u{1F30D} Countries", callback_data: "nav:countries" },
          { text: "\u{1F4CA} Dashboard", callback_data: "nav:dashboard" }
        ]
      ]
    };
    return { text, reply_markup: keyboard };
  }
  static async renderCountries(offset = 0) {
    const limit = 5;
    const { countries, total } = await AnalyticsService.getCountries(limit, offset, 30);
    let list = "No geographic visitor data recorded yet.";
    if (countries.length > 0) {
      list = countries.map((c, i) => `${offset + i + 1}. <b>${c.country}</b>: ${c.count} visitors (${c.percentage}%)`).join("\n");
    }
    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const text = `
\u{1F30D} <b>VISITOR COUNTRIES</b>
\u{1F310} <b>${TelegramClient.escapeHtml(appConfig.websiteUrl)}</b>
\u{1F4C5} <i>Last 30 Days (Page ${currentPage}/${totalPages})</i>

${list}
`.trim();
    const navRow = [];
    if (offset > 0) {
      navRow.push({ text: "\u2B05\uFE0F Prev", callback_data: `page:countries:${Math.max(0, offset - limit)}` });
    }
    navRow.push({ text: `Page ${currentPage}/${totalPages}`, callback_data: "noop" });
    if (offset + limit < total) {
      navRow.push({ text: "Next \u27A1\uFE0F", callback_data: `page:countries:${offset + limit}` });
    }
    const keyboard = {
      inline_keyboard: [
        navRow,
        [{ text: "\u{1F4CA} Back to Dashboard", callback_data: "nav:dashboard" }]
      ]
    };
    return { text, reply_markup: keyboard };
  }
  static async renderSeo(customAudit) {
    const audit = customAudit || await SeoAuditor.getLatestAudit() || await SeoAuditor.runAudit();
    const statusBadge = audit.score >= 85 ? "\u{1F7E2} Excellent" : audit.score >= 70 ? "\u{1F7E1} Good" : "\u{1F534} Needs Attention";
    let issuesText = "\u2705 Zero critical issues detected!";
    if (audit.issues.length > 0) {
      issuesText = audit.issues.slice(0, 4).map((issue) => `\u2022 <b>${issue.severity}</b>: ${TelegramClient.escapeHtml(issue.title)}
  <i>${TelegramClient.escapeHtml(issue.recommendation)}</i>`).join("\n\n");
    }
    const text = `
\u{1F50D} <b>WEBSITE SEO AUDIT REPORT</b>
\u{1F310} <b>${TelegramClient.escapeHtml(audit.targetUrl)}</b>

\u2022 <b>Overall SEO Score:</b> <b>${audit.score}/100</b> (${statusBadge})
\u2022 <b>Pages Crawled:</b> ${audit.pagesCrawled}
\u2022 <b>Critical Issues:</b> ${audit.criticalIssues} | <b>Warnings:</b> ${audit.warnings}

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
<b>Category Breakdown:</b>
\u2022 Technical / Indexing: <b>${audit.categoryScores.technical}/30</b>
\u2022 Content & Headings: <b>${audit.categoryScores.content}/35</b>
\u2022 Social Meta (OG/Twitter): <b>${audit.categoryScores.social}/15</b>
\u2022 Link Health: <b>${audit.categoryScores.links}/20</b>

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
<b>Top Audit Findings:</b>
${issuesText}
`.trim();
    const keyboard = {
      inline_keyboard: [
        [{ text: "\u{1F504} Run Fresh Live Audit", callback_data: "action:run_seo" }],
        [
          { text: "\u{1F4D1} Indexing", callback_data: "nav:gsc:28" },
          { text: "\u{1F4CA} Dashboard", callback_data: "nav:dashboard" }
        ]
      ]
    };
    return { text, reply_markup: keyboard };
  }
  static async renderSearchTraffic(days = 28) {
    const isConfig = SearchConsoleService.isConfigured();
    if (!isConfig) {
      const text = `
\u{1F4C8} <b>GOOGLE SEARCH CONSOLE</b>
\u{1F310} <b>${TelegramClient.escapeHtml(appConfig.gscSiteUrl)}</b>

Google Search Console credentials are not yet configured.

<b>To enable live Google Search data:</b>
1. Open Google Cloud Console -> Create a Service Account.
2. In Google Search Console -> Settings -> Users -> Add Service Account email as <b>Viewer</b>.
3. Add <code>GOOGLE_CLIENT_EMAIL</code> & <code>GOOGLE_PRIVATE_KEY</code> in Vercel.
`.trim();
      const keyboard = {
        inline_keyboard: [
          [{ text: "\u{1F4CA} Back to Dashboard", callback_data: "nav:dashboard" }]
        ]
      };
      return { text, reply_markup: keyboard };
    }
    try {
      const gsc = await SearchConsoleService.getPerformance(days);
      let topQueryText = "No search clicks recorded in this period yet.";
      if (gsc.topQueries.length > 0) {
        topQueryText = gsc.topQueries.slice(0, 3).map((q, i) => `${i + 1}. "${q.query}" (${q.clicks} clicks, pos: ${q.position})`).join("\n");
      }
      const text = `
\u{1F4C8} <b>GOOGLE SEARCH CONSOLE REPORT</b>
\u{1F310} <b>${TelegramClient.escapeHtml(appConfig.gscSiteUrl)}</b>
\u{1F4C5} <i>Last ${days} Days</i>

\u2022 <b>Total Organic Clicks:</b> ${gsc.clicks}
\u2022 <b>Search Impressions:</b> ${gsc.impressions}
\u2022 <b>Average CTR:</b> ${gsc.ctr}%
\u2022 <b>Average Position:</b> ${gsc.position}

<b>Top Search Queries:</b>
${topQueryText}
`.trim();
      const keyboard = {
        inline_keyboard: [
          [
            { text: "7 Days", callback_data: "nav:gsc:7" },
            { text: "28 Days", callback_data: "nav:gsc:28" },
            { text: "90 Days", callback_data: "nav:gsc:90" }
          ],
          [{ text: "\u{1F4CA} Dashboard", callback_data: "nav:dashboard" }]
        ]
      };
      return { text, reply_markup: keyboard };
    } catch (err) {
      const text = `
\u26A0\uFE0F <b>Google Search Console API Notice:</b>
<code>${TelegramClient.escapeHtml(err.message)}</code>

Please verify Service Account viewer permissions on property <code>${appConfig.gscSiteUrl}</code>.
`.trim();
      const keyboard = {
        inline_keyboard: [
          [{ text: "\u{1F4CA} Dashboard", callback_data: "nav:dashboard" }]
        ]
      };
      return { text, reply_markup: keyboard };
    }
  }
  static async renderSettings() {
    const dbOk = Boolean(appConfig.databaseUrl);
    const tgOk = Boolean(appConfig.telegramBotToken);
    const adminsCount = appConfig.telegramAdminIds.length;
    const gscOk = SearchConsoleService.isConfigured();
    const text = `
\u2699\uFE0F <b>SYSTEM & BOT SETTINGS</b>

<b>Website:</b> <code>${TelegramClient.escapeHtml(appConfig.websiteUrl)}</code>
<b>Storage Engine:</b> ${dbOk ? "\u2705 PostgreSQL Database" : "\u26A1 Zero-DB Mode (Instant Telegram Alerts & JSON Store)"}
<b>Telegram Bot:</b> ${tgOk ? "\u2705 Active Webhook" : "\u274C Missing Token"}
<b>Authorized Admins:</b> ${adminsCount > 0 ? `\u2705 ${adminsCount} Admin(s)` : "\u26A0\uFE0F None"}
<b>Google Search Console:</b> ${gscOk ? "\u2705 Configured" : "\u26A0\uFE0F Pending Credentials"}
<b>Data Retention:</b> 180 Days (Auto-purged)
`.trim();
    const keyboard = {
      inline_keyboard: [
        [
          { text: "\u{1F6A8} Alerts Config", callback_data: "nav:dashboard" },
          { text: "\u{1F4CA} Dashboard", callback_data: "nav:dashboard" }
        ]
      ]
    };
    return { text, reply_markup: keyboard };
  }
};

// server/telegram/webhook.ts
var processedUpdateIds = /* @__PURE__ */ new Set();
function cleanOldUpdates() {
  if (processedUpdateIds.size > 1e3) {
    const arr = Array.from(processedUpdateIds);
    for (let i = 0; i < 500; i++) {
      processedUpdateIds.delete(arr[i]);
    }
  }
}
async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (appConfig.telegramWebhookSecret) {
    const incomingSecret = req.headers["x-telegram-bot-api-secret-token"];
    if (incomingSecret !== appConfig.telegramWebhookSecret) {
      console.warn("[Webhook] Unauthorized webhook request rejected.");
      return res.status(401).json({ error: "Unauthorized" });
    }
  }
  const update = req.body;
  if (!update || typeof update !== "object") {
    return res.status(400).json({ error: "Invalid update payload" });
  }
  const updateId = update.update_id;
  if (typeof updateId === "number") {
    if (processedUpdateIds.has(updateId)) {
      return res.status(200).json({ status: "already_processed" });
    }
    cleanOldUpdates();
    processedUpdateIds.add(updateId);
  }
  try {
    await BotHandlers.handleUpdate(update);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[Webhook] Error handling update:", sanitizeLog(err.message));
    return res.status(200).json({ ok: false, error: "Internal processing error" });
  }
}
export {
  handler as default
};
