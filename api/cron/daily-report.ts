/**
 * Vercel Cron Job: Daily Report & Health Check
 * Route: GET /api/cron/daily-report
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ReportGenerator } from '../lib/reportGenerator';
import { AlertService } from '../lib/alertService';
import { TelegramClient } from '../lib/telegram';
import { appConfig } from '../lib/config';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify Vercel Cron Secret (if configured)
  if (appConfig.cronSecret) {
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${appConfig.cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized cron trigger' });
    }
  }

  try {
    // 1. Run uptime & sitemap health checks
    await AlertService.checkWebsiteUptime();
    await AlertService.checkSitemapHealth();
    await AlertService.checkTrafficAnomalies();

    // 2. Generate and dispatch daily report to admins
    const reportText = await ReportGenerator.buildDailyReport();

    let sentCount = 0;
    for (const adminId of appConfig.telegramAdminIds) {
      try {
        await TelegramClient.sendMessage(adminId, reportText);
        sentCount++;
      } catch (err: any) {
        console.error(`[Cron:Daily] Failed to send report to ${adminId}:`, err.message);
      }
    }

    return res.status(200).json({ success: true, sentTo: sentCount });
  } catch (err: any) {
    console.error('[Cron:Daily] Error executing daily cron:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

