import { Body, Controller, Global, HttpCode, Injectable, Logger, Module, Post, type OnModuleInit } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/guards';
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
    this.ready = Promise.all([
      this.call<{ username?: string }>('getMe', {}).then((me) => {
        if (me?.username) this.username = me.username;
      }),
      this.resolveWebAppUrl(),
    ]).then(() => {});
    if (env.PUBLIC_WEB_URL.startsWith('https://')) void this.setMenuButton(undefined, 'Hitaba');
  }

  /**
   * Mesajlardaki düğmeler ana Mini App bağlantısını açar, sohbet listesindeki "Aç" gibi tam ekran.
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
   * Menü düğmesi uygulama adresini açar. (t.me bağlantısı Bot API'de kabul ediliyor ama iPhone'da menü
   * düğmesinden açılınca uygulama hiç yüklenmiyor.) Adres başka alan adına yönlenirse (hitaba.me →
   * www.hitaba.me) yönlendirmenin son adresi yazılır; Telegram yönlenen sayfanın isteklerini dinlemeyebiliyor.
   */
  private async resolveWebAppUrl() {
    if (!env.PUBLIC_WEB_URL.startsWith('https://')) return;
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

  /** `chatId` verilmezse herkes için varsayılan; verilirse o sohbet için (kullanıcının dilinde). */
  async setMenuButton(chatId: string | undefined, label: string) {
    await this.ready;
    const res = await this.callRaw('setChatMenuButton', {
      ...(chatId && { chat_id: chatId }),
      menu_button: { type: 'web_app', text: label, web_app: { url: this.webAppUrl } },
    });
    // Kullanıcı botu hiç açmamış ya da engellemişse (ör. eski bottan taşınan hesap) yapılacak bir şey yok.
    if (!res.ok && !/user not found|chat not found|blocked/i.test(res.description ?? '')) {
      this.log.warn(`setChatMenuButton failed: ${res.description}`);
    }
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

  /** sendMessage, hata ayrıntısıyla (kullanıcının botu engelleyip engellemediğini anlamak için). */
  sendMessageRaw(chatId: string, text: string, openAppLabel?: string) {
    return this.callRaw('sendMessage', {
      chat_id: chatId,
      text,
      protect_content: true,
      ...(openAppLabel && { reply_markup: this.openAppKeyboard(openAppLabel) }),
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

/**
 * GEÇİCİ teşhis: Mini App açıldıktan birkaç saniye sonra Telegram'ın bildirdiği görünüm durumunu
 * (platform, sürüm, tam boy/tam ekran, yükseklik) sunucu günlüğüne yazar. Yarım boy açılış sorunu
 * çözülünce kaldırılacak.
 */
@Controller('telegram')
export class TelegramDiagController {
  private readonly log = new Logger('TelegramDiag');

  @Public()
  @Post('diag')
  @HttpCode(204)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  diag(@Body() body: unknown) {
    this.log.log(JSON.stringify(body).slice(0, 1500));
  }
}

@Global()
@Module({ controllers: [TelegramDiagController], providers: [TelegramService], exports: [TelegramService] })
export class TelegramModule {}
