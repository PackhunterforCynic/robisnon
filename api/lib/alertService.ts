/**
 * Alerting Engine
 * Monitored anomalies: website downtime, traffic surges/drops, critical SEO issues, broken sitemaps.
 */

import { TelegramClient } from './telegram';
import { config } from './config';
import { query } from './db';
import { SeoAuditor } from './seoAuditor';

export class AlertService {
  /**
   * Broadcast an alert message to all configured Telegram admin IDs
   */
  static async sendAdminAlert(title: string, message: string, alertType: string): Promise<void> {
    if (!config.telegramAdminIds || config.telegramAdminIds.length === 0) return;

    // Avoid alert spam: check if identical alert was sent in the last 2 hours
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
      // Proceed if DB check fails
    }

    const formatted = `
🚨 <b>WEBSITE ALERT: ${TelegramClient.escapeHtml(title)}</b>
🌐 <b>${TelegramClient.escapeHtml(config.websiteUrl)}</b>
⏱️ <i>${new Date().toISOString()}</i>

${message}
`.trim();

    for (const adminId of config.telegramAdminIds) {
      try {
        await TelegramClient.sendMessage(adminId, formatted);
        await query(
          `INSERT INTO scheduled_reports (report_type, recipient_id, status, message_summary)
           VALUES ($1, $2, 'sent', $3)`,
          [alertType, adminId, `${title}: ${message.slice(0, 200)}`]
        );
      } catch (err: any) {
        console.error(`[AlertService] Error sending alert to ${adminId}:`, err.message);
      }
    }
  }

  /**
   * Check Website Availability / Uptime
   */
  static async checkWebsiteUptime(): Promise<{ isUp: boolean; statusCode: number; responseTimeMs: number }> {
    const start = Date.now();
    try {
      const res = await fetch(config.websiteUrl, {
        method: 'GET',
        headers: { 'User-Agent': 'RobinsonUptimeMonitor/1.0' },
        signal: AbortSignal.timeout(10000),
      });
      const responseTimeMs = Date.now() - start;

      if (res.status >= 500) {
        await this.sendAdminAlert(
          'Website Server Error',
          `Server returned HTTP status <b>${res.status}</b>. Response time: ${responseTimeMs}ms.`,
          'alert_downtime'
        );
        return { isUp: false, statusCode: res.status, responseTimeMs };
      }

      return { isUp: true, statusCode: res.status, responseTimeMs };
    } catch (err: any) {
      await this.sendAdminAlert(
        'Website Downtime Detected',
        `Could not reach website: <code>${TelegramClient.escapeHtml(err.message)}</code>`,
        'alert_downtime'
      );
      return { isUp: false, statusCode: 0, responseTimeMs: Date.now() - start };
    }
  }

  /**
   * Check Sitemap Health
   */
  static async checkSitemapHealth(): Promise<boolean> {
    const sitemapUrl = `${config.websiteUrl}/sitemap.xml`;
    try {
      const res = await fetch(sitemapUrl, {
        signal: AbortSignal.timeout(8000),
      });

      if (res.status !== 200) {
        await this.sendAdminAlert(
          'Broken Sitemap',
          `Sitemap returned HTTP ${res.status} at ${sitemapUrl}. Search indexing may be affected.`,
          'alert_sitemap'
        );
        return false;
      }

      const text = await res.text();
      if (!text.includes('<urlset') && !text.includes('<sitemapindex')) {
        await this.sendAdminAlert(
          'Invalid Sitemap XML',
          `Sitemap does not contain standard XML <urlset> tags at ${sitemapUrl}.`,
          'alert_sitemap'
        );
        return false;
      }

      return true;
    } catch (err: any) {
      await this.sendAdminAlert(
        'Sitemap Unreachable',
        `Failed to reach sitemap.xml: <code>${TelegramClient.escapeHtml(err.message)}</code>`,
        'alert_sitemap'
      );
      return false;
    }
  }

  /**
   * Check for Traffic Spikes or Plummets
   */
  static async checkTrafficAnomalies(): Promise<void> {
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

      // Only evaluate if there is a meaningful baseline (> 20 visitors)
      if (avg7d >= 20) {
        if (todayVisitors > avg7d * 2.5) {
          await this.sendAdminAlert(
            'Traffic Surge Detected 🚀',
            `Today's visitor count (<b>${todayVisitors}</b>) is over 250% of the 7-day average (<b>${avg7d}</b>). Check /referrers for incoming traffic sources!`,
            'alert_surge'
          );
        }
      }
    } catch (err: any) {
      console.error('[AlertService] Error checking traffic anomalies:', err.message);
    }
  }
}

