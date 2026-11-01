import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { env } from '../config/env';

/** Telegram Bot API için ince istemci. Token yoksa tüm çağrılar sessizce atlanır. */
@Injectable()
export class TelegramService {
  private readonly log = new Logger(TelegramService.name);

  get enabled(): boolean {
    return Boolean(env.TELEGRAM_BOT_TOKEN);
  }

  async call<T = unknown>(method: string, body: Record<string, unknown>): Promise<T | null> {
    if (!this.enabled) return null;
    try {
      const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
      if (!json.ok) {
        this.log.warn(`${method} failed: ${json.description}`);
        return null;
      }
      return json.result ?? null;
    } catch (e) {
      this.log.warn(`${method} error: ${(e as Error).message}`);
      return null;
    }
  }

  /** Hata ayrıntısını da döndürür (ör. "message is not modified" sessizce yok sayılsın diye). */
  async callRaw<T = unknown>(method: string, body: Record<string, unknown>): Promise<{ ok: boolean; result?: T; description?: string }> {
    if (!this.enabled) return { ok: false, description: 'disabled' };
    try {
      const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      return (await res.json()) as { ok: boolean; result?: T; description?: string };
    } catch (e) {
      return { ok: false, description: (e as Error).message };
    }
  }

  openAppKeyboard(label: string) {
    return { inline_keyboard: [[{ text: label, web_app: { url: `${env.PUBLIC_WEB_URL}/tg` } }]] };
  }

  sendMessage(chatId: string, text: string, openAppLabel?: string) {
    return this.call('sendMessage', {
      chat_id: chatId,
      text,
      // Bot mesajları iletilemez/kaydedilemez (Telegram yalnızca bot sohbetindeki mesajlar için destekler).
      protect_content: true,
      ...(openAppLabel && {
        reply_markup: { inline_keyboard: [[{ text: openAppLabel, web_app: { url: `${env.PUBLIC_WEB_URL}/tg` } }]] },
      }),
    });
  }

  /** Telegram Stars (XTR) faturası; provider_token boş kalır. */
  createStarsInvoiceLink(p: { title: string; description: string; payload: string; stars: number }) {
    return this.call<string>('createInvoiceLink', {
      title: p.title,
      description: p.description,
      payload: p.payload,
      provider_token: '',
      currency: 'XTR',
      prices: [{ label: p.title, amount: p.stars }],
    });
  }

  answerPreCheckoutQuery(id: string, ok: boolean, errorMessage?: string) {
    return this.call('answerPreCheckoutQuery', {
      pre_checkout_query_id: id,
      ok,
      ...(errorMessage && { error_message: errorMessage }),
    });
  }
}

@Global()
@Module({ providers: [TelegramService], exports: [TelegramService] })
export class TelegramModule {}
