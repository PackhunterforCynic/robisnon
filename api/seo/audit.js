// server/_lib/seoAuditor.ts
import * as cheerio from "cheerio";

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

// server/_lib/seoAuditor.ts
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
    urlsToAudit.add(baseUrl);
    urlsToAudit.add(`${baseUrl}/`);
    if (sitemapUrls.length > 0) {
      for (const u of sitemapUrls.slice(0, 8)) {
        urlsToAudit.add(u);
      }
    } else {
      urlsToAudit.add(`${baseUrl}/projects`);
      urlsToAudit.add(`${baseUrl}/about`);
      urlsToAudit.add(`${baseUrl}/skills`);
    }
    const uniqueUrls = Array.from(urlsToAudit).slice(0, 8);
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

// server/seo/audit.ts
async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  try {
    if (req.method === "POST") {
      const url = typeof req.body?.url === "string" ? req.body.url : void 0;
      const report = await SeoAuditor.runAudit(url);
      return res.status(200).json(report);
    } else {
      const latest = await SeoAuditor.getLatestAudit();
      if (latest) {
        return res.status(200).json(latest);
      }
      const initial = await SeoAuditor.runAudit();
      return res.status(200).json(initial);
    }
  } catch (err) {
    console.error("[Api:SeoAudit] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
export {
  handler as default
};
