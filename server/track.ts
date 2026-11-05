/**
 * Vercel Serverless Function: Analytics Ingestion Endpoint
 * Route: POST /api/track
 * Stores analytics in-memory + JSON store + sends instant Telegram alerts to admin!
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { query } from './_lib/db';
import { isBotOrCrawler, validateTrackingPayload, extractReferrerDomain } from './_lib/botFilter';
import { JsonAnalyticsStore } from './_lib/jsonStore';
import { appConfig } from './_lib/config';
import { TelegramClient } from './_lib/telegram';

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

    // 0. Handle direct portfolio contact form submissions
    if (req.body && (req.body.eventType === 'contact' || req.body.isContactForm || (req.body.name && req.body.email && req.body.message))) {
      const name = String(req.body.name || '').trim();
      const email = String(req.body.email || '').trim();
      const message = String(req.body.message || '').trim();

      if (!name || !email || !message) {
        return res.status(400).json({ error: 'Name, email, and message are required fields.' });
      }

      const country = (
        (req.headers['x-vercel-ip-country'] as string) ||
        (req.headers['cf-ipcountry'] as string) ||
        'XX'
      ).slice(0, 8).toUpperCase();
      const flag = TelegramClient.getCountryFlag(country);

      const alertMsg = `
📬 <b>NEW PORTFOLIO INQUIRY RECEIVED!</b>
🌐 <code>${TelegramClient.escapeHtml(appConfig.websiteUrl)}</code> • <b>● INQUIRY</b>

<pre>
FROM     : ${TelegramClient.escapeHtml(name)}
EMAIL    : ${TelegramClient.escapeHtml(email)}
COUNTRY  : ${flag} ${country}
TIME     : ${new Date().toLocaleTimeString('en-US')} UTC
</pre>

<b>Message:</b>
<blockquote>${TelegramClient.escapeHtml(message)}</blockquote>
`.trim();

      const keyboard = {
        inline_keyboard: [
          [
            { text: '✉️ Reply to ' + name, url: `mailto:${encodeURIComponent(email)}?subject=Re:%20Inquiry%20via%20Robinson%20Portfolio` },
          ],
          [
            { text: '📊 Dashboard', callback_data: 'nav:dashboard' },
          ],
        ],
      };

      for (const adminId of appConfig.telegramAdminIds) {
        TelegramClient.sendMessage(adminId, alertMsg, { reply_markup: keyboard }).catch(err => {
          console.error('[Track] Telegram contact alert error:', err.message);
        });
      }

      return res.status(200).json({ ok: true, status: 'sent', message: 'Inquiry received successfully!' });
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
      const flag = TelegramClient.getCountryFlag(country);
      const cleanUrl = `${appConfig.websiteUrl}${payload.path === '/' ? '' : payload.path}`;
      const alertMsg = `
⚡ <b>REAL-TIME VISITOR ACTIVITY</b>
🌐 <code>${TelegramClient.escapeHtml(appConfig.websiteUrl)}</code> • <b>● ACTIVE</b>

<pre>
ROUTE    : ${payload.path}
ORIGIN   : ${flag} ${country}
DEVICE   : ${payload.deviceCategory} (${payload.browser} / ${payload.os})
SOURCE   : ${referrerDomain}${payload.utmSource ? ` [UTM: ${payload.utmSource}]` : ''}
SESSION  : New First-Time Visitor
</pre>
`.trim();

      const keyboard = {
        inline_keyboard: [
          [
            { text: '📊 Dashboard', callback_data: 'nav:dashboard' },
            { text: '🌐 Open Route ↗', url: cleanUrl },
          ],
        ],
      };

      for (const adminId of appConfig.telegramAdminIds) {
        TelegramClient.sendMessage(adminId, alertMsg, { reply_markup: keyboard }).catch(() => {});
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
