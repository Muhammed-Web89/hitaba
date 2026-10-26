'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useMemo } from 'react';
import { ApiError } from './api';

export const COUNTRY_CODES = [
  'UZ', 'KZ', 'KG', 'TJ', 'TM', 'AF', 'RU', 'TR', 'AZ', 'AE', 'SA', 'QA', 'KW', 'BH', 'OM', 'EG', 'JO', 'MA', 'DZ', 'TN',
  'PK', 'IN', 'BD', 'ID', 'MY', 'GB', 'DE', 'FR', 'NL', 'BE', 'SE', 'US', 'CA', 'AU',
] as const;

export const LANGUAGE_CODES = ['uz', 'ru', 'tr', 'en', 'ar', 'kk', 'ky', 'tg', 'fa', 'ur', 'de', 'fr'] as const;

export function useDisplayNames() {
  const locale = useLocale();
  return useMemo(() => {
    // Bazı tarayıcılarda (ör. Özbekçe) yerel ad verisi yok; o zaman İngilizceye düşülür.
    const make = (type: 'region' | 'language') => {
      const local = new Intl.DisplayNames([locale], { type, fallback: 'none' });
      const en = new Intl.DisplayNames(['en'], { type });
      return (code: string) => local.of(code) ?? en.of(code) ?? code;
    };
    const region = make('region');
    const language = make('language');
    return {
      country: (code: string) => (code ? region(code) : ''),
      language,
      countries: [...COUNTRY_CODES].map((c) => ({ code: c, name: region(c) })).sort((a, b) => a.name.localeCompare(b.name, locale)),
    };
  }, [locale]);
}

/** API hata kodunu kullanıcı diline çevirir; bilinmeyen kodlar genel mesaja düşer. */
export function useErrorText() {
  const t = useTranslations('errors');
  return useCallback(
    (e: unknown) => {
      const code = e instanceof ApiError ? e.code : 'network';
      return t.has(code as never) ? t(code as never) : t('generic');
    },
    [t],
  );
}

export function useRelativeTime() {
  const locale = useLocale();
  return useMemo(() => {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    const df = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });
    // Ay adı verisi olmayan dillerde (ör. uz → "M10 26") sayısal biçime düşülür.
    const short = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
    const dd = /M\d/.test(short.format(new Date(2026, 9, 26))) ? new Intl.DateTimeFormat('ru', { day: '2-digit', month: '2-digit' }) : short;
    return {
      ago(iso: string) {
        const s = (new Date(iso).getTime() - Date.now()) / 1000;
        const abs = Math.abs(s);
        if (abs < 60) return rtf.format(Math.round(s), 'second');
        if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute');
        if (abs < 86400) return rtf.format(Math.round(s / 3600), 'hour');
        return rtf.format(Math.round(s / 86400), 'day');
      },
      time: (iso: string) => df.format(new Date(iso)),
      day: (iso: string) => dd.format(new Date(iso)),
      hoursLeft: (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 3_600_000)),
    };
  }, [locale]);
}
