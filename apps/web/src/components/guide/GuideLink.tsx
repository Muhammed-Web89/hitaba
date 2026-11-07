'use client';

import { Link } from '@/i18n/navigation';
import { Icon } from '../icons';
import { cx } from '../ui';

/** Uygulama ekranlarından rehbere giden göze çarpan bağlantı (ödeme, profil, ayarlar). */
export function GuideLink({ href, emoji, title, hint, compact }: { href: string; emoji: string; title: string; hint?: string; compact?: boolean }) {
  if (compact) {
    return (
      <Link href={href} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-500">
        <span aria-hidden="true">{emoji}</span>
        {title}
        <Icon name="forward" size={14} className="flip-rtl" />
      </Link>
    );
  }
  return (
    <Link
      href={href}
      className={cx('glass glow flex items-center gap-3 rounded-card border border-accent/40 px-4 py-3 transition-colors hover:bg-surface-alt')}
    >
      <span className="guide-float flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xl" aria-hidden="true">
        {emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        {hint && <span className="block text-xs text-ink-3">{hint}</span>}
      </span>
      <Icon name="forward" size={18} className="flip-rtl text-ink-3" />
    </Link>
  );
}
