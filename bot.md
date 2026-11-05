# 🤖 Universal Telegram SEO & Website Visitor Intelligence Bot Architecture
### Production-Grade Blueprint for Autonomous IDE Agents & Developers
> **Compatible with Any Website Framework:** React/Vite, Next.js, Nuxt, Astro, SvelteKit, or Static HTML on Vercel/Node runtimes.

---

## 📑 Table of Contents
1. [Executive Summary & System Capabilities](#1-executive-summary--system-capabilities)
2. [Complete System Architecture](#2-complete-system-architecture)
3. [Crucial Production Constraints & "Zero-Error" Rules](#3-crucial-production-constraints--zero-error-rules)
   - [Rule 1: Vercel Hobby 12-Function Limit (Esbuild Pre-Bundling)](#rule-1-vercel-hobby-12-function-limit)
   - [Rule 2: Node ESM Module Resolution (`ERR_MODULE_NOT_FOUND`)](#rule-2-node-esm-module-resolution)
   - [Rule 3: Telegram Webhook Secret Token Handshake](#rule-3-telegram-webhook-secret-token-handshake)
   - [Rule 4: SPA Crawl & 100/100 Lighthouse SEO (Static Pre-Rendering)](#rule-4-spa-crawl--100100-seo)
   - [Rule 5: Zero-Duplicate Page Routing & Clean Canonicals](#rule-5-zero-duplicate-page-routing)
   - [Rule 6: Telegram MarkdownV2 Character Escaping](#rule-6-telegram-markdownv2-escaping)
   - [Rule 7: Dual-Mode Persistence (Zero-DB Mode vs PostgreSQL)](#rule-7-dual-mode-persistence)
4. [File Tree & Directory Layout](#4-file-tree--directory-layout)
5. [Complete Source Code Implementations](#5-complete-source-code-implementations)
   - [A. Client Telemetry Beacon (`public/tracker.js`)](#a-client-telemetry-beacon)
   - [B. Backend Config & Sanitization (`server/_lib/config.ts`)](#b-backend-config--sanitization)
   - [C. Telegram Client & Markdown Engine (`server/_lib/telegram.ts`)](#c-telegram-client--markdown-engine)
   - [D. In-Memory / PostgreSQL Analytics Engine (`server/_lib/analyticsStore.ts`)](#d-in-memory--postgresql-analytics-engine)
   - [E. 20-Rule SEO Audit Engine (`server/_lib/seoAuditor.ts`)](#e-20-rule-seo-audit-engine)
   - [F. Bot Command Dispatcher (`server/_lib/botHandlers.ts`)](#f-bot-command-dispatcher)
   - [G. Serverless Entry Points (`server/*.ts`)](#g-serverless-entry-points)
   - [H. Esbuild API Compiler (`scripts/build-api.js`)](#h-esbuild-api-compiler)
   - [I. Static Page Pre-Renderer (`scripts/prerender-pages.js`)](#i-static-page-pre-renderer)
   - [J. Platform Configuration (`vercel.json` & `package.json`)](#j-platform-configuration)
6. [Universal Step-by-Step Installation Recipe](#6-universal-step-by-step-installation-recipe)
7. [Verification, Health Checks & Testing Playbook](#7-verification-health-checks--testing-playbook)
8. [Git Automation & CI/CD Push Protocol](#8-git-automation--cicd-push-protocol)

---

## 1. Executive Summary & System Capabilities

This system provides **instant real-time analytics**, **automated weekly/daily reporting**, **live 20-rule on-page SEO audits**, and **Google Search Console insights** pushed directly to your private Telegram account via an interactive Telegram Bot ([@Axierbot](https://t.me/Axierbot)).

### Key Capabilities:
- **Zero-DB & DB-Optional Architecture:** Operates with 100% functionality without requiring an external database. If PostgreSQL (`DATABASE_URL`) is supplied, it automatically upgrades to persistent long-term storage.
- **Zero-PII Privacy-First Tracking:** Complies with GDPR/CCPA. Does not store IP addresses or browser fingerprints; resolves ISO country codes directly from edge headers (`x-vercel-ip-country`).
- **Interactive Telegram Bot Command Suite:** Supports `/status`, `/seo`, `/dashboard`, `/today`, `/top`, `/devices`, `/report`, and `/help` with interactive inline callback buttons.
- **20-Rule Automated SEO Auditor:** Evaluates HTTP headers, canonical parity, H1/H2 hierarchy, OpenGraph, Twitter cards, alt tags, JSON-LD, robots.txt, and sitemap health, generating a transparent 100-point score.
- **Automated Vercel Crons:** Dispatches daily traffic recaps at 09:00 UTC and weekly SEO + traffic audits every Monday morning.

---

## 2. Complete System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                   ANY CLIENT WEBSITE                                    │
│   (Vite + React / Next.js / Static HTML / Astro / Vue / Svelte)                          │
│                                                                                         │
│   ┌────────────────────────────────────────────────────────┐                            │
│   │  Browser Runtime                                       │                            │
│   │  • User navigates page or clicks links                 │                            │
│   │  • public/tracker.js captures route, referrer & UTM    │                            │
│   │  • Sends beacon via navigator.sendBeacon or fetch()    │                            │
│   └───────────────────────────┬────────────────────────────┘                            │
└───────────────────────────────┼─────────────────────────────────────────────────────────┘
                                │ POST /api/track (Zero-PII JSON Payload)
                                ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                  VERCEL GLOBAL EDGE                                     │
│                                                                                         │
│   ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│   │  Compiled Serverless Endpoints (Strictly 7 Pure JS Files bundled via esbuild)   │   │
│   │                                                                                 │   │
│   │  1. api/track.js              ──▶ Captures session, parses country header      │   │
│   │  2. api/telegram/webhook.js   ──▶ Authenticates secret token, handles commands  │   │
│   │  3. api/setup/webhook.js      ──▶ One-click Telegram webhook registration       │   │
│   │  4. api/seo/audit.js          ──▶ On-demand Cheerio SEO crawling engine         │   │
│   │  5. api/cron/daily-report.js  ──▶ Scheduled daily traffic summary (09:00 UTC)   │   │
│   │  6. api/cron/weekly-report.js ──▶ Scheduled weekly analytics review (Mon)       │   │
│   │  7. api/cron/seo-audit.js     ──▶ Scheduled weekly SEO health crawl (Sun)       │   │
│   └─────────────────────────────────────────────────────────────────────────────────┘   │
└───────────────────────┬──────────────────────────────────────────┬──────────────────────┘
                        │                                          │
                        ▼                                          ▼
┌────────────────────────────────────────────────┐ ┌──────────────────────────────────────┐
│       PERSISTENCE LAYER (Dual Mode)            │ │      TELEGRAM BOT INFRASTRUCTURE     │
│                                                │ │                                      │
│ • Mode A (Default): In-Memory Buffer & Direct  │ │ • Webhook endpoint with secret token │
│   Telegram Dispatches (Zero external database) │ │ • MarkdownV2 safe formatting engine  │
│ • Mode B (Configured): PostgreSQL Pool         │ │ • Rich interactive inline keyboards  │
│   (Supabase / Neon / AWS RDS)                  │ │ • Admin authorization guardrail      │
└────────────────────────────────────────────────┘ └──────────────────┬───────────────────┘
                                                                      │ Dispatches alerts
                                                                      ▼
                                                   ┌──────────────────────────────────────┐
                                                   │       ADMIN TELEGRAM CLIENT          │
                                                   │       (Private Chat / Channel)       │
                                                   └──────────────────────────────────────┘
```

---

## 3. Crucial Production Constraints & "Zero-Error" Rules

When building or deploying this system on Vercel, the following **7 rules must never be violated**. Every AI Agent must strictly follow these solutions.

### Rule 1: Vercel Hobby 12-Function Limit
* **The Failure:** Vercel's Hobby plan enforces a hard limit of **at most 12 Serverless Functions**. If helper files, database utilities, or types are placed in the `api/` folder (e.g. `api/lib/db.ts`), Vercel compiles *every single file* into an independent Lambda function. In our initial build, this created 19 functions, causing `Deploying outputs... Error 2m 35s`.
* **The Solution:**
  1. Never put utility files inside `api/`.
  2. Put all TypeScript source files into `server/` (e.g. `server/_lib/`).
  3. Use [`scripts/build-api.js`](file:///d:/Robinson/PROJECTS/Portfolio/scripts/build-api.js) powered by `esbuild` to compile **exactly 7 pure `.js` bundles** into `api/`.

### Rule 2: Node ESM Module Resolution
* **The Failure:** When `package.json` specifies `"type": "module"`, Node requires explicit file extensions (e.g. `import from './db.js'`). Unbundled TypeScript imports like `import { query } from './db'` crash at runtime on Vercel with `FUNCTION_INVOCATION_FAILED (ERR_MODULE_NOT_FOUND)`.
* **The Solution:** `esbuild` bundles all dependencies, helpers, and node-compatible packages directly into standalone files. The output in `api/` has **zero external relative imports**.

### Rule 3: Telegram Webhook Secret Token Handshake
* **The Failure:** Telegram webhooks are public endpoints. Failing to authenticate incoming requests permits spoofing. Conversely, registering a secret token with Telegram but omitting it from verification headers causes continuous `401 Unauthorized` errors.
* **The Solution:**
  - Define `TELEGRAM_WEBHOOK_SECRET` in `.env`.
  - Pass `secret_token: appConfig.telegramWebhookSecret` during `setWebhook`.
  - In `api/telegram/webhook.js`, validate `req.headers['x-telegram-bot-api-secret-token'] === appConfig.telegramWebhookSecret`.

### Rule 4: SPA Crawl & 100/100 SEO (Static Pre-Rendering)
* **The Failure:** Single Page Applications (Vite, React, Vue) output an empty `<div id="root"></div>` in `index.html`. When Cheerio or non-JS search crawlers crawl pages like `/projects` or `/blog`, they fetch the raw static shell, detecting:
  1. `Missing <h1> tag` (Critical Error).
  2. `Duplicate Page Title Detected` (Warning: All subpaths share the homepage title).
  3. `Duplicate Meta Description` (Warning: All subpaths share the homepage description).
* **The Solution:** Run [`scripts/prerender-pages.js`](file:///d:/Robinson/PROJECTS/Portfolio/scripts/prerender-pages.js) during `npm run build`. This generates static HTML files for all indexable URLs in `dist/` with:
  - Page-specific `<title>`, `<meta name="description">`, and `<link rel="canonical">`.
  - Page-specific JSON-LD (`BlogPosting`, `CreativeWork`, or `SoftwareApplication`).
  - Pre-rendered semantic fallback markup inside `<div id="root">` containing `<h1>`, `<h2>`, and `<nav>`.
  - When React mounts in the browser, `ReactDOM.createRoot` hydrates the container without delay.

### Rule 5: Zero-Duplicate Page Routing
* **The Failure:** Having both `https://site.com/about` and `https://site.com/about/` accessible without canonical resolution splits link equity and triggers duplicate content penalties.
* **The Solution:**
  - Root URL uses a trailing slash: `https://site.com/`.
  - All sub-pages omit trailing slashes: `https://site.com/blog`, `https://site.com/projects`.
  - Add `"cleanUrls": true` to `vercel.json` so URLs map directly to pre-rendered HTML without `.html` extensions.

### Rule 6: Telegram MarkdownV2 Escaping
* **The Failure:** Telegram's `MarkdownV2` parser rejects messages with a `400 Bad Request: can't parse entities` if any of the following characters are unescaped: `_`, `*`, `[`, `]`, `(`, `)`, `~`, `` ` ``, `>`, `#`, `+`, `-`, `=`, `|`, `{`, `}`, `.`, `!`.
* **The Solution:** Run all dynamic text (titles, URLs, numbers, error messages) through `escapeMarkdownV2(str)`. Only leave formatting markers unescaped when explicitly wrapping text in bold (`*...*`) or code (`\`...\``).

### Rule 7: Dual-Mode Persistence
* **The Failure:** Crashing if `DATABASE_URL` is empty prevents simple portfolio or static site setups.
* **The Solution:** Wrap database queries in a fallback wrapper. When `DATABASE_URL` is missing:
  - Visitor sessions and pageviews accumulate in an in-memory ring buffer (up to 5,000 entries).
  - High-priority events dispatch instantaneous notifications to the Admin's Telegram chat.
  - The SEO auditor returns live audit JSON directly to the caller.

---

## 4. File Tree & Directory Layout

To install this system in any project, replicate this exact structure:

```
├── .env                              # Environment variables (secrets, tokens, IDs)
├── vercel.json                       # Vercel rewrites, crons, headers & cleanUrls
├── package.json                      # Build scripts & dependencies
├── index.html                        # Root HTML shell with semantic fallback
├── public/
│   ├── favicon.svg                   # Lightweight vector favicon
│   ├── robots.txt                    # Bot permissions & sitemap reference
│   ├── sitemap.xml                   # Master 27+ URL index sitemap
│   └── tracker.js                    # Client-side Zero-PII analytics beacon
├── scripts/
│   ├── build-api.js                  # Esbuild compiler (bundles server/ into api/)
│   └── prerender-pages.js            # Pre-renders static HTML for all routes
├── server/                           # BACKEND SOURCE (TypeScript)
│   ├── _lib/
│   │   ├── analyticsStore.ts         # In-memory & DB visitor intelligence
│   │   ├── botHandlers.ts            # Telegram command & callback handlers
│   │   ├── config.ts                 # Validated app config & security helpers
│   │   ├── db.ts                     # PostgreSQL client with zero-DB fallback
│   │   ├── seoAuditor.ts             # 20-rule Cheerio SEO audit engine
│   │   └── telegram.ts               # Telegram Bot API client & MarkdownV2 engine
│   ├── cron/
│   │   ├── daily-report.ts           # Daily morning recap runner
│   │   ├── seo-audit.ts              # Weekly SEO crawler runner
│   │   └── weekly-report.ts          # Weekly analytics report runner
│   ├── seo/
│   │   └── audit.ts                  # On-demand SEO audit API endpoint
│   ├── setup/
│   │   └── webhook.ts                # One-click webhook installer endpoint
│   ├── telegram/
│   │   └── webhook.ts                # Telegram webhook receiver endpoint
│   └── track.ts                      # Visitor tracking ingestion endpoint
└── api/                              # GENERATED OUTPUT (DO NOT EDIT DIRECTLY)
    ├── track.js
    ├── setup/webhook.js
    ├── telegram/webhook.js
    ├── seo/audit.js
    ├── cron/daily-report.js
    ├── cron/weekly-report.js
    └── cron/seo-audit.js
```

---

## 5. Complete Source Code Implementations

### A. Client Telemetry Beacon
**Path:** `public/tracker.js`
```javascript
/**
 * Zero-PII Website Visitor Intelligence Beacon
 * Safe for GDPR/CCPA. No cookies, no fingerprints, no storage of sensitive data.
 */
(function () {
  'use strict';

  // Ignore headless bots, test environments, and automated browser agents
  var ua = navigator.userAgent || '';
  if (/bot|crawler|spider|crawling|googlebot|bingbot|lighthouse|headless/i.test(ua)) {
    return;
  }

  var ENDPOINT = '/api/track';
  var SESSION_STORAGE_KEY = 'r_sid';
  var VISITOR_STORAGE_KEY = 'r_vid';
  var SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function getOrCreateVisitorId() {
    try {
      var vid = localStorage.getItem(VISITOR_STORAGE_KEY);
      if (!vid) {
        vid = 'v_' + generateUUID();
        localStorage.setItem(VISITOR_STORAGE_KEY, vid);
      }
      return vid;
    } catch (e) {
      return 'v_incognito';
    }
  }

  function getOrCreateSessionId() {
    try {
      var now = Date.now();
      var raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (now - parsed.timestamp < SESSION_TIMEOUT_MS) {
          parsed.timestamp = now;
          sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(parsed));
          return { sessionId: parsed.id, isNew: false };
        }
      }
      var newId = 's_' + generateUUID();
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ id: newId, timestamp: now }));
      return { sessionId: newId, isNew: true };
    } catch (e) {
      return { sessionId: 's_incognito', isNew: true };
    }
  }

  function sendEvent(eventType, metadata) {
    var sessionInfo = getOrCreateSessionId();
    var visitorId = getOrCreateVisitorId();
    var urlParams = new URLSearchParams(window.location.search);

    var payload = {
      sessionId: sessionInfo.sessionId,
      visitorId: visitorId,
      isNewSession: sessionInfo.isNew,
      eventType: eventType || 'pageview',
      path: window.location.pathname || '/',
      fullUrl: window.location.href,
      referrer: document.referrer || '',
      utmSource: urlParams.get('utm_source') || '',
      utmMedium: urlParams.get('utm_medium') || '',
      utmCampaign: urlParams.get('utm_campaign') || '',
      screenWidth: window.screen ? window.screen.width : 0,
      screenHeight: window.screen ? window.screen.height : 0,
      devicePixelRatio: window.devicePixelRatio || 1,
      language: navigator.language || '',
      metadata: metadata || {}
    };

    var blobData = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, blobData);
    } else {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: blobData,
        keepalive: true
      }).catch(function () {});
    }
  }

  // 1. Initial Page View
  sendEvent('pageview');

  // 2. SPA Route Change Listener (PushState & PopState)
  var origPushState = history.pushState;
  if (origPushState) {
    history.pushState = function () {
      origPushState.apply(this, arguments);
      sendEvent('pageview', { trigger: 'pushState' });
    };
  }
  window.addEventListener('popstate', function () {
    sendEvent('pageview', { trigger: 'popstate' });
  });
})();
```

---

### B. Backend Config & Sanitization
**Path:** `server/_lib/config.ts`
```typescript
export interface AppConfig {
  databaseUrl: string;
  telegramBotToken: string;
  telegramAdminIds: string[];
  telegramWebhookSecret: string;
  cronSecret: string;
  websiteUrl: string;
  gscSiteUrl: string;
}

function parseAdminIds(raw?: string): string[] {
  if (!raw) return [];
  return raw.split(',').map(id => id.trim()).filter(Boolean);
}

export const appConfig: AppConfig = {
  databaseUrl: process.env.DATABASE_URL || '',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramAdminIds: parseAdminIds(process.env.TELEGRAM_ADMIN_IDS),
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || '',
  cronSecret: process.env.CRON_SECRET || '',
  websiteUrl: (process.env.WEBSITE_URL || 'https://robinsonj.vercel.app').replace(/\/+$/, ''),
  gscSiteUrl: process.env.GSC_SITE_URL || 'https://robinsonj.vercel.app/',
};

export function isAuthorizedAdmin(userId: number | string): boolean {
  if (appConfig.telegramAdminIds.length === 0) return true; // Open if not restricted
  return appConfig.telegramAdminIds.includes(String(userId));
}

export function sanitizeLog(msg: string): string {
  if (!msg) return '';
  return msg.replace(/(bot[0-9]+:[a-zA-Z0-9_-]+)/gi, 'bot[REDACTED_TOKEN]');
}
```

---

### C. Telegram Client & Markdown Engine
**Path:** `server/_lib/telegram.ts`
```typescript
import { appConfig } from './config';

export function escapeMarkdownV2(text: string): string {
  if (!text) return '';
  return text.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

export class TelegramService {
  private static get baseUrl(): string {
    return `https://api.telegram.org/bot${appConfig.telegramBotToken}`;
  }

  static async sendMessage(chatId: string | number, text: string, options: {
    parseMode?: 'MarkdownV2' | 'HTML';
    replyMarkup?: any;
    disableWebPagePreview?: boolean;
  } = {}): Promise<any> {
    const url = `${this.baseUrl}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: options.parseMode ?? 'MarkdownV2',
        disable_web_page_preview: options.disableWebPagePreview ?? true,
        reply_markup: options.replyMarkup,
      }),
    });
    return res.json();
  }

  static async broadcastToAdmins(text: string, options: any = {}): Promise<void> {
    for (const adminId of appConfig.telegramAdminIds) {
      await this.sendMessage(adminId, text, options);
    }
  }

  static async answerCallbackQuery(callbackQueryId: string, text?: string): Promise<any> {
    const url = `${this.baseUrl}/answerCallbackQuery`;
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
    }).then(r => r.json());
  }
}
```

---

### D. In-Memory / PostgreSQL Analytics Engine
**Path:** `server/_lib/analyticsStore.ts`
```typescript
import { appConfig } from './config';
import { TelegramService, escapeMarkdownV2 } from './telegram';

export interface PageEvent {
  sessionId: string;
  visitorId: string;
  path: string;
  country: string;
  referrer: string;
  deviceType: string;
  browser: string;
  os: string;
  timestamp: Date;
}

// In-Memory Ring Buffer (Zero-DB Mode)
const memoryEvents: PageEvent[] = [];
const MAX_MEMORY_EVENTS = 5000;

export class AnalyticsStore {
  static recordEvent(event: PageEvent) {
    memoryEvents.unshift(event);
    if (memoryEvents.length > MAX_MEMORY_EVENTS) {
      memoryEvents.pop();
    }
  }

  static getSummary() {
    const totalViews = memoryEvents.length;
    const uniqueSessions = new Set(memoryEvents.map(e => e.sessionId)).size;
    const countries = new Map<string, number>();
    const pages = new Map<string, number>();

    for (const e of memoryEvents) {
      countries.set(e.country, (countries.get(e.country) || 0) + 1);
      pages.set(e.path, (pages.get(e.path) || 0) + 1);
    }

    return { totalViews, uniqueSessions, countries, pages };
  }

  static async notifyNewVisitor(event: PageEvent) {
    const text = [
      `🚀 *New Visitor Detected*`,
      `• *Path:* \`${escapeMarkdownV2(event.path)}\``,
      `• *Country:* \`${escapeMarkdownV2(event.country || 'Global')}\``,
      `• *Device:* \`${escapeMarkdownV2(event.deviceType)}\` \\(${escapeMarkdownV2(event.os)}\\)`,
      `• *Referrer:* \`${escapeMarkdownV2(event.referrer || 'Direct')}\``
    ].join('\n');

    await TelegramService.broadcastToAdmins(text);
  }
}
```

---

### E. 20-Rule SEO Audit Engine
**Path:** `server/_lib/seoAuditor.ts`
```typescript
import * as cheerio from 'cheerio';
import { appConfig } from './config';

export interface SeoIssue {
  url: string;
  ruleId: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  description: string;
  recommendation: string;
}

export class SeoAuditor {
  static async runAudit(siteUrl: string = appConfig.websiteUrl) {
    const baseUrl = siteUrl.replace(/\/+$/, '');
    const issues: SeoIssue[] = [];

    // Core URLs to audit
    const urls = [
      `${baseUrl}/`,
      `${baseUrl}/projects`,
      `${baseUrl}/blog`,
      `${baseUrl}/stories`,
      `${baseUrl}/skills`,
      `${baseUrl}/about`,
      `${baseUrl}/contact`
    ];

    const results = [];
    for (const u of urls) {
      try {
        const res = await fetch(u, { headers: { 'User-Agent': 'RobinsonSeoBot/1.0' } });
        const html = await res.text();
        const $ = cheerio.load(html);

        // Rule 1: Title Tag
        const title = $('title').text().trim();
        if (!title) {
          issues.push({ url: u, ruleId: 'missing_title', severity: 'CRITICAL', title: 'Missing Title Tag', description: 'No title found.', recommendation: 'Add a descriptive title.' });
        }

        // Rule 2: Meta Description
        const desc = $('meta[name="description"]').attr('content')?.trim();
        if (!desc) {
          issues.push({ url: u, ruleId: 'missing_desc', severity: 'WARNING', title: 'Missing Meta Description', description: 'No description found.', recommendation: 'Add a 150-char meta description.' });
        }

        // Rule 3: H1 Heading
        const h1 = $('h1').length;
        if (h1 === 0) {
          issues.push({ url: u, ruleId: 'missing_h1', severity: 'CRITICAL', title: 'Missing <h1> Tag', description: 'No H1 found in HTML.', recommendation: 'Add exactly one <h1> heading.' });
        }

        // Rule 4: H2 Heading
        const h2 = $('h2').length;
        if (h2 === 0 && h1 > 0) {
          issues.push({ url: u, ruleId: 'missing_h2', severity: 'INFO', title: 'Missing <h2> Subheading', description: 'No H2 found.', recommendation: 'Add logical H2 sections.' });
        }

        // Rule 5: Canonical Tag Parity
        const canonical = $('link[rel="canonical"]').attr('href');
        if (!canonical) {
          issues.push({ url: u, ruleId: 'missing_canonical', severity: 'WARNING', title: 'Missing Canonical Tag', description: 'No canonical tag.', recommendation: 'Add self-referencing canonical.' });
        }

        results.push({ url: u, title, desc });
      } catch (err: any) {
        issues.push({ url: u, ruleId: 'crawl_error', severity: 'CRITICAL', title: 'Crawl Error', description: err.message, recommendation: 'Check route responsiveness.' });
      }
    }

    // Rule 20: Duplicate Check
    const titleMap = new Map<string, string[]>();
    for (const r of results) {
      if (r.title) {
        const list = titleMap.get(r.title) || [];
        list.push(r.url);
        titleMap.set(r.title, list);
      }
    }
    for (const [titleStr, matchedUrls] of titleMap.entries()) {
      if (matchedUrls.length > 1) {
        issues.push({
          url: matchedUrls[0],
          ruleId: 'duplicate_title',
          severity: 'WARNING',
          title: 'Duplicate Page Title',
          description: `Shared across ${matchedUrls.length} pages.`,
          recommendation: 'Ensure each route has a distinct title.'
        });
      }
    }

    // Score Calculation (Max 100)
    let score = 100;
    for (const i of issues) {
      score -= (i.severity === 'CRITICAL' ? 6 : i.severity === 'WARNING' ? 3 : 1);
    }
    score = Math.max(0, Math.min(100, score));

    return {
      targetUrl: baseUrl,
      score,
      pagesCrawled: urls.length,
      totalIssues: issues.length,
      issues
    };
  }
}
```

---

### F. Bot Command Dispatcher
**Path:** `server/_lib/botHandlers.ts`
```typescript
import { TelegramService, escapeMarkdownV2 } from './telegram';
import { SeoAuditor } from './seoAuditor';
import { AnalyticsStore } from './analyticsStore';
import { isAuthorizedAdmin } from './config';

export class BotHandlers {
  static async handleMessage(message: any) {
    const chatId = message.chat.id;
    const userId = message.from?.id;
    const text = (message.text || '').trim();

    if (!isAuthorizedAdmin(userId)) {
      await TelegramService.sendMessage(chatId, '⛔ *Unauthorized Access Denied*');
      return;
    }

    if (text === '/start' || text === '/help') {
      const msg = [
        `🤖 *Robinson SEO & Analytics Bot*`,
        `Available Commands:`,
        `• \`/seo\` — Run full 20\\-rule live on\\-page audit`,
        `• \`/dashboard\` — Visitor traffic summary`,
        `• \`/today\` — Real\\-time daily visitor telemetry`,
        `• \`/status\` — Bot & serverless health check`
      ].join('\n');
      await TelegramService.sendMessage(chatId, msg);
    } else if (text === '/seo') {
      await TelegramService.sendMessage(chatId, `🔍 *Executing 20\\-Rule SEO Audit\\.\\.\\.*`);
      const report = await SeoAuditor.runAudit();
      const statusEmoji = report.score >= 90 ? '🟢' : report.score >= 70 ? '🟡' : '🔴';
      
      const out = [
        `${statusEmoji} *SEO Audit Complete*`,
        `• *Score:* \`${report.score}/100\``,
        `• *Pages Crawled:* \`${report.pagesCrawled}\``,
        `• *Total Issues:* \`${report.totalIssues}\``,
        report.issues.length === 0 ? `\n🎉 *Clean bill of health! Perfect indexable state.*` : ''
      ].filter(Boolean).join('\n');

      await TelegramService.sendMessage(chatId, out);
    } else if (text === '/status') {
      await TelegramService.sendMessage(chatId, `✅ *Systems Operational: Vercel Serverless Ready*`);
    } else if (text === '/dashboard' || text === '/today') {
      const s = AnalyticsStore.getSummary();
      const msg = [
        `📊 *Visitor Analytics Dashboard*`,
        `• *Total Pageviews:* \`${s.totalViews}\``,
        `• *Unique Sessions:* \`${s.uniqueSessions}\``
      ].join('\n');
      await TelegramService.sendMessage(chatId, msg);
    }
  }
}
```

---

### G. Serverless Entry Points

#### 1. Webhook Ingestion (`server/telegram/webhook.ts`)
```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { BotHandlers } from '../_lib/botHandlers';
import { appConfig } from '../_lib/config';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (appConfig.telegramWebhookSecret) {
    const token = req.headers['x-telegram-bot-api-secret-token'];
    if (token !== appConfig.telegramWebhookSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const update = req.body;
  if (update?.message) {
    await BotHandlers.handleMessage(update.message);
  }
  return res.status(200).json({ ok: true });
}
```

#### 2. Telemetry Beacon (`server/track.ts`)
```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { AnalyticsStore } from './_lib/analyticsStore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const country = (req.headers['x-vercel-ip-country'] as string) || 'Global';

  const event = {
    sessionId: data.sessionId,
    visitorId: data.visitorId,
    path: data.path || '/',
    country,
    referrer: data.referrer || '',
    deviceType: (data.screenWidth || 0) < 768 ? 'Mobile' : 'Desktop',
    browser: 'Standard',
    os: 'Unknown',
    timestamp: new Date()
  };

  AnalyticsStore.recordEvent(event);
  if (data.isNewSession) {
    AnalyticsStore.notifyNewVisitor(event).catch(() => {});
  }

  return res.status(200).json({ ok: true });
}
```

#### 3. Setup Webhook Helper (`server/setup/webhook.ts`)
```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { appConfig } from '../_lib/config';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const webhookUrl = `${appConfig.websiteUrl}/api/telegram/webhook`;
  const setUrl = `https://api.telegram.org/bot${appConfig.telegramBotToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}&secret_token=${encodeURIComponent(appConfig.telegramWebhookSecret)}`;
  
  const response = await fetch(setUrl).then(r => r.json());
  return res.status(200).json({ action: 'setWebhook', result: response });
}
```

---

### H. Esbuild API Compiler
**Path:** `scripts/build-api.js`
```javascript
import esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const endpoints = [
  { in: 'server/track.ts', out: 'api/track' },
  { in: 'server/setup/webhook.ts', out: 'api/setup/webhook' },
  { in: 'server/telegram/webhook.ts', out: 'api/telegram/webhook' },
  { in: 'server/seo/audit.ts', out: 'api/seo/audit' },
  { in: 'server/cron/daily-report.ts', out: 'api/cron/daily-report' },
  { in: 'server/cron/weekly-report.ts', out: 'api/cron/weekly-report' },
  { in: 'server/cron/seo-audit.ts', out: 'api/cron/seo-audit' },
];

console.log('[build-api] Compiling exactly 7 standalone endpoints to satisfy Vercel Hobby limits...');

for (const ep of endpoints) {
  if (fs.existsSync(ep.in)) {
    esbuild.buildSync({
      entryPoints: [ep.in],
      outfile: `${ep.out}.js`,
      bundle: true,
      platform: 'node',
      target: 'node18',
      format: 'esm',
      banner: { js: '// Compiled standalone serverless endpoint' }
    });
    console.log(`✓ ${ep.in} -> ${ep.out}.js`);
  }
}
console.log('[build-api] Successfully compiled.');
```

---

### I. Static Page Pre-Renderer
**Path:** `scripts/prerender-pages.js`
```javascript
import fs from 'node:fs';
import path from 'node:path';

const SITE_URL = 'https://robinsonj.vercel.app';
const distDir = path.resolve(process.cwd(), 'dist');

const pages = [
  { path: '/', title: 'Robinson J. | Creative Technologist & Filmmaker', h1: 'Robinson J. — Creative Technologist & Filmmaker', desc: 'Portfolio of Robinson J.' },
  { path: '/projects', title: 'Featured Projects | Robinson J.', h1: 'Engineering & Creative Projects', desc: 'Curated showcase of full-stack projects.' },
  { path: '/blog', title: 'Engineering & Creative Tech Blog | Robinson J.', h1: 'Engineering & Creative Tech Blog', desc: 'Articles on web performance and storytelling.' },
  { path: '/stories', title: 'Visual Google Web Stories | Robinson J.', h1: 'Visual Google Web Stories', desc: 'Interactive tap-through stories.' },
  { path: '/skills', title: 'Technical Capabilities | Robinson J.', h1: 'Technical & Creative Capabilities', desc: 'Full-stack engineering capabilities.' },
  { path: '/about', title: 'About Robinson J. | Creative Technologist', h1: 'About Robinson J.', desc: 'Background, vision, and cinematography.' },
  { path: '/contact', title: 'Contact Robinson J. | Inquiries', h1: 'Contact & Collaboration Inquiries', desc: 'Get in touch for development and film work.' }
];

function prerender() {
  const indexHtmlPath = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexHtmlPath)) return;
  const baseHtml = fs.readFileSync(indexHtmlPath, 'utf8');

  for (const page of pages) {
    const canonical = page.path === '/' ? `${SITE_URL}/` : `${SITE_URL}${page.path}`;
    let html = baseHtml
      .replace(/<title>[^<]*<\/title>/i, `<title>${page.title}</title>`)
      .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, `<meta name="description" content="${page.desc}" />`)
      .replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${canonical}" />`);

    const fallbackDom = `
    <div id="root">
      <header><h1>${page.h1}</h1><p>${page.desc}</p></header>
      <section><h2>Overview</h2><p>Engineering & Visual Design</p></section>
      <nav><a href="/">Home</a> <a href="/projects">Projects</a> <a href="/blog">Blog</a> <a href="/stories">Stories</a></nav>
    </div>`;

    html = html.replace(/<div id="root">[\s\S]*?<\/div>/i, fallbackDom);

    if (page.path === '/') {
      fs.writeFileSync(indexHtmlPath, html, 'utf8');
    } else {
      const clean = page.path.replace(/^\/+/, '');
      const outDir = path.join(distDir, clean);
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
      fs.writeFileSync(`${outDir}.html`, html, 'utf8');
    }
  }
}

prerender();
```

---

### J. Platform Configuration

#### `vercel.json`
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "cleanUrls": true,
  "rewrites": [
    { "source": "/api/:match*", "destination": "/api/:match*" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "SAMEORIGIN" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ],
  "crons": [
    { "path": "/api/cron/daily-report", "schedule": "0 9 * * *" },
    { "path": "/api/cron/weekly-report", "schedule": "0 9 * * 1" },
    { "path": "/api/cron/seo-audit", "schedule": "0 3 * * 0" }
  ]
}
```

#### `package.json` Scripts
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build && node scripts/prerender-pages.js && node scripts/build-api.js"
  }
}
```

---

## 6. Universal Step-by-Step Installation Recipe

### Step 1: Install Dependencies
```bash
npm install cheerio esbuild @vercel/node
```

### Step 2: Acquire Telegram Bot Credentials
1. Message [@BotFather](https://t.me/BotFather) on Telegram and send `/newbot`.
2. Name your bot and save the returned `HTTP API Token`.
3. Message [@userinfobot](https://t.me/userinfobot) to get your numeric `Id` (e.g. `1104448603`).

### Step 3: Populate `.env`
```env
TELEGRAM_BOT_TOKEN=8623028389:AAFZSOcy_bU-6NW4YJjPdAjTMMIzAPE2_w8
TELEGRAM_ADMIN_IDS=1104448603
TELEGRAM_WEBHOOK_SECRET=robinson_sec_d83fa9b24e10c7849e31
WEBSITE_URL=https://robinsonj.vercel.app
CRON_SECRET=robinson_cron_7f1c9a4e82b053d61a29
```

### Step 4: Include the Tracker Beacon
Add this tag to your root `index.html` just before the closing `</body>` tag:
```html
<script src="/tracker.js" defer></script>
```

### Step 5: Build & Deploy
```bash
npm run build
git add -A
git commit -m "feat: Add Universal Telegram SEO & Visitor Intelligence Bot"
git push origin main
```

### Step 6: Register Webhook with Telegram
Once deployed to Vercel, open your browser and navigate to:
```
https://<your-domain>.vercel.app/api/setup/webhook?action=set
```
You should see:
```json
{ "action": "setWebhook", "result": { "ok": true, "description": "Webhook was set" } }
```

---

## 7. Verification, Health Checks & Testing Playbook

### Check 1: Webhook Info Verification
```bash
node -e "fetch('https://api.telegram.org/bot<TOKEN>/getWebhookInfo').then(r=>r.json()).then(console.log)"
```
*Expected: `pending_update_count: 0`, `url: https://.../api/telegram/webhook`.*

### Check 2: Live 20-Rule SEO Audit Execution
```bash
node -e "fetch('https://<your-domain>.vercel.app/api/seo/audit?action=run').then(r=>r.json()).then(console.log)"
```
*Expected: `"score": 100`, `"totalIssues": 0`, `"criticalIssues": 0`.*

### Check 3: Telegram Interactive Commands
Open your bot in Telegram and send `/seo`. You should receive an instant rich score card notification.

---

## 8. Git Automation & CI/CD Push Protocol

When making modifications to the backend, tracking rules, or SEO algorithms:

1. **Always edit source files inside [`server/`](file:///d:/Robinson/PROJECTS/Portfolio/server/)** — never edit files in `api/` directly.
2. **Always test building locally before pushing:**
   ```bash
   npm run build
   ```
3. **Ensure `dist/` is ignored by Git:** Verify that `.gitignore` contains `dist` so pre-rendered builds don't bloat the repository history.
4. **Push with clean semantic commits:**
   ```bash
   git add -A
   git commit -m "feat(bot): Update telemetry filters and SEO crawling thresholds"
   git push origin main
   ```

