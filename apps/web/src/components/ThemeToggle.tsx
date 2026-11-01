'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from './icons';
import { cx } from './ui';

type Theme = 'light' | 'dark';

/** Varsayılan koyu tema; açık tema isteğe bağlı (layout'taki tema betiğiyle aynı anahtar). */
export function ThemeSelector() {
  const t = useTranslations('settings');
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'), []);

  const apply = (v: Theme) => {
    setTheme(v);
    document.documentElement.dataset.theme = v;
    try {
      if (v === 'dark') localStorage.removeItem('hitaba.theme');
      else localStorage.setItem('hitaba.theme', v);
    } catch {
      /* yoksay */
    }
  };

  return (
    <div className="grid grid-cols-2 gap-1 rounded-control bg-surface-alt p-1" role="radiogroup" aria-label={t('theme')}>
      {(['dark', 'light'] as const).map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={theme === v}
          onClick={() => apply(v)}
          className={cx('glow inline-flex h-9 items-center justify-center gap-1.5 rounded-[6px] text-sm font-semibold', theme === v ? 'glass text-ink' : 'text-ink-3')}
        >
          <Icon name={v === 'dark' ? 'moon' : 'sun'} size={16} />
          {t(`themes.${v}`)}
        </button>
      ))}
    </div>
  );
}
