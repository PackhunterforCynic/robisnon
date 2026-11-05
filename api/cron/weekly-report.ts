/**
 * Vercel Cron Job: Weekly Intelligence Report & Data Retention Purge
 * Route: GET /api/cron/weekly-report
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ReportGenerator } from '../_lib/reportGenerator';
import { TelegramClient } from '../_lib/telegram';
import { appConfig } from '../_lib/config';
import { runDataRetentionCleanup } from '../_lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify Vercel Cron Secret (if configured)
  if (appConfig.cronSecret) {
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${appConfig.cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized cron trigger' });
    }
  }

  try {
    // 1. Dispatch Weekly Report to admins
    const reportText = await ReportGenerator.buildWeeklyReport();
    let sentCount = 0;
    for (const adminId of appConfig.telegramAdminIds) {
      try {
        await TelegramClient.sendMessage(adminId, reportText);
        sentCount++;
      } catch (err: any) {
        console.error(`[Cron:Weekly] Failed to send report to ${adminId}:`, err.message);
      }
    }

    // 2. Run data retention policy cleanup (180 days default)
    const cleanup = await runDataRetentionCleanup(180);

    return res.status(200).json({
      success: true,
      sentTo: sentCount,
      cleanedEvents: cleanup.deletedEvents,
      cleanedViews: cleanup.deletedPageViews,
    });
  } catch (err: any) {
    console.error('[Cron:Weekly] Error executing weekly cron:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

