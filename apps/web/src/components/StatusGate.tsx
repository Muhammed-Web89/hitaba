'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth';
import { EmptyState } from './ui';

/**
 * Feed / beğeni / sohbet onaylı profillere açıktır. İnceleme beklerken ekran kilitlenmez:
 * `allowPending` sayfalar salt okunur açılır, diğerleri profillere göz atmaya yönlendirir.
 */
export function StatusGate({ children, allowPending }: { children: ReactNode; allowPending?: boolean }) {
  const t = useTranslations('status');
  const { me } = useAuth();
  if (!me) return null;
  if (me.status === 'PENDING_MODERATION' && !allowPending)
    return (
      <EmptyState
        icon="clock"
        title={t('pendingLockedTitle')}
        text={t('pendingLockedText')}
        action={
          <Link href="/app/feed" className="glow inline-flex h-11 items-center gap-2 rounded-control bg-brand-500 px-4 font-semibold text-brand-ink">
            {t('browseProfiles')}
          </Link>
        }
      />
    );
  if (me.status === 'FROZEN') return <EmptyState icon="pause" title={t('frozenTitle')} text={me.statusReason ?? t('frozenText')} />;
  if (me.status !== 'APPROVED' && me.status !== 'PENDING_MODERATION') return null;
  return <>{children}</>;
}

/** Üst çubukta küçük, dokunulabilir "inceleniyor" rozeti. */
export function ReviewBadge() {
  const t = useTranslations('status');
  const { me } = useAuth();
  if (me?.status !== 'PENDING_MODERATION') return null;
  return (
    <Link
      href="/app/profile"
      title={t('pendingText')}
      className="inline-flex h-7 items-center gap-1.5 rounded-full border border-info/40 bg-info-bg px-2.5 text-xs font-semibold text-info"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-info opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-info" />
      </span>
      {t('pendingBadge')}
    </Link>
  );
}
