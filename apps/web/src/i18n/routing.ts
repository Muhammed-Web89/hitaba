import { defineRouting } from 'next-intl/routing';

/**
 * Varsayılan dil cihazdan (Accept-Language) algılanır; desteklenmiyorsa İngilizce.
 * İlk ziyarette kullanıcıya yine de dil seçtirilir (LanguageGate).
 */
export const routing = defineRouting({
  locales: ['uz', 'ru', 'tr', 'en', 'ar'],
  defaultLocale: 'en',
  localePrefix: 'as-needed',
  localeDetection: true,
});

export type Locale = (typeof routing.locales)[number];

export const RTL_LOCALES: readonly string[] = ['ar'];

export const LOCALE_NAMES: Record<Locale, string> = {
  uz: 'Oʻzbekcha',
  ru: 'Русский',
  tr: 'Türkçe',
  en: 'English',
  ar: 'العربية',
};
