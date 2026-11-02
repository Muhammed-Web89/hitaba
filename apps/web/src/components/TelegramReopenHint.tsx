'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from './icons';

const SEEN_KEY = 'hitaba.tgReopenHintSeen';
const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? 'HitabaBot';

/**
 * Telegram'da ilk açılışta bir kez: uygulamayı kapattıktan sonra bot sohbetindeki menü düğmesiyle
 * nasıl geri açılacağını, Telegram'ın kendi giriş çubuğunun küçük bir benzeriyle gösterir.
 */
export function TelegramReopenHint() {
  const t = useTranslations('tgHint');
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      setShow(document.documentElement.dataset.tg === '1' && !localStorage.getItem(SEEN_KEY));
    } catch {
      /* yoksay */
    }
  }, []);

  if (!show) return null;
  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* yoksay */
    }
  };

  return (
    <section className="glass mb-4 overflow-hidden rounded-card border border-brand-500/30 p-4" aria-labelledby="tg-hint-title">
      <div className="flex items-start justify-between gap-2">
        <h2 id="tg-hint-title" className="flex items-center gap-2 font-sans text-[15px] font-bold">
          <Icon name="info" size={18} className="text-brand-500" />
          {t('title')}
        </h2>
        <button type="button" onClick={dismiss} aria-label={t('dismiss')} className="-me-1 -mt-1 rounded-full p-1 text-ink-3 hover:text-ink">
          <Icon name="x" size={18} />
        </button>
      </div>

      {/* Telegram bot sohbetinin alt çubuğu (gösterim amaçlı) */}
      <div className="mt-3 rounded-2xl bg-[#17212b] p-2" aria-hidden="true">
        <p className="mb-2 text-center text-[11px] text-white/50">@{BOT_USERNAME}</p>
        <div className="flex items-center gap-2">
          <span className="relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[#3390ec] px-3.5 text-sm font-semibold text-white">
            <span className="absolute -inset-1 animate-ping rounded-full border-2 border-[#3390ec]/70" />
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="4" y="5" width="16" height="14" rx="2.5" />
              <path d="M4 9h16" />
            </svg>
            Hitaba
          </span>
          <span className="flex h-9 flex-1 items-center rounded-full bg-[#242f3d] px-3 text-sm text-white/40">{t('messagePlaceholder')}</span>
        </div>
        <svg className="ms-6 mt-1 animate-bounce text-brand-500" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M12 20V5m0 0-6 6m6-6 6 6" />
        </svg>
      </div>

      <ol className="mt-3 space-y-1.5 text-sm text-ink-2">
        <li className="flex gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[11px] font-bold text-brand-ink">1</span>
          {t('step1', { bot: `@${BOT_USERNAME}` })}
        </li>
        <li className="flex gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[11px] font-bold text-brand-ink">2</span>
          {t('step2')}
        </li>
        <li className="flex gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-brand-ink">★</span>
          {t('tip')}
        </li>
      </ol>
      <button type="button" onClick={dismiss} className="glow mt-3 h-10 w-full rounded-control bg-brand-500 text-sm font-semibold text-brand-ink">
        {t('gotIt')}
      </button>
    </section>
  );
}
