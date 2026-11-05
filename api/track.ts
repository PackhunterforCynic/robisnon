/**
 * Vercel Serverless Function: Analytics Ingestion Endpoint
 * Route: POST /api/track
 * Stores analytics in-memory + JSON store + sends instant Telegram alerts to admin!
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { query } from './lib/db';
import { isBotOrCrawler, validateTrackingPayload, extractReferrerDomain } from './lib/botFilter';
import { JsonAnalyticsStore } from './lib/jsonStore';
import { appConfig } from './lib/config';
import { TelegramClient } from './lib/telegram';

// In-memory deduplication cache for rapid duplicate calls
const recentEvents = new Map<string, number>();

function cleanRecentEventsCache() {
  const now = Date.now();
  if (recentEvents.size > 2000) {
    for (const [key, timestamp] of recentEvents.entries()) {
      if (now - timestamp > 10000) {
        recentEvents.delete(key);
      }
    }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userAgent = req.headers['user-agent'] as string | undefined;

    // Filter bots & crawlers immediately
    if (isBotOrCrawler(userAgent)) {
      return res.status(200).json({ status: 'ignored', reason: 'crawler_or_bot' });
    }

    // Resolve country from trusted Vercel edge header, never store raw IP
    const country = (
      (req.headers['x-vercel-ip-country'] as string) ||
      (req.headers['cf-ipcountry'] as string) ||
      'XX'
    ).slice(0, 8).toUpperCase();

    const { valid, payload, error } = validateTrackingPayload(req.body);
    if (!valid || !payload) {
      return res.status(400).json({ error: error || 'Invalid payload' });
    }

    // Deduplication key: sessionId + path + eventName within 2 seconds
    cleanRecentEventsCache();
    const dedupKey = `${payload.sessionId}:${payload.path}:${payload.eventName}`;
    const now = Date.now();
    const lastSeen = recentEvents.get(dedupKey);
    if (lastSeen && now - lastSeen < 2000 && payload.eventType === 'pageview') {
      return res.status(200).json({ status: 'deduplicated' });
    }
    recentEvents.set(dedupKey, now);

    const referrerDomain = extractReferrerDomain(payload.referrer) || 'Direct';

    // 1. ALWAYS record to in-memory JSON Store (Zero database required!)
    const { isNewSession } = JsonAnalyticsStore.recordEvent({
      sessionId: payload.sessionId,
      visitorId: payload.visitorId,
      path: payload.path,
      title: payload.title,
      referrer: payload.referrer,
      referrerDomain,
      deviceCategory: payload.deviceCategory,
      browser: payload.browser,
      os: payload.os,
      country,
      utmSource: payload.utmSource,
      durationSeconds: payload.durationSeconds,
    });

    // 2. Send instant real-time Telegram alert to admin on new visitor session
    if (isNewSession && appConfig.telegramBotToken && appConfig.telegramAdminIds.length > 0) {
      const alertMsg = `
🔔 <b>New Website Visitor!</b>
🌐 <b>${TelegramClient.escapeHtml(appConfig.websiteUrl)}</b>
📍 <b>Page:</b> <code>${TelegramClient.escapeHtml(payload.path)}</code>
🌍 <b>Country:</b> ${country}
💻 <b>Device:</b> ${payload.deviceCategory} (${payload.browser} on ${payload.os})
🔗 <b>Source:</b> ${referrerDomain}${payload.utmSource ? ` (UTM: ${payload.utmSource})` : ''}
`.trim();

      for (const adminId of appConfig.telegramAdminIds) {
        TelegramClient.sendMessage(adminId, alertMsg).catch(() => {});
      }
    }

    // 3. Optional: If PostgreSQL database is configured, also persist to SQL tables
    if (appConfig.databaseUrl) {
      try {
        const sessionRes = await query(
          `SELECT id, page_views_count, started_at FROM visitor_sessions WHERE session_id = $1 LIMIT 1`,
          [payload.sessionId]
        );

        if (sessionRes.rows.length === 0) {
          const prevVisitorRes = await query(
            `SELECT id FROM visitor_sessions WHERE visitor_id = $1 LIMIT 1`,
            [payload.visitorId]
          );
          const isReturning = prevVisitorRes.rows.length > 0;

          await query(
            `INSERT INTO visitor_sessions (
              session_id, visitor_id, is_returning, landing_page, exit_page,
              page_views_count, duration_seconds, device_category, browser, os,
              country, referrer, referrer_domain, utm_source, utm_medium, utm_campaign,
              started_at, last_activity_at
            ) VALUES (
              $1, $2, $3, $4, $5,
              $6, $7, $8, $9, $10,
              $11, $12, $13, $14, $15, $16,
              NOW() AT TIME ZONE 'UTC', NOW() AT TIME ZONE 'UTC'
            )`,
            [
              payload.sessionId,
              payload.visitorId,
              isReturning,
              payload.path,
              payload.path,
              1,
              payload.durationSeconds || 0,
              payload.deviceCategory,
              payload.browser,
              payload.os,
              country,
              payload.referrer || null,
              referrerDomain,
              payload.utmSource || null,
              payload.utmMedium || null,
              payload.utmCampaign || null,
            ]
          );
        } else {
          const existing = sessionRes.rows[0];
          const newPageViews = payload.eventType === 'pageview' ? existing.page_views_count + 1 : existing.page_views_count;
          
          await query(
            `UPDATE visitor_sessions SET
              last_activity_at = NOW() AT TIME ZONE 'UTC',
              exit_page = $1,
              page_views_count = $2,
              duration_seconds = GREATEST(duration_seconds, $3)
            WHERE session_id = $4`,
            [payload.path, newPageViews, payload.durationSeconds || 0, payload.sessionId]
          );
        }

        if (payload.eventType === 'pageview') {
          await query(
            `INSERT INTO page_views (session_id, path, title, duration_seconds)
             VALUES ($1, $2, $3, $4)`,
            [payload.sessionId, payload.path, payload.title || null, payload.durationSeconds || 0]
          );
        }
      } catch (dbErr: any) {
        console.warn('[Track] Optional DB insert bypassed:', dbErr.message);
      }
    }

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('[Track] Error processing tracking payload:', err.message);
    return res.status(200).json({ success: false, error: 'Ingestion bypassed' });
  }
}
