import { TELEGRAM_SDK_URL } from './telegram-sdk';

/** Telegram Mini App WebApp API'sinin kullandığımız kısmı. */
export interface TelegramWebApp {
  initData: string;
  colorScheme?: 'light' | 'dark';
  ready(): void;
  expand(): void;
  version?: string;
  isExpanded?: boolean;
  isVersionAtLeast?(v: string): boolean;
  disableVerticalSwipes?(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  onEvent?(event: 'viewportChanged' | 'activated' | 'deactivated' | 'invoiceClosed', cb: () => void): void;
  openInvoice?(url: string, callback: (status: 'paid' | 'cancelled' | 'failed' | 'pending') => void): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

let sdk: Promise<TelegramWebApp | undefined> | undefined;

/** Telegram SDK'sını tek seferlik yükler; tüm çağıranlar aynı sözü bekler (çift yükleme/kaçan geri çağrı olmaz). */
export function loadTelegramSdk(): Promise<TelegramWebApp | undefined> {
  if (typeof window === 'undefined') return Promise.resolve(undefined);
  if (window.Telegram?.WebApp) return Promise.resolve(window.Telegram.WebApp);
  sdk ??= new Promise((resolve) => {
    // Telegram'da sayfa başındaki betik SDK'yı çoktan eklemiştir; yoksa burada eklenir.
    let s = document.getElementById('tg-sdk') as HTMLScriptElement | null;
    if (!s) {
      s = document.createElement('script');
      s.src = TELEGRAM_SDK_URL;
      s.id = 'tg-sdk';
      document.head.appendChild(s);
    }
    s.addEventListener('load', () => resolve(window.Telegram?.WebApp));
    s.addEventListener('error', () => resolve(undefined));
  });
  return sdk;
}

/** Mini App ayarları: tam ekran, aşağı kaydırma uygulamayı küçültmez/kapatmaz, renkler temaya uyar. */
export function setupTelegramWebApp(wa: TelegramWebApp) {
  wa.ready();
  wa.expand();
  if (wa.isVersionAtLeast?.('7.7')) wa.disableVerticalSwipes?.();
  if (wa.isVersionAtLeast?.('6.1')) {
    const bg = getComputedStyle(document.body).backgroundColor;
    wa.setHeaderColor?.(bg);
    wa.setBackgroundColor?.(bg);
  }
  wa.onEvent?.('viewportChanged', () => {
    if (!wa.isExpanded) wa.expand();
  });
}

export const telegramWebApp = (): TelegramWebApp | undefined =>
  typeof window === 'undefined' ? undefined : window.Telegram?.WebApp?.initData ? window.Telegram.WebApp : undefined;
