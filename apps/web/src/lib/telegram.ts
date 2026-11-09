import { TELEGRAM_SDK_URL } from './telegram-sdk';

/** Telegram Mini App WebApp API'sinin kullandığımız kısmı. */
export interface TelegramWebApp {
  initData: string;
  initDataUnsafe?: { user?: { id: number } };
  colorScheme?: 'light' | 'dark';
  ready(): void;
  expand(): void;
  version?: string;
  platform?: string;
  isExpanded?: boolean;
  isFullscreen?: boolean;
  requestFullscreen?(): void;
  lockOrientation?(): void;
  isVersionAtLeast?(v: string): boolean;
  disableVerticalSwipes?(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  onEvent?(event: 'viewportChanged' | 'activated' | 'deactivated' | 'invoiceClosed' | 'fullscreenChanged' | 'fullscreenFailed', cb: () => void): void;
  openInvoice?(url: string, callback: (status: 'paid' | 'cancelled' | 'failed' | 'pending') => void): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp; WebView?: { postEvent?(event: string, callback: unknown, data?: unknown): void } };
  }
}

/**
 * Mini App'i açan Telegram kullanıcısının kimliği. Telegram bunu adresin `#tgWebAppData`
 * kısmında verir; SDK yüklenmeden okunabildiği için açılışta hızlı yönlendirmeye yarar.
 * Yalnızca "bu cihazda son giren hesap mı" kıyası içindir, kimlik doğrulaması sunucudadır.
 */
export function telegramUserId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const fromSdk = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
  if (fromSdk) return String(fromSdk);
  try {
    const data = new URLSearchParams(window.location.hash.slice(1)).get('tgWebAppData');
    const user = data && new URLSearchParams(data).get('user');
    return user ? String(JSON.parse(user).id) : undefined;
  } catch {
    return undefined;
  }
}

const LAST_TG_USER = 'hitaba.tgUser';
export function lastTelegramUser(): string | null {
  try {
    return localStorage.getItem(LAST_TG_USER);
  } catch {
    return null;
  }
}
export function rememberTelegramUser(id: string | undefined) {
  try {
    if (id) localStorage.setItem(LAST_TG_USER, id);
  } catch {
    /* yoksay */
  }
}

/** Sayfayı başa kaydırır. Telegram'da kaydırılan şey sayfa değil gövdedir (bkz. globals.css). */
export function scrollToTop() {
  window.scrollTo({ top: 0 });
  document.body.scrollTo?.({ top: 0 });
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

/** Mini App ayarları: telefonda tam ekran, aşağı kaydırma uygulamayı küçültmez/kapatmaz, renkler temaya uyar. */
export function setupTelegramWebApp(wa: TelegramWebApp) {
  wa.ready();
  wa.expand();
  // Aşağı kaydırma uygulamayı küçültmesin/kapatmasın. Açılış parametreleri kaybolursa (yönlendirme, dil
  // değişimi) SDK kendini 6.0 sanar ve disableVerticalSwipes'ı sessizce atlar; o durumda olay doğrudan
  // gönderilir (Telegram tanımadığı olayı yok sayar, zararı yok).
  if (wa.isVersionAtLeast?.('7.7')) wa.disableVerticalSwipes?.();
  else window.Telegram?.WebView?.postEvent?.('web_app_setup_swipe_behavior', false, { allow_vertical_swipe: false });
  if (wa.isVersionAtLeast?.('6.1')) {
    const bg = getComputedStyle(document.body).backgroundColor;
    wa.setHeaderColor?.(bg);
    wa.setBackgroundColor?.(bg);
  }
  // Telefonda tam ekran: Telegram başlığı kalkar, yalnızca köşedeki kapat/menü düğmeleri kalır; dikey kilit.
  // Yalnızca iOS/Android: masaüstü Telegram tam ekranda ayrı pencere açar (masaüstü de TelegramWebviewProxy
  // kullandığı için ona bakılmaz). Açılış parametreleri kaybolursa (yönlendirme, dil değişimi) platform,
  // sayfanın ilk betiğinin sakladığı değerden okunur ve olay doğrudan gönderilir; SDK kendini 6.0 sanıp
  // isteği atlamasın diye. 8.0 öncesi Telegram bu olayları tanımaz ve yok sayar.
  const root = document.documentElement;
  const markFullscreen = () => (wa.isFullscreen ? (root.dataset.tgFs = '1') : delete root.dataset.tgFs);
  wa.onEvent?.('fullscreenChanged', markFullscreen);
  markFullscreen();
  let platform = wa.platform;
  try {
    if (!platform || platform === 'unknown') platform = sessionStorage.getItem('hitaba.tgp') ?? undefined;
  } catch {
    /* yoksay */
  }
  const mobile = ['ios', 'android', 'android_x'].includes(platform ?? '');
  let locked = false;
  const fullscreen = () => {
    if (!mobile || wa.isFullscreen) return;
    if (wa.isVersionAtLeast?.('8.0')) {
      wa.requestFullscreen?.();
      if (!locked) wa.lockOrientation?.();
    } else {
      window.Telegram?.WebView?.postEvent?.('web_app_request_fullscreen', false);
      if (!locked) window.Telegram?.WebView?.postEvent?.('web_app_toggle_orientation_lock', false, { locked: true });
    }
    locked = true;
  };

  // Sohbetin içindeki menü ve mesaj düğmeleri uygulamayı yarım boy açar (sohbet listesindeki "Aç" ise tam
  // boy). İstemci, açılış animasyonu sürerken gelen büyütme ve tam ekran isteklerini yok sayabilir; bu yüzden
  // tam ekran ilk anda değil biraz sonra istenir ve ikisi de ilk saniyelerde birkaç kez tekrarlanır
  // (tam boy/tam ekrandayken istek etkisizdir). Yarım boyda kalırsa her görünüm değişiminde yeniden denenir.
  const grow = () => {
    wa.expand();
    fullscreen();
  };
  for (const ms of [150, 400, 800, 1500, 3000]) setTimeout(grow, ms);
  wa.onEvent?.('viewportChanged', (e?: { isStateStable?: boolean }) => {
    if (e?.isStateStable && (!wa.isExpanded || (mobile && !wa.isFullscreen))) grow();
  });
  wa.onEvent?.('activated', grow);
}

export const telegramWebApp = (): TelegramWebApp | undefined =>
  typeof window === 'undefined' ? undefined : window.Telegram?.WebApp?.initData ? window.Telegram.WebApp : undefined;
