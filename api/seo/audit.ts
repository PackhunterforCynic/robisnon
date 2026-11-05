/**
 * Vercel Serverless Function: SEO Audit API
 * Route: GET /api/seo/audit (fetches latest)
 *        POST /api/seo/audit (triggers fresh audit)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SeoAuditor } from '../lib/seoAuditor';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'POST') {
      const url = typeof req.body?.url === 'string' ? req.body.url : undefined;
      const report = await SeoAuditor.runAudit(url);
      return res.status(200).json(report);
    } else {
      const latest = await SeoAuditor.getLatestAudit();
      if (latest) {
        return res.status(200).json(latest);
      }
      // If no audit in DB yet, run initial audit
      const initial = await SeoAuditor.runAudit();
      return res.status(200).json(initial);
    }
  } catch (err: any) {
    console.error('[Api:SeoAudit] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
