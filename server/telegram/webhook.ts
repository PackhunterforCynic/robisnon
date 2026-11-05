/**
 * Vercel Serverless Function: Telegram Webhook Receiver
 * Route: POST /api/telegram/webhook
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { BotHandlers } from '../_lib/botHandlers';
import { appConfig, sanitizeLog } from '../_lib/config';

// In-memory cache to deduplicate Telegram updates during retries
const processedUpdateIds = new Set<number>();

function cleanOldUpdates() {
  if (processedUpdateIds.size > 1000) {
    const arr = Array.from(processedUpdateIds);
    for (let i = 0; i < 500; i++) {
      processedUpdateIds.delete(arr[i]);
    }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Verify Telegram Webhook Secret Token (if configured)
  if (appConfig.telegramWebhookSecret) {
    const incomingSecret = req.headers['x-telegram-bot-api-secret-token'];
    if (incomingSecret !== appConfig.telegramWebhookSecret) {
      console.warn('[Webhook] Unauthorized webhook request rejected.');
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const update = req.body;
  if (!update || typeof update !== 'object') {
    return res.status(400).json({ error: 'Invalid update payload' });
  }

  const updateId = update.update_id;
  if (typeof updateId === 'number') {
    if (processedUpdateIds.has(updateId)) {
      // Already processed, return 200 OK immediately
      return res.status(200).json({ status: 'already_processed' });
    }
    cleanOldUpdates();
    processedUpdateIds.add(updateId);
  }

  try {
    // Process update
    await BotHandlers.handleUpdate(update);
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('[Webhook] Error handling update:', sanitizeLog(err.message));
    // Always return 200 OK to Telegram so it doesn't enter an endless retry loop
    return res.status(200).json({ ok: false, error: 'Internal processing error' });
  }
}

