'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { LOCALE_NAMES, routing, type Locale } from '@/i18n/routing';
import { Icon } from './icons';
import { Button, cx } from './ui';

const CHOSEN_KEY = 'hitaba.lang';

function readChosen(): string | null {
  try {
    return localStorage.getItem(CHOSEN_KEY);
  } catch {
    return null;
  }
}

/** Dil değiştirir ve tercihi hatırlar (next-intl NEXT_LOCALE çerezini de yazar). */
export function useSwitchLocale() {
  const router = useRouter();
  const pathname = usePathname();
  return (locale: Locale) => {
    try {
      localStorage.setItem(CHOSEN_KEY, locale);
    } catch {
      /* yoksay */
    }
    const search = typeof window !== 'undefined' ? window.location.search : '';
    router.replace(`${pathname}${search}`, { locale });
  };
}

/**
 * İlk ziyarette dil seçimi. Sunucu dili cihazdan algılar (desteklenmiyorsa İngilizce);
 * burada algılanan dil önceden seçili gelir ama kullanıcı yine de onaylar.
 */
export function LanguageGate() {
  const locale = useLocale() as Locale;
  const t = useTranslations('lang');
  const switchLocale = useSwitchLocale();
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<Locale>(locale);

  useEffect(() => {
    if (!readChosen()) setOpen(true);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-base/95 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="lang-title">
      <div className="w-full max-w-sm rounded-card border border-line bg-surface p-6 shadow-card">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-500">
            <Icon name="globe" size={22} />
          </span>
          <div>
            <h2 id="lang-title" className="text-xl font-semibold">
              {t('title')}
            </h2>
            <p className="text-sm text-ink-3">{t('subtitle')}</p>
          </div>
        </div>
        <ul className="space-y-2">
          {routing.locales.map((l) => (
            <li key={l}>
              <button
                type="button"
                lang={l}
                dir={l === 'ar' ? 'rtl' : 'ltr'}
                onClick={() => setChoice(l)}
                aria-pressed={choice === l}
                className={cx(
                  'flex h-12 w-full items-center justify-between rounded-control border px-4 text-start text-[15px] font-semibold transition-colors',
                  choice === l ? 'border-brand-500 bg-brand-50 text-ink' : 'border-line hover:bg-surface-alt',
                )}
              >
                {LOCALE_NAMES[l]}
                {choice === l && <Icon name="check" size={18} className="text-brand-500" />}
              </button>
            </li>
          ))}
        </ul>
        <Button
          className="mt-5 w-full"
          size="lg"
          onClick={() => {
            setOpen(false);
            if (choice !== locale) switchLocale(choice);
            else
              try {
                localStorage.setItem(CHOSEN_KEY, choice);
              } catch {
                /* yoksay */
              }
          }}
        >
          {t('continue')}
        </Button>
      </div>
    </div>
  );
}
