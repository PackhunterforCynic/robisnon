# 🚀 Robinson Portfolio - Telegram SEO & Website Visitor Intelligence System

A production-ready website visitor analytics platform, live SEO auditor, Google Search Console manager, and Telegram bot assistant engineered specifically for [https://robinsonj.vercel.app/](https://robinsonj.vercel.app/).

---

## 🏛️ Architecture Overview

The system runs natively within your existing Vercel + Vite deployment with **zero extra servers** required:

```
┌────────────────────────────────────────────────────────┐
│                   Vercel Global Edge                   │
│                                                        │
│  Static React SPA (dist/)       Serverless APIs (api/) │
│  ┌───────────────────────┐     ┌─────────────────────┐ │
│  │  portfolio UI pages   │     │ POST /api/track     │ │
│  │  public/tracker.js    │────▶│ POST /api/telegram/ │ │
│  │  (Zero-PII tracker)   │     │        webhook      │ │
│  └───────────────────────┘     │ GET  /api/seo/audit │ │
│                                │ GET  /api/cron/*    │ │
│                                └──────────┬──────────┘ │
└───────────────────────────────────────────┼────────────┘
                                            │
                     ┌──────────────────────┴──────────────────────┐
                     ▼                                             ▼
         ┌────────────────────────┐                   ┌────────────────────────┐
         │ PostgreSQL Database    │                   │ Google Search Console  │
         │ (Supabase, Neon, etc.) │                   │ Official APIs (v3)     │
         │ - visitor_sessions     │                   └────────────────────────┘
         │ - analytics_events     │                                ▲
         │ - page_views           │                                │
         │ - seo_audits           │                                │
         │ - search_console_data  │                                │
         └────────────────────────┘                                │
                     ▲                                             │
                     │         ┌────────────────────────┐          │
                     └─────────┤   Telegram Bot API     ├──────────┘
                               │   Interactive Dashboard│
                               │   Daily/Weekly Reports │
                               └────────────────────────┘
```

---

## 📋 Features & Capabilities

### 1. Website Visitor Tracking (`/api/track`, `public/tracker.js`)
- **Zero-PII & Privacy-First:** Never records passwords, form inputs, raw IP addresses, or canvas fingerprints.
- **Header-Level Country Resolution:** Extracts ISO country codes directly from Vercel's trusted `x-vercel-ip-country` header and discards raw IPs immediately.
- **Session & Visitor Tracking:** Anonymous first-party session identifier (`r_sid`) with 30-minute rolling expiration, plus returning visitor detection (`r_vid`).
- **Crawler & Bot Filtering:** Blocks search engine spiders, scrapers, and headless crawlers from contaminating visitor numbers.
- **UTM & Source Attribution:** Tracks `utm_source`, `utm_medium`, `utm_campaign`, and clean referrer domains.

### 2. Live SEO Audit Engine (`api/lib/seoAuditor.ts`, `/api/seo/audit`)
Crawls public pages and audits **20 strict on-page & technical SEO criteria**:
1. Page Title (length, keyword alignment, presence)
2. Meta Description (character boundaries, compelling snippet)
3. H1 Headings (single H1 policy, presence, clarity)
4. H2/H3 Structure (logical hierarchy)
5. Canonical URLs (enforces valid HTTPS canonical tags)
6. Robots Meta Directive (flags accidental `noindex` or `nofollow`)
7. Robots.txt (validates user-agent and sitemap directives)
8. XML Sitemap (validates `sitemap.xml` syntax and count of URLs)
9. Open Graph Metadata (`og:title`, `og:description`, `og:image`, `og:url`)
10. Twitter Card Tags (`twitter:card`, `twitter:title`, `twitter:image`)
11. Image Alt Attributes (flags missing `alt` on visual assets)
12. Broken Links (validates internal and external links)
13. Internal Link Architecture (crawl depth and anchor distribution)
14. External Link Security (enforces `rel="noopener"` on blank targets)
15. HTTPS Enforcement (checks SSL validity)
16. Mobile Viewport (verifies `width=device-width` responsive tag)
17. Structured Data (detects schema.org JSON-LD microdata)
18. TTFB & Speed (audits server response times from the edge)
19. Missing Metadata (general head audit)
20. Cross-Page Duplicate Titles & Descriptions

Generates a transparent **100-point score** with severity-classified recommendations (`CRITICAL`, `WARNING`, `INFO`).

### 3. Google Search Console Integration (`api/lib/searchConsole.ts`)
- Directly queries the official Google Search Console API.
- Organic clicks, impressions, average CTR, and average position.
- Top organic search queries (keywords) and landing pages.
- Country and device distribution over 7, 28, and 90-day windows.

### 4. Telegram Bot Commands (`/api/telegram/webhook`)
| Command | Description |
| :--- | :--- |
| `/start` | Authenticate admin and launch quick-action buttons |
| `/dashboard` | Interactive inline dashboard with pagination |
| `/stats` | All-time vs 30-day visitor totals |
| `/today` | Today's visitor metrics & session duration |
| `/yesterday` | Yesterday's performance comparison |
| `/weekly` | 7-day traffic summary |
| `/monthly` | 30-day traffic summary |
| `/realtime` | Active sessions in the last 30 minutes |
| `/top-pages` | Most visited paths with unique views |
| `/referrers` | Traffic sources (Google, Direct, Social, etc.) |
| `/devices` | Desktop vs Mobile vs Tablet breakdown |
| `/countries` | Visitor country distribution |
| `/seo` | Run live 20-rule SEO audit or view latest score |
| `/keywords` | Top Google search queries |
| `/search-traffic` | Organic search impressions & click trends |
| `/indexed` | Check Google indexing health & sitemap state |
| `/sitemap` | Validate `sitemap.xml` accessibility |
| `/broken-links` | Check for dead internal links |
| `/speed` | Test TTFB and server response speed |
| `/report` | Generate full executive intelligence summary |
| `/alerts` | Review uptime, traffic surge, & SEO monitoring |
| `/settings` | Verify system health, DB connection, & credentials |

---

## 🛠️ Environment Variables Setup

Configure the following variables in **Vercel Project Settings ➔ Environment Variables**:

| Variable | Description | Where to Get |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | Supabase, Neon, Railway, or Vercel Postgres |
| `TELEGRAM_BOT_TOKEN` | Telegram bot API key | Telegram `@BotFather` |
| `TELEGRAM_ADMIN_IDS` | Authorized user IDs (comma-separated) | Telegram `@userinfobot` |
| `TELEGRAM_WEBHOOK_SECRET` | 32-char random string for verification | Generate with `openssl rand -hex 16` |
| `CRON_SECRET` | Secret token for Vercel Cron jobs | Generate with `openssl rand -hex 16` |
| `WEBSITE_URL` | Production website URL | `https://robinsonj.vercel.app` |
| `GSC_SITE_URL` | Target Search Console property | `https://robinsonj.vercel.app/` |
| `GOOGLE_CLIENT_EMAIL` | *(Optional)* Google Service Account email | Google Cloud Console |
| `GOOGLE_PRIVATE_KEY` | *(Optional)* Google Service Account private key | Google Cloud Console |

---

## 📖 Step-by-Step Setup Guide

### 1. Create your Telegram Bot
1. Open Telegram and search for `@BotFather`.
2. Send `/newbot`.
3. Choose a name (e.g. `Robinson SEO Bot`) and a username (e.g. `robinson_seo_bot`).
4. Copy the API Token provided. That is your `TELEGRAM_BOT_TOKEN`.
5. Open Telegram and message `@userinfobot` to get your numeric User ID. Set this as `TELEGRAM_ADMIN_IDS`.

### 2. Set Up the PostgreSQL Database
1. Create a free database at **[Supabase.com](https://supabase.com/)** or **[Neon.tech](https://neon.tech/)**.
2. Go to **Settings ➔ Database ➔ Connection String** and copy the URI.
3. Paste it as `DATABASE_URL` in your `.env` or Vercel project settings.
4. Run migrations locally or on deploy:
   ```bash
   npm run migrate
   ```
   *(Note: The application also auto-creates all required tables on its first serverless query!)*

### 3. Register the Telegram Webhook
Once deployed to Vercel, register your webhook by running:
```bash
node scripts/set-webhook.js
```
*Or simply open this URL in your browser:*
```
https://robinsonj.vercel.app/api/setup/webhook?action=set
```

### 4. Connect Google Search Console (Optional)
1. Go to **Google Cloud Console ➔ IAM & Admin ➔ Service Accounts**.
2. Create a service account (e.g. `seo-bot@project.iam.gserviceaccount.com`).
3. Under **Keys**, create a new JSON key.
4. In Google Cloud Console, enable the **Google Search Console API** (Webmasters API).
5. Open **[Google Search Console](https://search.google.com/search-console)** ➔ **Settings** ➔ **Users and permissions** ➔ **Add user**.
6. Add the Service Account email with **Viewer** permissions.
7. Add `GOOGLE_CLIENT_EMAIL` and `GOOGLE_PRIVATE_KEY` to your Vercel environment variables.

---

## 🧪 Local & Production Verification Commands

Test visitor tracking ingestion:
```bash
curl -X POST https://robinsonj.vercel.app/api/track \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"s_test12345678","visitorId":"v_test12345678","url":"https://robinsonj.vercel.app/","path":"/","deviceCategory":"desktop","browser":"Chrome","os":"Windows"}'
```

Test SEO audit API:
```bash
curl https://robinsonj.vercel.app/api/seo/audit
```

Check Telegram Webhook status:
```bash
curl https://robinsonj.vercel.app/api/setup/webhook?action=info
```
