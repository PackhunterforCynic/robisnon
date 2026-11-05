/**
 * Telegram Bot API Client
 * Zero external bot dependencies - pure, robust, serverless-optimized HTTP client.
 */

import { config } from './config';

export interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface SendMessageOptions {
  parse_mode?: 'HTML' | 'MarkdownV2';
  reply_markup?: InlineKeyboardMarkup;
  disable_web_page_preview?: boolean;
}

export class TelegramClient {
  private static getApiUrl(method: string): string {
    if (!config.telegramBotToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is not configured.');
    }
    return `https://api.telegram.org/bot${config.telegramBotToken}/${method}`;
  }

  /**
   * Send a text message to a Telegram chat
   */
  static async sendMessage(
    chatId: number | string,
    text: string,
    options: SendMessageOptions = {}
  ): Promise<any> {
    const url = this.getApiUrl('sendMessage');
    const body: Record<string, any> = {
      chat_id: chatId,
      text,
      parse_mode: options.parse_mode || 'HTML',
      disable_web_page_preview: options.disable_web_page_preview ?? true,
    };

    if (options.reply_markup) {
      body.reply_markup = options.reply_markup;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!data.ok) {
      console.error('[TelegramClient] sendMessage error:', data.description);
    }
    return data;
  }

  /**
   * Edit an existing message text and/or inline keyboard
   */
  static async editMessageText(
    chatId: number | string,
    messageId: number,
    text: string,
    options: SendMessageOptions = {}
  ): Promise<any> {
    const url = this.getApiUrl('editMessageText');
    const body: Record<string, any> = {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: options.parse_mode || 'HTML',
      disable_web_page_preview: options.disable_web_page_preview ?? true,
    };

    if (options.reply_markup) {
      body.reply_markup = options.reply_markup;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!data.ok) {
      // In Telegram, editing message with same text returns "message is not modified" - ignore that
      if (!data.description?.includes('message is not modified')) {
        console.error('[TelegramClient] editMessageText error:', data.description);
      }
    }
    return data;
  }

  /**
   * Acknowledge a callback query button press
   */
  static async answerCallbackQuery(
    callbackQueryId: string,
    text?: string,
    showAlert = false
  ): Promise<any> {
    const url = this.getApiUrl('answerCallbackQuery');
    const body: Record<string, any> = {
      callback_query_id: callbackQueryId,
      show_alert: showAlert,
    };
    if (text) {
      body.text = text;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return res.json();
  }

  /**
   * Show typing or action indicator
   */
  static async sendChatAction(
    chatId: number | string,
    action: 'typing' | 'find_location' = 'typing'
  ): Promise<void> {
    try {
      const url = this.getApiUrl('sendChatAction');
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action }),
      });
    } catch {
      // Non-critical
    }
  }

  /**
   * Set webhook URL with secret token
   */
  static async setWebhook(webhookUrl: string, secretToken?: string): Promise<any> {
    const url = this.getApiUrl('setWebhook');
    const body: Record<string, any> = {
      url: webhookUrl,
      drop_pending_updates: false,
      allowed_updates: ['message', 'callback_query'],
    };
    if (secretToken) {
      body.secret_token = secretToken;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return res.json();
  }

  /**
   * Get current webhook info
   */
  static async getWebhookInfo(): Promise<any> {
    const url = this.getApiUrl('getWebhookInfo');
    const res = await fetch(url);
    return res.json();
  }

  /**
   * Escape HTML special characters for safe inclusion in Telegram messages
   */
  static escapeHtml(str?: string): string {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
