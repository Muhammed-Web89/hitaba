import { Global, Injectable, Logger, Module, type OnModuleInit } from '@nestjs/common';
import { env } from '../config/env';

/** Telegram Bot API için ince istemci. Token yoksa tüm çağrılar sessizce atlanır. */
@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly log = new Logger(TelegramService.name);
  private username = env.TELEGRAM_BOT_USERNAME || 'HitabaBot';
  private webAppUrl = `${env.PUBLIC_WEB_URL}/tg`;
  private ready: Promise<void> = Promise.resolve();

  /** Yazı kutusunun solundaki menü düğmesi uygulamayı açsın (komut listesi yerine). */
  onModuleInit() {
    if (!this.enabled) return;
    void this.call<{ username?: string }>('getMe', {}).then((me) => me?.username && (this.username = me.username));
    if (!env.PUBLIC_WEB_URL.startsWith('https://')) return;
    this.ready = this.resolveWebAppUrl();
    void this.ready.then(() => this.setMenuButton(undefined, 'Hitaba'));
  }

  /**
   * Menü düğmesinin adresi başka alan adına yönlenirse (hitaba.me → www.hitaba.me) Telegram, yönlenilen
   * sayfadan gelen büyütme/tam ekran isteklerini dinlemez ve uygulama yarım boy kalır. Bu yüzden düğmeye
   * yönlendirmenin son adresi yazılır.
   */
  /** Menü düğmesi, ayardaki adresten farklı (yönlendirmenin sonundaki) bir adrese mi ayarlandı? */
  async menuUrlChanged() {
    await this.ready;
    return this.enabled && this.webAppUrl !== `${env.PUBLIC_WEB_URL}/tg`;
  }

  private async resolveWebAppUrl() {
    try {
      let url = this.webAppUrl;
      for (let i = 0; i < 3; i++) {
        const res = await fetch(url, { method: 'HEAD', redirect: 'manual' });
        const next = res.status >= 300 && res.status < 400 && res.headers.get('location');
        if (!next) break;
        url = new URL(next, url).toString();
      }
      if (url.startsWith('https://')) this.webAppUrl = url;
    } catch (e) {
      this.log.warn(`web app URL check failed: ${(e as Error).message}`);
    }
  }

  /**
   * Mesajlardaki "Aç" düğmesi. web_app düğmesi uygulamayı yarım boy açar ve bazı istemciler büyütme/tam ekran
   * isteğini dinlemez; ana Mini App bağlantısı ise sohbet listesindeki "Aç" gibi doğrudan tam ekran açar.
   */
  private appButton(text: string) {
    return { text, url: `https://t.me/${this.username}?startapp&mode=fullscreen` };
  }

  /** `chatId` verilmezse herkes için varsayılan; verilirse o sohbet için (kullanıcının dilinde). */
  async setMenuButton(chatId: string | undefined, label: string) {
    await this.ready;
    return this.call('setChatMenuButton', {
      ...(chatId && { chat_id: chatId }),
      menu_button: { type: 'web_app', text: label, web_app: { url: this.webAppUrl } },
    });
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
