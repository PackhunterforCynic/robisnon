/**
 * Helper Endpoint: Telegram Webhook Setup & Health Check
 * Route: GET /api/setup/webhook?action=set
 *        GET /api/setup/webhook?action=info
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { TelegramClient } from '../lib/telegram';
import { config } from '../lib/config';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = req.query.action || 'info';

  if (!config.telegramBotToken) {
    return res.status(500).json({
      error: 'TELEGRAM_BOT_TOKEN is not configured in environment variables.',
      instructions: 'Please add TELEGRAM_BOT_TOKEN to your Vercel Project Settings.',
    });
  }

  const webhookUrl = `${config.websiteUrl}/api/telegram/webhook`;

  try {
    if (action === 'set') {
      const result = await TelegramClient.setWebhook(webhookUrl, config.telegramWebhookSecret || undefined);
      return res.status(200).json({
        action: 'setWebhook',
        targetWebhookUrl: webhookUrl,
        hasSecretToken: Boolean(config.telegramWebhookSecret),
        result,
      });
    }

    // Default: Return current webhook info
    const info = await TelegramClient.getWebhookInfo();
    return res.status(200).json({
      configuredWebsiteUrl: config.websiteUrl,
      expectedWebhookUrl: webhookUrl,
      currentWebhookInfo: info,
      instructions: 'To register or update the webhook, call this endpoint with ?action=set',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
