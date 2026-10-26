/** Telegram Mini App WebApp API'sinin kullandığımız kısmı. */
export interface TelegramWebApp {
  initData: string;
  colorScheme?: 'light' | 'dark';
  ready(): void;
  expand(): void;
  openInvoice?(url: string, callback: (status: 'paid' | 'cancelled' | 'failed' | 'pending') => void): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export const telegramWebApp = (): TelegramWebApp | undefined =>
  typeof window === 'undefined' ? undefined : window.Telegram?.WebApp?.initData ? window.Telegram.WebApp : undefined;
