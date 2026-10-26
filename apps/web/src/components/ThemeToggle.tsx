'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { cx } from './ui';

type Theme = 'system' | 'light' | 'dark';

export function ThemeSelector() {
  const t = useTranslations('settings');
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    try {
      const v = localStorage.getItem('hitaba.theme');
      if (v === 'light' || v === 'dark') setTheme(v);
    } catch {
      /* yoksay */
    }
  }, []);

  const apply = (v: Theme) => {
    setTheme(v);
    const root = document.documentElement;
    if (v === 'system') delete root.dataset.theme;
    else root.dataset.theme = v;
    try {
      if (v === 'system') localStorage.removeItem('hitaba.theme');
      else localStorage.setItem('hitaba.theme', v);
    } catch {
      /* yoksay */
    }
  };

  return (
    <div className="grid grid-cols-3 gap-1 rounded-control bg-surface-alt p-1" role="radiogroup" aria-label={t('theme')}>
      {(['system', 'light', 'dark'] as const).map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={theme === v}
          onClick={() => apply(v)}
          className={cx('h-9 rounded-[6px] text-sm font-semibold', theme === v ? 'bg-surface text-ink shadow-card' : 'text-ink-3')}
        >
          {t(`themes.${v}`)}
        </button>
      ))}
    </div>
  );
}
