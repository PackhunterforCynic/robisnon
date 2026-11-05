// server/_lib/config.ts
function parseAdminIds(raw) {
  if (!raw) return [];
  return raw.split(",").map((id) => id.trim()).filter((id) => id.length > 0);
}
function cleanPrivateKey(raw) {
  if (!raw) return void 0;
  return raw.replace(/\\n/g, "\n");
}
var appConfig = {
  databaseUrl: process.env.DATABASE_URL || "",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
  telegramAdminIds: parseAdminIds(process.env.TELEGRAM_ADMIN_IDS),
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || "",
  cronSecret: process.env.CRON_SECRET || "",
  websiteUrl: (process.env.WEBSITE_URL || "https://robinsonj.vercel.app").replace(/\/+$/, ""),
  gscSiteUrl: process.env.GSC_SITE_URL || "https://robinsonj.vercel.app/",
  googleClientEmail: process.env.GOOGLE_CLIENT_EMAIL,
  googlePrivateKey: cleanPrivateKey(process.env.GOOGLE_PRIVATE_KEY),
  googleCredentialsJson: process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
  environment: process.env.NODE_ENV || "production"
};

// server/_lib/telegram.ts
var TelegramClient = class {
  static getApiUrl(method) {
    if (!appConfig.telegramBotToken) {
      throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
    }
    return `https://api.telegram.org/bot${appConfig.telegramBotToken}/${method}`;
  }
  /**
   * Send a text message to a Telegram chat
   */
  static async sendMessage(chatId, text, options = {}) {
    const url = this.getApiUrl("sendMessage");
    const body = {
      chat_id: chatId,
      text,
      parse_mode: options.parse_mode || "HTML",
      disable_web_page_preview: options.disable_web_page_preview ?? true
    };
    if (options.reply_markup) {
      body.reply_markup = options.reply_markup;
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!data.ok) {
      console.error("[TelegramClient] sendMessage error:", data.description);
    }
    return data;
  }
  /**
   * Edit an existing message text and/or inline keyboard
   */
  static async editMessageText(chatId, messageId, text, options = {}) {
    const url = this.getApiUrl("editMessageText");
    const body = {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: options.parse_mode || "HTML",
      disable_web_page_preview: options.disable_web_page_preview ?? true
    };
    if (options.reply_markup) {
      body.reply_markup = options.reply_markup;
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!data.ok) {
      if (!data.description?.includes("message is not modified")) {
        console.error("[TelegramClient] editMessageText error:", data.description);
      }
    }
    return data;
  }
  /**
   * Acknowledge a callback query button press
   */
  static async answerCallbackQuery(callbackQueryId, text, showAlert = false) {
    const url = this.getApiUrl("answerCallbackQuery");
    const body = {
      callback_query_id: callbackQueryId,
      show_alert: showAlert
    };
    if (text) {
      body.text = text;
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    return res.json();
  }
  /**
   * Show typing or action indicator
   */
  static async sendChatAction(chatId, action = "typing") {
    try {
      const url = this.getApiUrl("sendChatAction");
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, action })
      });
    } catch {
    }
  }
  /**
   * Set webhook URL with secret token
   */
  static async setWebhook(webhookUrl, secretToken) {
    const url = this.getApiUrl("setWebhook");
    const body = {
      url: webhookUrl,
      drop_pending_updates: false,
      allowed_updates: ["message", "callback_query"]
    };
    if (secretToken) {
      body.secret_token = secretToken;
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    return res.json();
  }
  /**
   * Get current webhook info
   */
  static async getWebhookInfo() {
    const url = this.getApiUrl("getWebhookInfo");
    const res = await fetch(url);
    return res.json();
  }
  /**
   * Escape HTML special characters for safe inclusion in Telegram messages
   */
  static escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
};

// server/setup/webhook.ts
async function handler(req, res) {
  const action = req.query.action || "info";
  if (!appConfig.telegramBotToken) {
    return res.status(500).json({
      error: "TELEGRAM_BOT_TOKEN is not configured in environment variables.",
      instructions: "Please add TELEGRAM_BOT_TOKEN to your Vercel Project Settings."
    });
  }
  const webhookUrl = `${appConfig.websiteUrl}/api/telegram/webhook`;
  try {
    if (action === "set") {
      const result = await TelegramClient.setWebhook(webhookUrl, appConfig.telegramWebhookSecret || void 0);
      return res.status(200).json({
        action: "setWebhook",
        targetWebhookUrl: webhookUrl,
        hasSecretToken: Boolean(appConfig.telegramWebhookSecret),
        result
      });
    }
    const info = await TelegramClient.getWebhookInfo();
    return res.status(200).json({
      configuredWebsiteUrl: appConfig.websiteUrl,
      expectedWebhookUrl: webhookUrl,
      currentWebhookInfo: info,
      instructions: "To register or update the webhook, call this endpoint with ?action=set"
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
export {
  handler as default
};
