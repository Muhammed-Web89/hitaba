'use client';

import { useTranslations } from 'next-intl';
import type { MatchSummary } from '@hitaba/shared';
import { useAuth } from '@/lib/auth';
import type { IconName } from './icons';

export function useMatchStatus() {
  const t = useTranslations('likes.status');
  const time = useHoursLeft();
  const { me } = useAuth();
  return (m: MatchSummary): { text: string; tone: 'info' | 'warning' | 'brand' | 'neutral'; icon: IconName } => {
    const male = me?.gender === 'MALE';
    if (m.chatId) return m.chatStatus === 'CLOSED' ? { text: t('chatClosed'), tone: 'neutral', icon: 'chat' } : { text: t('inChat'), tone: 'brand', icon: 'chat' };
    if (m.stage === 'MUTUAL') return male ? { text: t('waitingSister'), tone: 'info', icon: 'clock' } : { text: t('yourDecision'), tone: 'warning', icon: 'camera' };
    if (m.stage === 'PHOTO_APPROVED') {
      if (!male) return { text: m.chatRequested ? t('requested') : t('waitingBrother'), tone: 'info', icon: 'clock' };
      if (m.other.busy) return { text: t('sisterBusy'), tone: 'neutral', icon: 'pause' };
      return {
        text: m.photoAccessUntil && time(m.photoAccessUntil) > 0 ? t('canOpenWindow', { h: time(m.photoAccessUntil) }) : t('canOpen'),
        tone: 'warning',
        icon: 'chat',
      };
    }
    return { text: t('closed'), tone: 'neutral', icon: 'x' };
  };
}

function useHoursLeft() {
  return (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 3_600_000));
}
