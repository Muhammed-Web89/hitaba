'use client';

import { useTranslations } from 'next-intl';
import type { MatchSummary } from '@hitaba/shared/client';
import { useAuth } from '@/lib/auth';
import type { IconName } from './icons';

export function useMatchStatus() {
  const t = useTranslations('likes.status');
  const { me } = useAuth();
  return (m: MatchSummary): { text: string; tone: 'info' | 'warning' | 'brand' | 'neutral'; icon: IconName } => {
    const male = me?.gender === 'MALE';
    if (m.chatId) return m.chatStatus === 'CLOSED' ? { text: t('chatClosed'), tone: 'neutral', icon: 'chat' } : { text: t('inChat'), tone: 'brand', icon: 'chat' };
    if (m.stage === 'MUTUAL') return male ? { text: t('waitingSister'), tone: 'info', icon: 'clock' } : { text: t('yourDecision'), tone: 'warning', icon: 'camera' };
    if (m.stage === 'PHOTO_APPROVED') {
      if (!male) return { text: m.chatRequested ? t('requested') : t('waitingBrother'), tone: 'info', icon: 'clock' };
      if (m.other.busy) return { text: t('sisterBusy'), tone: 'neutral', icon: 'pause' };
      return { text: t('canOpen'), tone: 'warning', icon: 'chat' };
    }
    return { text: t('closed'), tone: 'neutral', icon: 'x' };
  };
}
