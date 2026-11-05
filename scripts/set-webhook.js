#!/usr/bin/env node
/**
 * Telegram Webhook Registration Script
 * Usage: node scripts/set-webhook.js
 */

const token = process.env.TELEGRAM_BOT_TOKEN;
const siteUrl = (process.env.WEBSITE_URL || 'https://robinsonj.vercel.app').replace(/\/+$/, '');
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!token) {
  console.error('❌ Error: TELEGRAM_BOT_TOKEN environment variable is not defined.');
  console.error('Usage: TELEGRAM_BOT_TOKEN="xxx" node scripts/set-webhook.js');
  process.exit(1);
}

const webhookUrl = `${siteUrl}/api/telegram/webhook`;

async function setWebhook() {
  console.log(`📡 Registering Telegram webhook for ${siteUrl}...`);
  console.log(`🔗 Webhook URL: ${webhookUrl}`);

  const body = {
    url: webhookUrl,
    drop_pending_updates: false,
    allowed_updates: ['message', 'callback_query'],
  };

  if (secret) {
    body.secret_token = secret;
    console.log('🔒 Secret token included.');
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (data.ok) {
      console.log('✅ Telegram Webhook registered successfully!');
      console.log('Telegram API response:', data);
    } else {
      console.error('❌ Failed to register webhook:', data.description);
    }
  } catch (err) {
    console.error('❌ Error registering webhook:', err.message);
  }
}

setWebhook();

