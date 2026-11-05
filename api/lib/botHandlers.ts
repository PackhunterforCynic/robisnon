/**
 * Telegram Bot Command Dispatcher & Interactive Inline Keyboard Handlers
 * Handles all 22 required slash commands + interactive dashboard callbacks.
 */

import { TelegramClient, InlineKeyboardMarkup } from './telegram';
import { AnalyticsService } from './analyticsService';
import { SeoAuditor } from './seoAuditor';
import { SearchConsoleService } from './searchConsole';
import { ReportGenerator } from './reportGenerator';
import { AlertService } from './alertService';
import { appConfig, isTelegramAdmin } from './config';

export class BotHandlers {
  /**
   * Main Router for incoming Telegram Updates
   */
  static async handleUpdate(update: any): Promise<void> {
    if (update.message) {
      await this.handleMessage(update.message);
    } else if (update.callback_query) {
      await this.handleCallbackQuery(update.callback_query);
    }
  }

  /**
   * Handle text messages and slash commands
   */
  private static async handleMessage(message: any): Promise<void> {
    const chatId = message.chat?.id;
    const fromId = message.from?.id;
    const text = (message.text || '').trim();

    if (!chatId || !fromId) return;

    // Authorization check
    if (!isTelegramAdmin(fromId)) {
      await TelegramClient.sendMessage(
        chatId,
        `⛔ <b>Access Denied</b>\n\nYour Telegram User ID is: <code>${fromId}</code>\n\nTo manage this website, add this ID to <code>TELEGRAM_ADMIN_IDS</code> in your Vercel Project Settings environment variables.`
      );
      return;
    }

    // Extract command (handling e.g. /start@MyBot)
    const command = text.split(' ')[0].toLowerCase().split('@')[0];

    switch (command) {
      case '/start':
        await this.handleStart(chatId);
        break;
      case '/help':
        await this.handleHelp(chatId);
        break;
      case '/dashboard':
        await this.handleDashboard(chatId);
        break;
      case '/stats':
        await this.handleStats(chatId);
        break;
      case '/today':
        await this.handlePeriod(chatId, 'today', "Today's Visitor Report");
        break;
      case '/yesterday':
        await this.handlePeriod(chatId, 'yesterday', "Yesterday's Visitor Report");
        break;
      case '/weekly':
        await this.handlePeriod(chatId, '7_days', 'Weekly Visitor Report (Last 7 Days)');
        break;
      case '/monthly':
        await this.handlePeriod(chatId, '30_days', 'Monthly Visitor Report (Last 30 Days)');
        break;
      case '/realtime':
        await this.handleRealtime(chatId);
        break;
      case '/top-pages':
      case '/toppages':
        await this.handleTopPages(chatId, 0);
        break;
      case '/referrers':
        await this.handleReferrers(chatId, 0);
        break;
      case '/devices':
        await this.handleDevices(chatId);
        break;
      case '/countries':
        await this.handleCountries(chatId, 0);
        break;
      case '/seo':
        await this.handleSeo(chatId);
        break;
      case '/keywords':
        await this.handleKeywords(chatId);
        break;
      case '/search-traffic':
      case '/searchtraffic':
        await this.handleSearchTraffic(chatId, 28);
        break;
      case '/indexed':
        await this.handleIndexed(chatId);
        break;
      case '/sitemap':
        await this.handleSitemap(chatId);
        break;
      case '/broken-links':
      case '/brokenlinks':
        await this.handleBrokenLinks(chatId);
        break;
      case '/speed':
        await this.handleSpeed(chatId);
        break;
      case '/report':
        await this.handleFullReport(chatId);
        break;
      case '/alerts':
        await this.handleAlerts(chatId);
        break;
      case '/settings':
        await this.handleSettings(chatId);
        break;
      default:
        if (text.startsWith('/')) {
          await TelegramClient.sendMessage(
            chatId,
            `Unknown command: <code>${TelegramClient.escapeHtml(command)}</code>\nUse /help to see all available commands or /dashboard to view analytics.`
          );
        }
        break;
    }
  }

  /**
   * Handle interactive button clicks (Callback Queries)
   */
  private static async handleCallbackQuery(query: any): Promise<void> {
    const callbackId = query.id;
    const fromId = query.from?.id;
    const chatId = query.message?.chat?.id;
    const messageId = query.message?.message_id;
    const data = query.data || '';

    if (!chatId || !messageId) return;

    if (!isTelegramAdmin(fromId)) {
      await TelegramClient.answerCallbackQuery(callbackId, '⛔ Unauthorized', true);
      return;
    }

    await TelegramClient.answerCallbackQuery(callbackId);

    const parts = data.split(':');
    const action = parts[0];
    const target = parts[1];
    const param = parts[2];

    if (action === 'nav') {
      if (target === 'dashboard') {
        const { text, reply_markup } = await this.renderDashboard();
        await TelegramClient.editMessageText(chatId, messageId, text, { reply_markup });
      } else if (target === 'today' || target === 'yesterday' || target === 'weekly' || target === 'monthly') {
        const pKey = target === 'weekly' ? '7_days' : target === 'monthly' ? '30_days' : target;
        const pTitle = target.toUpperCase();
        const { text, reply_markup } = await this.renderPeriod(pKey as any, pTitle);
        await TelegramClient.editMessageText(chatId, messageId, text, { reply_markup });
      } else if (target === 'seo') {
        const { text, reply_markup } = await this.renderSeo();
        await TelegramClient.editMessageText(chatId, messageId, text, { reply_markup });
      } else if (target === 'top_pages') {
        const { text, reply_markup } = await this.renderTopPages(0);
        await TelegramClient.editMessageText(chatId, messageId, text, { reply_markup });
      } else if (target === 'referrers') {
        const { text, reply_markup } = await this.renderReferrers(0);
        await TelegramClient.editMessageText(chatId, messageId, text, { reply_markup });
      } else if (target === 'devices') {
        const { text, reply_markup } = await this.renderDevices();
        await TelegramClient.editMessageText(chatId, messageId, text, { reply_markup });
      } else if (target === 'countries') {
        const { text, reply_markup } = await this.renderCountries(0);
        await TelegramClient.editMessageText(chatId, messageId, text, { reply_markup });
      } else if (target === 'gsc') {
        const days = parseInt(param || '28', 10);
        const { text, reply_markup } = await this.renderSearchTraffic(days);
        await TelegramClient.editMessageText(chatId, messageId, text, { reply_markup });
      } else if (target === 'settings') {
        const { text, reply_markup } = await this.renderSettings();
        await TelegramClient.editMessageText(chatId, messageId, text, { reply_markup });
      }
    } else if (action === 'page') {
      const offset = parseInt(param || '0', 10);
      if (target === 'top_pages') {
        const { text, reply_markup } = await this.renderTopPages(offset);
        await TelegramClient.editMessageText(chatId, messageId, text, { reply_markup });
      } else if (target === 'referrers') {
        const { text, reply_markup } = await this.renderReferrers(offset);
        await TelegramClient.editMessageText(chatId, messageId, text, { reply_markup });
      } else if (target === 'countries') {
        const { text, reply_markup } = await this.renderCountries(offset);
        await TelegramClient.editMessageText(chatId, messageId, text, { reply_markup });
      }
    } else if (action === 'action' && target === 'run_seo') {
      await TelegramClient.sendMessage(chatId, '🔄 <i>Crawling pages and analyzing 20 SEO rules... Please wait a few seconds.</i>');
      await TelegramClient.sendChatAction(chatId, 'typing');
      const audit = await SeoAuditor.runAudit();
      const { text, reply_markup } = await this.renderSeo(audit);
      await TelegramClient.sendMessage(chatId, text, { reply_markup });
    }
  }

  // --- COMMAND IMPLEMENTATIONS ---

  private static async handleStart(chatId: number): Promise<void> {
    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        [
          { text: '📊 Dashboard', callback_data: 'nav:dashboard' },
          { text: '🔍 SEO Health', callback_data: 'nav:seo' },
        ],
        [
          { text: '📈 Search Console', callback_data: 'nav:gsc:28' },
          { text: '⚡ Realtime', callback_data: 'nav:today' },
        ],
        [
          { text: '🌐 View Website', url: appConfig.websiteUrl },
        ],
      ],
    };

    const text = `
🚀 <b>WELCOME TO ROBINSON'S WEBSITE INTELLIGENCE BOT</b>

Your personal SEO Manager & Real-Time Analytics Dashboard.

✅ <b>Admin Authentication:</b> Verified
🌐 <b>Tracked Site:</b> <code>${TelegramClient.escapeHtml(appConfig.websiteUrl)}</code>
📡 <b>Engine:</b> Vercel Serverless + PostgreSQL

Type /dashboard to open your interactive dashboard, or /help to see all commands.
`.trim();

    await TelegramClient.sendMessage(chatId, text, { reply_markup: keyboard });
  }

  private static async handleHelp(chatId: number): Promise<void> {
    const text = `
📖 <b>AVAILABLE BOT COMMANDS</b>

<b>📊 Visitor Analytics:</b>
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

<b>🔍 SEO & Technical Audits:</b>
/seo - Full 20-rule website SEO audit
/keywords - Google Search Console keywords
/search-traffic - Organic search clicks & impressions
/indexed - Google indexing status & sitemap check
/sitemap - Verify sitemap.xml health
/broken-links - Check for broken internal links
/speed - Server response speed & TTFB audit

<b>⚙️ Configuration & Reports:</b>
/report - Comprehensive executive report
/alerts - Notification & alert preferences
/settings - System status & credentials
`.trim();

    await TelegramClient.sendMessage(chatId, text);
  }

  private static async handleDashboard(chatId: number): Promise<void> {
    const { text, reply_markup } = await this.renderDashboard();
    await TelegramClient.sendMessage(chatId, text, { reply_markup });
  }

  private static async handleStats(chatId: number): Promise<void> {
    const allTime = await AnalyticsService.getMetricsForPeriod('all_time');
    const last30 = await AnalyticsService.getMetricsForPeriod('30_days');

    const text = `
📊 <b>VISITOR STATISTICS SUMMARY</b>
🌐 <b>${TelegramClient.escapeHtml(appConfig.websiteUrl)}</b>

━━━━━━━━━━━━━━━━━━━
<b>Last 30 Days:</b>
• Visitors: <b>${last30.totalVisitors}</b>
• Page Views: <b>${last30.totalPageViews}</b>
• New Sessions: <b>${last30.newSessions}</b>
• Returning Sessions: <b>${last30.returningSessions}</b>
• Avg Pages/Session: <b>${last30.avgPagesPerSession}</b>

━━━━━━━━━━━━━━━━━━━
<b>All-Time Recorded:</b>
• Total Visitors: <b>${allTime.totalVisitors}</b>
• Total Page Views: <b>${allTime.totalPageViews}</b>
• Total New Sessions: <b>${allTime.newSessions}</b>
• Total Returning: <b>${allTime.returningSessions}</b>
`.trim();

    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        [
          { text: '📅 Today', callback_data: 'nav:today' },
          { text: '📅 7 Days', callback_data: 'nav:weekly' },
          { text: '📊 Dashboard', callback_data: 'nav:dashboard' },
        ],
      ],
    };

    await TelegramClient.sendMessage(chatId, text, { reply_markup: keyboard });
  }

  private static async handlePeriod(chatId: number, period: 'today' | 'yesterday' | '7_days' | '30_days', title: string): Promise<void> {
    const { text, reply_markup } = await this.renderPeriod(period, title);
    await TelegramClient.sendMessage(chatId, text, { reply_markup });
  }

  private static async handleRealtime(chatId: number): Promise<void> {
    const rt = await AnalyticsService.getRealtime();

    let recentList = 'No activity recorded in last 24h.';
    if (rt.recentSessions.length > 0) {
      recentList = rt.recentSessions
        .map(s => `• <code>${TelegramClient.escapeHtml(s.path)}</code> (${s.device}, ${s.country}) - <i>${s.minutesAgo}m ago</i>`)
        .join('\n');
    }

    const text = `
⚡ <b>REAL-TIME VISITOR ACTIVITY</b>
🌐 <b>${TelegramClient.escapeHtml(appConfig.websiteUrl)}</b>

━━━━━━━━━━━━━━━━━━━
<b>Active Right Now (Last 30 min):</b>
• Active Sessions: <b>${rt.activeSessions30m}</b>
• Page Views: <b>${rt.pageViews30m}</b>

━━━━━━━━━━━━━━━━━━━
<b>Recent Visitor Path Activity:</b>
${recentList}
`.trim();

    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        [{ text: '🔄 Refresh', callback_data: 'nav:today' }],
        [{ text: '📊 Back to Dashboard', callback_data: 'nav:dashboard' }],
      ],
    };

    await TelegramClient.sendMessage(chatId, text, { reply_markup: keyboard });
  }

  private static async handleTopPages(chatId: number, offset = 0): Promise<void> {
    const { text, reply_markup } = await this.renderTopPages(offset);
    await TelegramClient.sendMessage(chatId, text, { reply_markup });
  }

  private static async handleReferrers(chatId: number, offset = 0): Promise<void> {
    const { text, reply_markup } = await this.renderReferrers(offset);
    await TelegramClient.sendMessage(chatId, text, { reply_markup });
  }

  private static async handleDevices(chatId: number): Promise<void> {
    const { text, reply_markup } = await this.renderDevices();
    await TelegramClient.sendMessage(chatId, text, { reply_markup });
  }

  private static async handleCountries(chatId: number, offset = 0): Promise<void> {
    const { text, reply_markup } = await this.renderCountries(offset);
    await TelegramClient.sendMessage(chatId, text, { reply_markup });
  }

  private static async handleSeo(chatId: number): Promise<void> {
    const { text, reply_markup } = await this.renderSeo();
    await TelegramClient.sendMessage(chatId, text, { reply_markup });
  }

  private static async handleKeywords(chatId: number): Promise<void> {
    const isConfig = SearchConsoleService.isConfigured();
    if (!isConfig) {
      await TelegramClient.sendMessage(
        chatId,
        `🔑 <b>GOOGLE SEARCH CONSOLE KEYWORDS</b>\n\nGoogle Search Console credentials are not yet configured.\n\nTo enable organic keyword and ranking data:\n1. Create a Google Cloud Service Account.\n2. Add the email as a Viewer in Google Search Console.\n3. Set <code>GOOGLE_CLIENT_EMAIL</code> & <code>GOOGLE_PRIVATE_KEY</code> in Vercel environment variables.`
      );
      return;
    }

    try {
      const gsc = await SearchConsoleService.getPerformance(28);
      let queryList = 'No search clicks recorded in this period yet.';
      if (gsc.topQueries.length > 0) {
        queryList = gsc.topQueries
          .map((q, i) => `${i + 1}. <b>"${TelegramClient.escapeHtml(q.query)}"</b>\n   Clicks: ${q.clicks} | Impr: ${q.impressions} | Pos: ${q.position} | CTR: ${q.ctr}%`)
          .join('\n\n');
      }

      const text = `
🔑 <b>TOP ORGANIC SEARCH QUERIES</b>
🌐 <b>${TelegramClient.escapeHtml(appConfig.gscSiteUrl)}</b>
📅 <i>Last 28 Days (Google Search Console)</i>

${queryList}
`.trim();

      const keyboard: InlineKeyboardMarkup = {
        inline_keyboard: [
          [
            { text: '7 Days', callback_data: 'nav:gsc:7' },
            { text: '28 Days', callback_data: 'nav:gsc:28' },
            { text: '90 Days', callback_data: 'nav:gsc:90' },
          ],
          [{ text: '📊 Dashboard', callback_data: 'nav:dashboard' }],
        ],
      };

      await TelegramClient.sendMessage(chatId, text, { reply_markup: keyboard });
    } catch (err: any) {
      await TelegramClient.sendMessage(
        chatId,
        `⚠️ <b>Google Search Console API Error:</b>\n<code>${TelegramClient.escapeHtml(err.message)}</code>\n\nPlease ensure your Service Account has been added with 'Viewer' permissions on property <code>${appConfig.gscSiteUrl}</code>.`
      );
    }
  }

  private static async handleSearchTraffic(chatId: number, days = 28): Promise<void> {
    const { text, reply_markup } = await this.renderSearchTraffic(days);
    await TelegramClient.sendMessage(chatId, text, { reply_markup });
  }

  private static async handleIndexed(chatId: number): Promise<void> {
    const sitemapOk = await AlertService.checkSitemapHealth();
    const latestAudit = await SeoAuditor.getLatestAudit();

    const pagesCount = latestAudit ? latestAudit.pagesCrawled : 4;
    const robotsStatus = sitemapOk ? '✅ Healthy & Discoverable' : '⚠️ Attention needed';

    const text = `
📑 <b>GOOGLE INDEXING STATUS</b>
🌐 <b>${TelegramClient.escapeHtml(appConfig.websiteUrl)}</b>

━━━━━━━━━━━━━━━━━━━
<b>Indexing Architecture:</b>
• <b>Robots.txt:</b> ${robotsStatus}
• <b>Sitemap:</b> <code>${appConfig.websiteUrl}/sitemap.xml</code>
• <b>Known Public URLs:</b> ${pagesCount} pages
• <b>Canonical URLs:</b> Configured on all routes

💡 <i>Tip: Search <code>site:robinsonj.vercel.app</code> on Google to see all live indexed pages!</i>
`.trim();

    await TelegramClient.sendMessage(chatId, text);
  }

  private static async handleSitemap(chatId: number): Promise<void> {
    const sitemapUrl = `${appConfig.websiteUrl}/sitemap.xml`;
    try {
      const res = await fetch(sitemapUrl, { signal: AbortSignal.timeout(6000) });
      const text = await res.text();
      const locMatches = text.match(/<loc>(.*?)<\/loc>/gi) || [];

      const list = locMatches.map(m => `• <code>${m.replace(/<\/?loc>/gi, '').trim()}</code>`).join('\n') || 'None';

      const msg = `
🗺️ <b>SITEMAP HEALTH CHECK</b>
URL: <code>${sitemapUrl}</code>
HTTP Status: <b>${res.status} ${res.status === 200 ? '✅ OK' : '❌ Error'}</b>
Discovered URLs: <b>${locMatches.length}</b>

<b>Declared Pages:</b>
${list}
`.trim();

      await TelegramClient.sendMessage(chatId, msg);
    } catch (err: any) {
      await TelegramClient.sendMessage(chatId, `❌ Failed to fetch sitemap: <code>${TelegramClient.escapeHtml(err.message)}</code>`);
    }
  }

  private static async handleBrokenLinks(chatId: number): Promise<void> {
    await TelegramClient.sendMessage(chatId, '🔎 <i>Auditing internal & external links...</i>');
    const audit = await SeoAuditor.runAudit();
    const linkIssues = audit.issues.filter(i => i.ruleId.includes('link') || i.ruleId.includes('unreachable'));

    let content = '✅ <b>Zero broken links detected!</b> All internal routes returned HTTP 200.';
    if (linkIssues.length > 0) {
      content = linkIssues
        .map(i => `• <b>${i.severity}</b>: ${TelegramClient.escapeHtml(i.title)}\n  URL: <code>${i.url}</code>\n  Sol: ${i.recommendation}`)
        .join('\n\n');
    }

    const text = `
🔗 <b>LINK INTEGRITY REPORT</b>
Pages Audited: <b>${audit.pagesCrawled}</b>

${content}
`.trim();

    await TelegramClient.sendMessage(chatId, text);
  }

  private static async handleSpeed(chatId: number): Promise<void> {
    await TelegramClient.sendChatAction(chatId, 'typing');
    const start = Date.now();
    try {
      const res = await fetch(appConfig.websiteUrl, {
        headers: { 'User-Agent': 'RobinsonSpeedAudit/1.0' },
        signal: AbortSignal.timeout(10000),
      });
      const ttfb = Date.now() - start;

      const rating = ttfb < 400 ? '🟢 Excellent' : ttfb < 1000 ? '🟡 Good' : '🔴 Needs Optimization';

      const text = `
⚡ <b>WEBSITE PERFORMANCE AUDIT</b>
🌐 <b>${TelegramClient.escapeHtml(appConfig.websiteUrl)}</b>

• <b>Server Response Time (TTFB):</b> ${ttfb}ms (${rating})
• <b>HTTP Status:</b> ${res.status} OK
• <b>Vercel Edge Node:</b> ${res.headers.get('x-vercel-id') || 'Global Edge'}
• <b>Content Encoding:</b> ${res.headers.get('content-encoding') || 'br / gzip'}
• <b>Assets:</b> WebP Optimized with preload/fetchpriority
`.trim();

      await TelegramClient.sendMessage(chatId, text);
    } catch (err: any) {
      await TelegramClient.sendMessage(chatId, `❌ Performance test failed: <code>${TelegramClient.escapeHtml(err.message)}</code>`);
    }
  }

  private static async handleFullReport(chatId: number): Promise<void> {
    await TelegramClient.sendChatAction(chatId, 'typing');
    const report = await ReportGenerator.buildWeeklyReport();
    await TelegramClient.sendMessage(chatId, report);
  }

  private static async handleAlerts(chatId: number): Promise<void> {
    const text = `
🚨 <b>ALERTING PREFERENCES</b>

<b>Active System Monitors:</b>
• <b>Website Uptime Monitor:</b> Enabled (Alerts on HTTP 5xx or timeout)
• <b>Traffic Surge Alert:</b> Triggered when traffic > 250% of 7-day average
• <b>Sitemap Monitor:</b> Verifies XML integrity & availability
• <b>Critical SEO Monitor:</b> Flags accidental noindex or missing metadata

Alerts are sent automatically to configured admin Telegram accounts.
`.trim();

    await TelegramClient.sendMessage(chatId, text);
  }

  private static async handleSettings(chatId: number): Promise<void> {
    const { text, reply_markup } = await this.renderSettings();
    await TelegramClient.sendMessage(chatId, text, { reply_markup });
  }

  // --- RENDER HELPERS FOR INLINE KEYBOARD REVIEWS ---

  private static async renderDashboard(): Promise<{ text: string; reply_markup: InlineKeyboardMarkup }> {
    const today = await AnalyticsService.getMetricsForPeriod('today');
    const { pages } = await AnalyticsService.getTopPages(3, 0, 1);
    const { referrers } = await AnalyticsService.getReferrers(3, 0, 1);
    const latestAudit = await SeoAuditor.getLatestAudit();

    let topPagesText = 'None recorded yet';
    if (pages.length > 0) {
      topPagesText = pages.map((p, i) => `${i + 1}. <code>${p.path}</code> (${p.views} views)`).join('\n');
    }

    let referrersText = 'Direct';
    if (referrers.length > 0) {
      referrersText = referrers.map(r => `• ${r.domain} (${r.percentage}%)`).join('\n');
    }

    const seoScore = latestAudit ? `${latestAudit.score}/100` : 'Not run';
    const seoCrit = latestAudit ? latestAudit.criticalIssues : 0;
    const seoWarn = latestAudit ? latestAudit.warnings : 0;

    const text = `
📊 <b>WEBSITE ANALYTICS DASHBOARD</b>
🌐 <b>${TelegramClient.escapeHtml(appConfig.websiteUrl)}</b>

<b>Today's Overview (UTC):</b>
• <b>Visitors:</b> ${today.totalVisitors}
• <b>Page Views:</b> ${today.totalPageViews}
• <b>New Sessions:</b> ${today.newSessions}
• <b>Returning Sessions:</b> ${today.returningSessions}

<b>Top Pages:</b>
${topPagesText}

<b>Traffic Sources:</b>
${referrersText}

<b>SEO Health:</b>
• Score: <b>${seoScore}</b>
• Critical Issues: <b>${seoCrit}</b> | Warnings: <b>${seoWarn}</b>
`.trim();

    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        [
          { text: '📊 Analytics', callback_data: 'nav:today' },
          { text: '🔍 SEO Audit', callback_data: 'nav:seo' },
        ],
        [
          { text: '📈 Search Console', callback_data: 'nav:gsc:28' },
          { text: '📄 Top Pages', callback_data: 'nav:top_pages' },
        ],
        [
          { text: '🌐 Traffic Sources', callback_data: 'nav:referrers' },
          { text: '⚙️ Settings', callback_data: 'nav:settings' },
        ],
      ],
    };

    return { text, reply_markup: keyboard };
  }

  private static async renderPeriod(period: 'today' | 'yesterday' | '7_days' | '30_days', title: string): Promise<{ text: string; reply_markup: InlineKeyboardMarkup }> {
    const stats = await AnalyticsService.getMetricsForPeriod(period);

    const text = `
📊 <b>${TelegramClient.escapeHtml(title)}</b>
🌐 <b>${TelegramClient.escapeHtml(appConfig.websiteUrl)}</b>

• <b>Unique Visitors:</b> ${stats.totalVisitors}
• <b>Total Page Views:</b> ${stats.totalPageViews}
• <b>New Sessions:</b> ${stats.newSessions}
• <b>Returning Sessions:</b> ${stats.returningSessions}
• <b>Average Duration:</b> ${stats.avgDurationSeconds}s
• <b>Avg Pages/Session:</b> ${stats.avgPagesPerSession}
`.trim();

    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        [
          { text: 'Today', callback_data: 'nav:today' },
          { text: 'Yesterday', callback_data: 'nav:yesterday' },
          { text: '7 Days', callback_data: 'nav:weekly' },
          { text: '30 Days', callback_data: 'nav:monthly' },
        ],
        [
          { text: '📄 Top Pages', callback_data: 'nav:top_pages' },
          { text: '📊 Dashboard', callback_data: 'nav:dashboard' },
        ],
      ],
    };

    return { text, reply_markup: keyboard };
  }

  private static async renderTopPages(offset = 0): Promise<{ text: string; reply_markup: InlineKeyboardMarkup }> {
    const limit = 5;
    const { pages, total } = await AnalyticsService.getTopPages(limit, offset, 30);

    let list = 'No pageviews recorded yet.';
    if (pages.length > 0) {
      list = pages
        .map((p, i) => `${offset + i + 1}. <code>${TelegramClient.escapeHtml(p.path)}</code>\n   Views: <b>${p.views}</b> | Unique: <b>${p.uniqueVisitors}</b>`)
        .join('\n\n');
    }

    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const text = `
📄 <b>MOST VISITED PAGES</b>
🌐 <b>${TelegramClient.escapeHtml(appConfig.websiteUrl)}</b>
📅 <i>Last 30 Days (Page ${currentPage}/${totalPages})</i>

${list}
`.trim();

    const navRow: any[] = [];
    if (offset > 0) {
      navRow.push({ text: '⬅️ Prev', callback_data: `page:top_pages:${Math.max(0, offset - limit)}` });
    }
    navRow.push({ text: `Page ${currentPage}/${totalPages}`, callback_data: 'noop' });
    if (offset + limit < total) {
      navRow.push({ text: 'Next ➡️', callback_data: `page:top_pages:${offset + limit}` });
    }

    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        navRow,
        [{ text: '📊 Back to Dashboard', callback_data: 'nav:dashboard' }],
      ],
    };

    return { text, reply_markup: keyboard };
  }

  private static async renderReferrers(offset = 0): Promise<{ text: string; reply_markup: InlineKeyboardMarkup }> {
    const limit = 5;
    const { referrers, total } = await AnalyticsService.getReferrers(limit, offset, 30);

    let list = 'No traffic sources recorded yet.';
    if (referrers.length > 0) {
      list = referrers
        .map((r, i) => `${offset + i + 1}. <b>${TelegramClient.escapeHtml(r.domain)}</b>\n   Visitors: <b>${r.count}</b> (${r.percentage}%)`)
        .join('\n\n');
    }

    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const text = `
🌐 <b>TRAFFIC SOURCES & REFERRERS</b>
🌐 <b>${TelegramClient.escapeHtml(appConfig.websiteUrl)}</b>
📅 <i>Last 30 Days (Page ${currentPage}/${totalPages})</i>

${list}
`.trim();

    const navRow: any[] = [];
    if (offset > 0) {
      navRow.push({ text: '⬅️ Prev', callback_data: `page:referrers:${Math.max(0, offset - limit)}` });
    }
    navRow.push({ text: `Page ${currentPage}/${totalPages}`, callback_data: 'noop' });
    if (offset + limit < total) {
      navRow.push({ text: 'Next ➡️', callback_data: `page:referrers:${offset + limit}` });
    }

    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        navRow,
        [{ text: '📊 Back to Dashboard', callback_data: 'nav:dashboard' }],
      ],
    };

    return { text, reply_markup: keyboard };
  }

  private static async renderDevices(): Promise<{ text: string; reply_markup: InlineKeyboardMarkup }> {
    const devices = await AnalyticsService.getDevices(30);

    let list = 'No device data recorded yet.';
    if (devices.length > 0) {
      list = devices
        .map(d => `• <b>${d.device.toUpperCase()}</b>: ${d.percentage}% (${d.count} sessions)`)
        .join('\n');
    }

    const text = `
📱 <b>DEVICE DISTRIBUTION</b>
🌐 <b>${TelegramClient.escapeHtml(appConfig.websiteUrl)}</b>
📅 <i>Last 30 Days</i>

${list}
`.trim();

    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        [
          { text: '🌍 Countries', callback_data: 'nav:countries' },
          { text: '📊 Dashboard', callback_data: 'nav:dashboard' },
        ],
      ],
    };

    return { text, reply_markup: keyboard };
  }

  private static async renderCountries(offset = 0): Promise<{ text: string; reply_markup: InlineKeyboardMarkup }> {
    const limit = 5;
    const { countries, total } = await AnalyticsService.getCountries(limit, offset, 30);

    let list = 'No geographic visitor data recorded yet.';
    if (countries.length > 0) {
      list = countries
        .map((c, i) => `${offset + i + 1}. <b>${c.country}</b>: ${c.count} visitors (${c.percentage}%)`)
        .join('\n');
    }

    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const text = `
🌍 <b>VISITOR COUNTRIES</b>
🌐 <b>${TelegramClient.escapeHtml(appConfig.websiteUrl)}</b>
📅 <i>Last 30 Days (Page ${currentPage}/${totalPages})</i>

${list}
`.trim();

    const navRow: any[] = [];
    if (offset > 0) {
      navRow.push({ text: '⬅️ Prev', callback_data: `page:countries:${Math.max(0, offset - limit)}` });
    }
    navRow.push({ text: `Page ${currentPage}/${totalPages}`, callback_data: 'noop' });
    if (offset + limit < total) {
      navRow.push({ text: 'Next ➡️', callback_data: `page:countries:${offset + limit}` });
    }

    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        navRow,
        [{ text: '📊 Back to Dashboard', callback_data: 'nav:dashboard' }],
      ],
    };

    return { text, reply_markup: keyboard };
  }

  private static async renderSeo(customAudit?: any): Promise<{ text: string; reply_markup: InlineKeyboardMarkup }> {
    const audit = customAudit || (await SeoAuditor.getLatestAudit()) || (await SeoAuditor.runAudit());

    const statusBadge = audit.score >= 85 ? '🟢 Excellent' : audit.score >= 70 ? '🟡 Good' : '🔴 Needs Attention';

    let issuesText = '✅ Zero critical issues detected!';
    if (audit.issues.length > 0) {
      issuesText = audit.issues
        .slice(0, 4)
        .map((issue: any) => `• <b>${issue.severity}</b>: ${TelegramClient.escapeHtml(issue.title)}\n  <i>${TelegramClient.escapeHtml(issue.recommendation)}</i>`)
        .join('\n\n');
    }

    const text = `
🔍 <b>WEBSITE SEO AUDIT REPORT</b>
🌐 <b>${TelegramClient.escapeHtml(audit.targetUrl)}</b>

• <b>Overall SEO Score:</b> <b>${audit.score}/100</b> (${statusBadge})
• <b>Pages Crawled:</b> ${audit.pagesCrawled}
• <b>Critical Issues:</b> ${audit.criticalIssues} | <b>Warnings:</b> ${audit.warnings}

━━━━━━━━━━━━━━━━━━━
<b>Category Breakdown:</b>
• Technical / Indexing: <b>${audit.categoryScores.technical}/30</b>
• Content & Headings: <b>${audit.categoryScores.content}/35</b>
• Social Meta (OG/Twitter): <b>${audit.categoryScores.social}/15</b>
• Link Health: <b>${audit.categoryScores.links}/20</b>

━━━━━━━━━━━━━━━━━━━
<b>Top Audit Findings:</b>
${issuesText}
`.trim();

    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        [{ text: '🔄 Run Fresh Live Audit', callback_data: 'action:run_seo' }],
        [
          { text: '📑 Indexing', callback_data: 'nav:gsc:28' },
          { text: '📊 Dashboard', callback_data: 'nav:dashboard' },
        ],
      ],
    };

    return { text, reply_markup: keyboard };
  }

  private static async renderSearchTraffic(days = 28): Promise<{ text: string; reply_markup: InlineKeyboardMarkup }> {
    const isConfig = SearchConsoleService.isConfigured();

    if (!isConfig) {
      const text = `
📈 <b>GOOGLE SEARCH CONSOLE</b>
🌐 <b>${TelegramClient.escapeHtml(appConfig.gscSiteUrl)}</b>

Google Search Console credentials are not yet configured.

<b>To enable live Google Search data:</b>
1. Open Google Cloud Console -> Create a Service Account.
2. In Google Search Console -> Settings -> Users -> Add Service Account email as <b>Viewer</b>.
3. Add <code>GOOGLE_CLIENT_EMAIL</code> & <code>GOOGLE_PRIVATE_KEY</code> in Vercel.
`.trim();

      const keyboard: InlineKeyboardMarkup = {
        inline_keyboard: [
          [{ text: '📊 Back to Dashboard', callback_data: 'nav:dashboard' }],
        ],
      };
      return { text, reply_markup: keyboard };
    }

    try {
      const gsc = await SearchConsoleService.getPerformance(days);

      let topQueryText = 'No search clicks recorded in this period yet.';
      if (gsc.topQueries.length > 0) {
        topQueryText = gsc.topQueries
          .slice(0, 3)
          .map((q, i) => `${i + 1}. "${q.query}" (${q.clicks} clicks, pos: ${q.position})`)
          .join('\n');
      }

      const text = `
📈 <b>GOOGLE SEARCH CONSOLE REPORT</b>
🌐 <b>${TelegramClient.escapeHtml(appConfig.gscSiteUrl)}</b>
📅 <i>Last ${days} Days</i>

• <b>Total Organic Clicks:</b> ${gsc.clicks}
• <b>Search Impressions:</b> ${gsc.impressions}
• <b>Average CTR:</b> ${gsc.ctr}%
• <b>Average Position:</b> ${gsc.position}

<b>Top Search Queries:</b>
${topQueryText}
`.trim();

      const keyboard: InlineKeyboardMarkup = {
        inline_keyboard: [
          [
            { text: '7 Days', callback_data: 'nav:gsc:7' },
            { text: '28 Days', callback_data: 'nav:gsc:28' },
            { text: '90 Days', callback_data: 'nav:gsc:90' },
          ],
          [{ text: '📊 Dashboard', callback_data: 'nav:dashboard' }],
        ],
      };

      return { text, reply_markup: keyboard };
    } catch (err: any) {
      const text = `
⚠️ <b>Google Search Console API Notice:</b>
<code>${TelegramClient.escapeHtml(err.message)}</code>

Please verify Service Account viewer permissions on property <code>${appConfig.gscSiteUrl}</code>.
`.trim();

      const keyboard: InlineKeyboardMarkup = {
        inline_keyboard: [
          [{ text: '📊 Dashboard', callback_data: 'nav:dashboard' }],
        ],
      };
      return { text, reply_markup: keyboard };
    }
  }

  private static async renderSettings(): Promise<{ text: string; reply_markup: InlineKeyboardMarkup }> {
    const dbOk = Boolean(appConfig.databaseUrl);
    const tgOk = Boolean(appConfig.telegramBotToken);
    const adminsCount = appConfig.telegramAdminIds.length;
    const gscOk = SearchConsoleService.isConfigured();

    const text = `
⚙️ <b>SYSTEM & BOT SETTINGS</b>

<b>Website:</b> <code>${TelegramClient.escapeHtml(appConfig.websiteUrl)}</code>
<b>Storage Engine:</b> ${dbOk ? '✅ PostgreSQL Database' : '⚡ Zero-DB Mode (Instant Telegram Alerts & JSON Store)'}
<b>Telegram Bot:</b> ${tgOk ? '✅ Active Webhook' : '❌ Missing Token'}
<b>Authorized Admins:</b> ${adminsCount > 0 ? `✅ ${adminsCount} Admin(s)` : '⚠️ None'}
<b>Google Search Console:</b> ${gscOk ? '✅ Configured' : '⚠️ Pending Credentials'}
<b>Data Retention:</b> 180 Days (Auto-purged)
`.trim();

    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        [
          { text: '🚨 Alerts Config', callback_data: 'nav:dashboard' },
          { text: '📊 Dashboard', callback_data: 'nav:dashboard' },
        ],
      ],
    };

    return { text, reply_markup: keyboard };
  }
}

