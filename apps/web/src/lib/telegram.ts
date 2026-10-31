/** Telegram Mini App WebApp API'sinin kullandığımız kısmı. */
export interface TelegramWebApp {
  initData: string;
  colorScheme?: "light" | "dark";
  ready(): void;
  expand(): void;
  version?: string;
  isExpanded?: boolean;
  isVersionAtLeast?(v: string): boolean;
  disableVerticalSwipes?(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  onEvent?(
    event: "viewportChanged" | "activated" | "deactivated",
    cb: () => void,
  ): void;
  openInvoice?(
    url: string,
    callback: (status: "paid" | "cancelled" | "failed" | "pending") => void,
  ): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export const telegramWebApp = (): TelegramWebApp | undefined =>
  typeof window === "undefined"
    ? undefined
    : window.Telegram?.WebApp?.initData
      ? window.Telegram.WebApp
      : undefined;
