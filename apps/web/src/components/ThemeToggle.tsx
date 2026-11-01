'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from './icons';
import { cx } from './ui';

type Theme = 'light' | 'dark';
const KEY = 'hitaba.theme';

/** Temayı uygular, kaydeder ve Telegram'ın üst çubuk rengini de günceller (layout'taki tema betiğiyle aynı anahtar). */
function applyTheme(v: Theme) {
  const root = document.documentElement;
  root.dataset.theme = v;
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* yoksay */
  }
  const wa = window.Telegram?.WebApp;
  if (wa?.isVersionAtLeast?.('6.1')) {
    const bg = getComputedStyle(document.body).backgroundColor;
    wa.setHeaderColor?.(bg);
    wa.setBackgroundColor?.(bg);
  }
}

function useTheme(): [Theme, (v: Theme) => void] {
  const [theme, setTheme] = useState<Theme>('dark');
  useEffect(() => setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'), []);
  return [
    theme,
    (v) => {
      setTheme(v);
      applyTheme(v);
    },
  ];
}

/** Üst çubuktaki tek dokunuşluk koyu/açık düğmesi. */
export function ThemeToggleButton({ className }: { className?: string }) {
  const t = useTranslations('settings');
  const [theme, set] = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  const label = `${t('theme')}: ${t(`themes.${next}`)}`;
  return (
    <button
      type="button"
      onClick={() => set(next)}
      aria-label={label}
      title={label}
      className={cx('glow inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-2 hover:text-ink', className)}
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={20} />
    </button>
  );
}

/** Ayarlardaki iki seçenekli tema seçimi. */
export function ThemeSelector() {
  const t = useTranslations('settings');
  const [theme, set] = useTheme();
  return (
    <div className="grid grid-cols-2 gap-1 rounded-control bg-surface-alt p-1" role="radiogroup" aria-label={t('theme')}>
      {(['dark', 'light'] as const).map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={theme === v}
          onClick={() => set(v)}
          className={cx('glow inline-flex h-9 items-center justify-center gap-1.5 rounded-[6px] text-sm font-semibold', theme === v ? 'glass text-ink' : 'text-ink-3')}
        >
          <Icon name={v === 'dark' ? 'moon' : 'sun'} size={16} />
          {t(`themes.${v}`)}
        </button>
      ))}
    </div>
  );
}
