'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { RULES } from '@hitaba/shared/client';
import { Link } from '@/i18n/navigation';
import { Icon, type IconName } from './icons';
import { cx } from './ui';

/** Sohbet kuralları: alttan açılan pencere. Sıra ve ikonlar sabit, metinler chat.rulesSheet.* çevirilerinde. */
const ITEMS: Array<{ key: string; icon: IconName; tone: string }> = [
  { key: 'wali', icon: 'users', tone: 'text-accent' },
  { key: 'moderators', icon: 'shield', tone: 'text-brand-500' },
  { key: 'ai', icon: 'sparkle', tone: 'text-info' },
  { key: 'noOutside', icon: 'lock', tone: 'text-danger' },
  { key: 'noBypass', icon: 'ban', tone: 'text-danger' },
  { key: 'limits', icon: 'clock', tone: 'text-warning' },
  { key: 'ban', icon: 'ban', tone: 'text-danger' },
  { key: 'adab', icon: 'chat', tone: 'text-brand-500' },
  { key: 'noToxic', icon: 'flag', tone: 'text-danger' },
  { key: 'silence', icon: 'clock', tone: 'text-warning' },
  { key: 'refund', icon: 'wallet', tone: 'text-accent' },
  { key: 'actions', icon: 'edit', tone: 'text-ink-2' },
];

export function ChatRulesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations('chat.rulesSheet');

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] flex flex-col justify-end bg-black/55 pt-[var(--app-safe-top)] backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-rules-title"
        onClick={(e) => e.stopPropagation()}
        className="glass mx-auto flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-[24px] border border-b-0"
        style={{ paddingBottom: 'max(16px, var(--app-safe-bottom))' }}
      >
        <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-line" aria-hidden="true" />
        <h2 id="chat-rules-title" className="flex items-center gap-2.5 px-5 pt-4 font-sans text-xl font-bold">
          <Icon name="shield" size={24} className="text-brand-500" /> {t('title')}
        </h2>
        <ul className="mt-3 flex-1 space-y-4 overflow-y-auto px-5 py-2">
          {ITEMS.map((it) => (
            <li key={it.key} className="flex gap-3.5 text-[15px] leading-relaxed text-ink-2">
              <Icon name={it.icon} size={20} className={cx('mt-0.5 shrink-0', it.tone)} />
              <span>
                {t(`items.${it.key}` as 'items.silence', {
                  editMin: RULES.messageEditWindowMinutes,
                  remind1: RULES.silenceFirstReminderHours,
                  close: RULES.silenceAutoCloseHours,
                  quota: RULES.chatMessageQuota,
                  digits: RULES.chatNumberMaxDigits,
                  times: RULES.chatNumberMaxTimes,
                })}
              </span>
            </li>
          ))}
        </ul>
        <div className="mx-5 mt-2 border-t border-line pt-3 text-sm text-ink-3">{t('footer')}</div>
        <Link href="/rules#chat" className="mx-5 mt-3 inline-flex items-center gap-2 text-sm font-semibold text-brand-500">
          <Icon name="book" size={18} /> {t('platformRules')}
        </Link>
        <button type="button" onClick={onClose} className="glow mx-5 mt-4 h-12 rounded-2xl bg-brand-500 font-semibold text-brand-ink">
          {t('gotIt')}
        </button>
      </div>
    </div>,
    document.body,
  );
}
