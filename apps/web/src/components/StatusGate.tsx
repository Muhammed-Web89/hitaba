'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth';
import { EmptyState } from './ui';

/** Feed / beğeni / sohbet yalnızca onaylanmış profillere açıktır. */
export function StatusGate({ children }: { children: ReactNode }) {
  const t = useTranslations('status');
  const { me } = useAuth();
  if (!me) return null;
  if (me.status === 'PENDING_MODERATION') return <EmptyState icon="clock" title={t('pendingTitle')} text={t('pendingText')} />;
  if (me.status === 'FROZEN') return <EmptyState icon="pause" title={t('frozenTitle')} text={me.statusReason ?? t('frozenText')} />;
  if (me.status !== 'APPROVED') return null;
  return <>{children}</>;
}
