/**
 * Vercel Cron Job: Automated SEO Audit & Critical Problem Detection
 * Route: GET /api/cron/seo-audit
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SeoAuditor } from '../_lib/seoAuditor';
import { AlertService } from '../_lib/alertService';
import { appConfig } from '../_lib/config';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify Vercel Cron Secret (if configured)
  if (appConfig.cronSecret) {
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${appConfig.cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized cron trigger' });
    }
  }

  try {
    const audit = await SeoAuditor.runAudit();

    // Alert admins if critical SEO issues are detected
    if (audit.criticalIssues > 0) {
      const topIssues = audit.issues
        .filter(i => i.severity === 'CRITICAL')
        .slice(0, 3)
        .map(i => `• <b>${i.title}</b> (${i.url}): ${i.recommendation}`)
        .join('\n');

      await AlertService.sendAdminAlert(
        'Critical SEO Issues Detected',
        `Audit Score: <b>${audit.score}/100</b>\nCritical Issues: <b>${audit.criticalIssues}</b>\n\n${topIssues}`,
        'alert_seo'
      );
    }

    return res.status(200).json({
      success: true,
      score: audit.score,
      criticalIssues: audit.criticalIssues,
      warnings: audit.warnings,
      pagesCrawled: audit.pagesCrawled,
    });
  } catch (err: any) {
    console.error('[Cron:SeoAudit] Error running scheduled audit:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

