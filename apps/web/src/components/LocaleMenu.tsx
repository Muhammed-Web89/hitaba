'use client';

import { useLocale, useTranslations } from 'next-intl';
import { LOCALE_NAMES, routing, type Locale } from '@/i18n/routing';
import { Icon } from './icons';
import { useSwitchLocale } from './LanguageGate';

export function LocaleMenu({ full }: { full?: boolean }) {
  const locale = useLocale() as Locale;
  const t = useTranslations('lang');
  const switchLocale = useSwitchLocale();
  return (
    <label className={full ? 'block' : 'inline-flex items-center gap-1.5 text-sm text-ink-2'}>
      {!full && <Icon name="globe" size={18} />}
      <span className="sr-only">{t('title')}</span>
      <select
        value={locale}
        onChange={(e) => switchLocale(e.target.value as Locale)}
        className={
          full
            ? 'h-11 w-full rounded-control border border-line bg-surface px-3 text-[15px] text-ink'
            : 'cursor-pointer bg-transparent font-semibold text-ink focus:outline-none'
        }
      >
        {routing.locales.map((l) => (
          <option key={l} value={l}>
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
