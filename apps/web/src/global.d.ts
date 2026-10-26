import type messages from './messages/en.json';
import type { routing } from './i18n/routing';

// Tüm çeviri anahtarları İngilizce dosyaya göre tip kontrolünden geçer.
declare module 'next-intl' {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
