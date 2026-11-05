-- ============================================================================
-- Telegram SEO & Website Visitor Intelligence Database Schema
-- Compatible with PostgreSQL (Supabase, Neon, Railway, AWS RDS, etc.)
-- ============================================================================

-- 1. VISITOR SESSIONS
-- Tracks anonymous user sessions, duration, device, and landing/exit pages.
CREATE TABLE IF NOT EXISTS visitor_sessions (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL UNIQUE,
    visitor_id VARCHAR(64) NOT NULL,
    is_returning BOOLEAN DEFAULT FALSE,
    landing_page VARCHAR(1024),
    exit_page VARCHAR(1024),
    page_views_count INTEGER DEFAULT 1,
    duration_seconds INTEGER DEFAULT 0,
    device_category VARCHAR(32) DEFAULT 'desktop', -- desktop, mobile, tablet
    browser VARCHAR(64),
    os VARCHAR(64),
    country VARCHAR(8) DEFAULT 'XX',              -- ISO 3166-1 alpha-2 code
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

-- 2. ANALYTICS EVENTS
-- Stream of granular events (pageview, click, download, custom).
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

-- 3. PAGE VIEWS
-- Fast aggregate page view history.
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

-- 4. SEO AUDITS
-- Summary of SEO audits over time.
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

-- 5. SEO ISSUES
-- Specific issues identified during audits.
CREATE TABLE IF NOT EXISTS seo_issues (
    id BIGSERIAL PRIMARY KEY,
    audit_id BIGINT REFERENCES seo_audits(id) ON DELETE CASCADE,
    url VARCHAR(1024) NOT NULL,
    rule_id VARCHAR(64) NOT NULL,
    severity VARCHAR(16) NOT NULL, -- CRITICAL, WARNING, INFO
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    recommendation TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

CREATE INDEX IF NOT EXISTS idx_seo_issues_audit_id ON seo_issues(audit_id);
CREATE INDEX IF NOT EXISTS idx_seo_issues_severity ON seo_issues(severity);
CREATE INDEX IF NOT EXISTS idx_seo_issues_rule_id ON seo_issues(rule_id);

-- 6. SEARCH CONSOLE METRICS
-- Snapshots from Google Search Console API.
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

-- 7. BOT SETTINGS
-- Key-value persistent settings for Telegram bot and alerting thresholds.
CREATE TABLE IF NOT EXISTS bot_settings (
    key VARCHAR(128) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

-- Default baseline settings
INSERT INTO bot_settings (key, value) VALUES
    ('alert_traffic_surge_pct', '200'::jsonb),
    ('alert_traffic_drop_pct', '60'::jsonb),
    ('alert_notifications_enabled', 'true'::jsonb),
    ('daily_report_enabled', 'true'::jsonb),
    ('weekly_report_enabled', 'true'::jsonb),
    ('data_retention_days', '180'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 8. SCHEDULED REPORTS
-- Audit log of sent reports and alerts to prevent duplicates.
CREATE TABLE IF NOT EXISTS scheduled_reports (
    id BIGSERIAL PRIMARY KEY,
    report_type VARCHAR(64) NOT NULL, -- daily, weekly, alert_traffic, alert_seo, alert_downtime
    recipient_id VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'sent',
    message_summary TEXT,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

CREATE INDEX IF NOT EXISTS idx_scheduled_reports_sent_at ON scheduled_reports(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_type ON scheduled_reports(report_type);
