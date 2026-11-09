import { Global, Injectable, Logger, Module, type OnModuleInit } from '@nestjs/common';
import { env } from '../config/env';

/** Telegram Bot API için ince istemci. Token yoksa tüm çağrılar sessizce atlanır. */
@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly log = new Logger(TelegramService.name);
  private username = env.TELEGRAM_BOT_USERNAME || 'HitabaBot';
  private ready: Promise<void> = Promise.resolve();

  /** Yazı kutusunun solundaki menü düğmesi uygulamayı açsın (komut listesi yerine). */
  onModuleInit() {
    if (!this.enabled) return;
    this.ready = this.call<{ username?: string }>('getMe', {}).then((me) => {
      if (me?.username) this.username = me.username;
    });
    if (env.PUBLIC_WEB_URL.startsWith('https://')) void this.setMenuButton(undefined, 'Hitaba');
  }

  /**
   * Uygulamayı açan düğmelerin hepsi ana Mini App bağlantısını açar, sohbet listesindeki "Aç" gibi tam ekran.
   * Uygulama adresiyle (web_app) açılınca Telegram uygulamayı yarım boy açıyor ve sayfanın büyütme/tam ekran
   * isteklerini dinlemiyordu.
   */
  private get appLink() {
    return `https://t.me/${this.username}?startapp&mode=fullscreen`;
  }

  private appButton(text: string) {
    return { text, url: this.appLink };
  }

  /**
   * `chatId` verilmezse herkes için varsayılan; verilirse o sohbet için (kullanıcının dilinde). Bot API menü
   * düğmesinde adres yerine t.me bağlantısını da kabul eder; reddedilirse uygulama adresine dönülür.
   */
  async setMenuButton(chatId: string | undefined, label: string) {
    await this.ready;
    const set = (url: string) =>
      this.callRaw('setChatMenuButton', {
        ...(chatId && { chat_id: chatId }),
        menu_button: { type: 'web_app', text: label, web_app: { url } },
      });
    let res = await set(this.appLink);
    // Kullanıcı botu hiç açmamış ya da engellemişse (ör. eski bottan taşınan hesap) yapılacak bir şey yok.
    if (!res.ok && /user not found|chat not found|blocked/i.test(res.description ?? '')) return false;
    if (!res.ok) res = await set(`${env.PUBLIC_WEB_URL}/tg`);
    if (!res.ok) this.log.warn(`setChatMenuButton failed: ${res.description}`);
    return res.ok;
  }

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
    return { inline_keyboard: [[this.appButton(label)]] };
  }

  sendMessage(chatId: string, text: string, openAppLabel?: string) {
    return this.call('sendMessage', {
      chat_id: chatId,
      text,
      // Bot mesajları iletilemez/kaydedilemez (Telegram yalnızca bot sohbetindeki mesajlar için destekler).
      protect_content: true,
      ...(openAppLabel && {
        reply_markup: this.openAppKeyboard(openAppLabel),
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
