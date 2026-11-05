/**
 * Telegram Report Formatter
 * Generates structured, readable HTML messages for daily and weekly reports.
 */

import { AnalyticsService } from './analyticsService';
import { SeoAuditor } from './seoAuditor';
import { SearchConsoleService } from './searchConsole';
import { appConfig } from './config';
import { TelegramClient } from './telegram';

export class ReportGenerator {
  /**
   * Build Daily Visitor Report
   */
  static async buildDailyReport(): Promise<string> {
    const today = await AnalyticsService.getMetricsForPeriod('today');
    const yesterday = await AnalyticsService.getMetricsForPeriod('yesterday');
    const { pages } = await AnalyticsService.getTopPages(5, 0, 1);
    const { referrers } = await AnalyticsService.getReferrers(5, 0, 1);

    const changePct = yesterday.totalVisitors > 0
      ? Math.round(((today.totalVisitors - yesterday.totalVisitors) / yesterday.totalVisitors) * 100)
      : 0;
    const trendIcon = changePct >= 0 ? '📈' : '📉';

    let topPagesText = 'None recorded yet';
    if (pages.length > 0) {
      topPagesText = pages
        .map((p, i) => `${i + 1}. <code>${TelegramClient.escapeHtml(p.path)}</code> (${p.views} views)`)
        .join('\n');
    }

    let referrersText = 'Direct / None';
    if (referrers.length > 0) {
      referrersText = referrers
        .map(r => `• ${TelegramClient.escapeHtml(r.domain)}: ${r.count} (${r.percentage}%)`)
        .join('\n');
    }

    return `
📊 <b>DAILY WEBSITE REPORT</b>
🌐 <b>${TelegramClient.escapeHtml(appConfig.websiteUrl)}</b>
📅 <i>${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })} (UTC)</i>

━━━━━━━━━━━━━━━━━━━
<b>Traffic Overview:</b>
• <b>Unique Visitors:</b> ${today.totalVisitors} (${trendIcon} ${changePct >= 0 ? '+' : ''}${changePct}% vs yesterday)
• <b>Total Page Views:</b> ${today.totalPageViews}
• <b>New Sessions:</b> ${today.newSessions}
• <b>Returning Sessions:</b> ${today.returningSessions}
• <b>Avg Pages/Session:</b> ${today.avgPagesPerSession}

━━━━━━━━━━━━━━━━━━━
<b>Top 5 Pages:</b>
${topPagesText}

━━━━━━━━━━━━━━━━━━━
<b>Traffic Sources:</b>
${referrersText}
`.trim();
  }

  /**
   * Build Weekly Performance & Growth Report
   */
  static async buildWeeklyReport(): Promise<string> {
    const thisWeek = await AnalyticsService.getMetricsForPeriod('7_days');
    const { pages } = await AnalyticsService.getTopPages(5, 0, 7);
    const { referrers } = await AnalyticsService.getReferrers(5, 0, 7);
    const devices = await AnalyticsService.getDevices(7);
    const latestAudit = await SeoAuditor.getLatestAudit();
    const isGsc = SearchConsoleService.isConfigured();

    let gscSummary = '<i>Not configured</i> (Add Google credentials to enable)';
    if (isGsc) {
      try {
        const gsc = await SearchConsoleService.getPerformance(7);
        gscSummary = `• Clicks: <b>${gsc.clicks}</b> | Impressions: <b>${gsc.impressions}</b>\n• Avg CTR: <b>${gsc.ctr}%</b> | Avg Pos: <b>${gsc.position}</b>`;
      } catch {
        gscSummary = '<i>API query error or permission pending</i>';
      }
    }

    let deviceText = devices.map(d => `• ${d.device}: ${d.percentage}% (${d.count})`).join('\n') || 'No device data';
    let topPagesText = pages.map((p, i) => `${i + 1}. <code>${TelegramClient.escapeHtml(p.path)}</code>: ${p.views} views`).join('\n') || 'None';
    let referrersText = referrers.map(r => `• ${TelegramClient.escapeHtml(r.domain)}: ${r.count} (${r.percentage}%)`).join('\n') || 'Direct';

    const seoScore = latestAudit ? `${latestAudit.score}/100` : 'Not audited';
    const seoIssues = latestAudit ? `(Critical: ${latestAudit.criticalIssues}, Warnings: ${latestAudit.warnings})` : '';

    return `
📈 <b>WEEKLY INTELLIGENCE REPORT</b>
🌐 <b>${TelegramClient.escapeHtml(appConfig.websiteUrl)}</b>
📅 <i>Last 7 Days (UTC)</i>

━━━━━━━━━━━━━━━━━━━
<b>7-Day Audience:</b>
• <b>Unique Visitors:</b> ${thisWeek.totalVisitors}
• <b>Page Views:</b> ${thisWeek.totalPageViews}
• <b>New Sessions:</b> ${thisWeek.newSessions}
• <b>Returning Sessions:</b> ${thisWeek.returningSessions}

━━━━━━━━━━━━━━━━━━━
<b>Top Pages:</b>
${topPagesText}

━━━━━━━━━━━━━━━━━━━
<b>Top Traffic Sources:</b>
${referrersText}

━━━━━━━━━━━━━━━━━━━
<b>Devices:</b>
${deviceText}

━━━━━━━━━━━━━━━━━━━
<b>SEO Health:</b>
• Health Score: <b>${seoScore}</b> ${seoIssues}

━━━━━━━━━━━━━━━━━━━
<b>Google Search Console (7d):</b>
${gscSummary}
`.trim();
  }
}

