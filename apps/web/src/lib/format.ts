'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useMemo } from 'react';
import { ApiError } from './api';

export const COUNTRY_CODES = [
  'UZ', 'KZ', 'KG', 'TJ', 'TM', 'AF', 'RU', 'TR', 'AZ', 'AE', 'SA', 'QA', 'KW', 'BH', 'OM', 'EG', 'JO', 'MA', 'DZ', 'TN',
  'PK', 'IN', 'BD', 'ID', 'MY', 'GB', 'DE', 'FR', 'NL', 'BE', 'SE', 'US', 'CA', 'AU',
] as const;

export const LANGUAGE_CODES = ['uz', 'ru', 'tr', 'en', 'ar', 'kk', 'ky', 'tg', 'fa', 'ur', 'de', 'fr'] as const;

/**
 * Chrome ve Telegram WebView'larının çoğunda Özbekçe ICU verisi yok; Intl o zaman İngilizceye
 * ya da kök biçime ("M10 26", "-5 min") düşer. Özbekçe adlar ve tarih biçimleri bu yüzden burada sabit.
 */
const UZ_REGIONS: Record<string, string> = {
  UZ: 'Oʻzbekiston', KZ: 'Qozogʻiston', KG: 'Qirgʻiziston', TJ: 'Tojikiston', TM: 'Turkmaniston', AF: 'Afgʻoniston',
  RU: 'Rossiya', TR: 'Turkiya', AZ: 'Ozarbayjon', AE: 'Birlashgan Arab Amirliklari', SA: 'Saudiya Arabistoni', QA: 'Qatar',
  KW: 'Quvayt', BH: 'Bahrayn', OM: 'Ummon', EG: 'Misr', JO: 'Iordaniya', MA: 'Marokash', DZ: 'Jazoir', TN: 'Tunis',
  PK: 'Pokiston', IN: 'Hindiston', BD: 'Bangladesh', ID: 'Indoneziya', MY: 'Malayziya', GB: 'Buyuk Britaniya',
  DE: 'Germaniya', FR: 'Fransiya', NL: 'Niderlandiya', BE: 'Belgiya', SE: 'Shvetsiya', US: 'Amerika Qoʻshma Shtatlari',
  CA: 'Kanada', AU: 'Avstraliya',
};
const UZ_LANGUAGES: Record<string, string> = {
  uz: 'oʻzbek', ru: 'rus', tr: 'turk', en: 'ingliz', ar: 'arab', kk: 'qozoq', ky: 'qirgʻiz', tg: 'tojik', fa: 'fors',
  ur: 'urdu', de: 'nemis', fr: 'fransuz',
};
const UZ_MONTHS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];
const UZ_UNITS = { second: 'soniya', minute: 'daqiqa', hour: 'soat', day: 'kun' } as const;

/** Tarayıcı bu dil için gerçekten veri taşıyor mu (yoksa başka dile düşüyor mu)? */
const hasIntlData = (locale: string) => new Intl.DateTimeFormat(locale).resolvedOptions().locale.startsWith(locale);

export function useDisplayNames() {
  const locale = useLocale();
  return useMemo(() => {
    // Bazı tarayıcılarda (ör. Özbekçe) yerel ad verisi yok; o zaman İngilizceye düşülür.
    const make = (type: 'region' | 'language') => {
      const fixed = locale === 'uz' ? (type === 'region' ? UZ_REGIONS : UZ_LANGUAGES) : {};
      const local = new Intl.DisplayNames([locale], { type, fallback: 'none' });
      const en = new Intl.DisplayNames(['en'], { type });
      return (code: string) => fixed[code] ?? local.of(code) ?? en.of(code) ?? code;
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
    const native = hasIntlData(locale);
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    const df = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', ...(locale === 'uz' && { hourCycle: 'h23' as const }) });
    const short = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
    const rel = (n: number, unit: keyof typeof UZ_UNITS) => {
      if (native || locale !== 'uz') return rtf.format(n, unit);
      if (unit === 'day' && n === -1) return 'kecha';
      if (unit === 'day' && n === 1) return 'ertaga';
      if (n === 0) return 'hozir';
      return n < 0 ? `${-n} ${UZ_UNITS[unit]} oldin` : `${n} ${UZ_UNITS[unit]}dan keyin`;
    };
    return {
      ago(iso: string) {
        const s = (new Date(iso).getTime() - Date.now()) / 1000;
        const abs = Math.abs(s);
        if (abs < 60) return rel(Math.round(s), 'second');
        if (abs < 3600) return rel(Math.round(s / 60), 'minute');
        if (abs < 86400) return rel(Math.round(s / 3600), 'hour');
        return rel(Math.round(s / 86400), 'day');
      },
      time: (iso: string) => df.format(new Date(iso)),
      day: (iso: string) => {
        const d = new Date(iso);
        return native || locale !== 'uz' ? short.format(d) : `${d.getDate()}-${UZ_MONTHS[d.getMonth()]}`;
      },
      hoursLeft: (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 3_600_000)),
    };
  }, [locale]);
}
