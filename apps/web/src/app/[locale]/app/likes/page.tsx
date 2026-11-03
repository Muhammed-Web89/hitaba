'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import type { MatchSummary, PublicProfile } from '@hitaba/shared/client';
import { BusyLikeDialog } from '@/components/BusyLikeDialog';
import { Icon } from '@/components/icons';
import { useMatchStatus } from '@/components/matchStatus';
import { ProfileAvatar } from '@/components/ProfileView';
import { StatusGate } from '@/components/StatusGate';
import { Button, Card, Chip, cx, EmptyState, Modal, Notice, PageLoader } from '@/components/ui';
import { Link, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDisplayNames, useErrorText } from '@/lib/format';

type Tab = 'received' | 'mutual' | 'mine' | 'favorites';
const TABS: Tab[] = ['received', 'mutual', 'mine', 'favorites'];

export default function LikesPage() {
  return (
    <StatusGate>
      <Likes />
    </StatusGate>
  );
}

function Likes() {
  const t = useTranslations('likes');
  const initial = useSearchParams().get('tab') as Tab | null;
  const [tab, setTab] = useState<Tab>(initial && TABS.includes(initial) ? initial : 'mutual');
  const { data: received } = useSWR<PublicProfile[]>('/likes?tab=received');
  return (
    <div>
      <div className="mb-4 grid grid-cols-4 gap-1 rounded-control bg-surface-alt p-1" role="tablist">
        {TABS.map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cx(
              'glow relative min-h-9 rounded-[6px] px-1 py-1.5 text-xs font-semibold leading-tight',
              tab === k ? 'glass text-ink' : 'text-ink-3',
            )}
          >
            {t(`tabs.${k}`)}
            {k === 'received' && !!received?.length && (
              <span className="absolute -end-1 -top-1.5 min-w-5 rounded-full bg-accent px-1 text-[10px] font-bold leading-5 text-brand-ink">{received.length}</span>
            )}
          </button>
        ))}
      </div>
      {tab === 'received' ? <ReceivedList /> : tab === 'mutual' ? <MutualList /> : <ProfileList tab={tab} />}
    </div>
  );
}

/** Beni beğenenler: karşılık verince eşleşme oluşur ve doğrudan eşleşme sayfasına gidilir. */
function ReceivedList() {
  const t = useTranslations('likes');
  const names = useDisplayNames();
  const errorText = useErrorText();
  const router = useRouter();
  const { refreshMe } = useAuth();
  const { data, mutate } = useSWR<PublicProfile[]>('/likes?tab=received');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyAsk, setBusyAsk] = useState<string | null>(null);
  if (!data) return <PageLoader />;
  if (!data.length) return <EmptyState icon="heart" title={t('emptyReceived')} text={t('emptyReceivedText')} />;

  async function likeBack(userId: string, confirmed = false) {
    // Kadın şu an başka biriyle sohbetteyse önce uyar.
    if (!confirmed && data!.find((p) => p.userId === userId)?.busy) return setBusyAsk(userId);
    setBusyAsk(null);
    setBusy(userId);
    setError(null);
    try {
      const res = await api<{ mutual: boolean; matchId: string | null }>(`/feed/${userId}/like`, { method: 'POST' });
      void refreshMe();
      if (res.matchId) return router.push(`/app/matches/${res.matchId}`);
      await mutate();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <p className="mb-3 text-sm text-ink-2">{t('receivedIntro')}</p>
      {error && (
        <div className="mb-3">
          <Notice tone="warning">{error}</Notice>
        </div>
      )}
      <ul className="grid grid-cols-2 gap-3">
        {data.map((p) => (
          <li key={p.userId}>
            <Card className="flex h-full flex-col items-center p-3 text-center">
              <Link href={`/app/profiles/${p.userId}`} className="flex w-full flex-col items-center">
                <ProfileAvatar profile={p} size={80} />
                <p className="mt-1 w-full truncate font-semibold">{p.displayName}</p>
                <p className="w-full truncate text-xs text-ink-3">
                  {p.ageRange} · {p.city || names.country(p.country)}
                </p>
              </Link>
              <div className="mt-3 grid w-full grid-cols-[auto_1fr] gap-1.5">
                <Link
                  href={`/app/profiles/${p.userId}`}
                  aria-label={t('viewProfile')}
                  title={t('viewProfile')}
                  className="glow flex h-9 w-9 items-center justify-center rounded-control border border-line text-ink-2"
                >
                  <Icon name="eye" size={17} />
                </Link>
                <Button size="sm" icon="heart" loading={busy === p.userId} onClick={() => likeBack(p.userId)}>
                  {t('likeBack')}
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
      <BusyLikeDialog open={!!busyAsk} onClose={() => setBusyAsk(null)} onConfirm={() => busyAsk && likeBack(busyAsk, true)} loading={!!busy} />
    </>
  );
}

function MutualList() {
  const t = useTranslations('likes');
  const status = useMatchStatus();
  const names = useDisplayNames();
  const { data } = useSWR<MatchSummary[]>('/matches');
  if (!data) return <PageLoader />;
  if (!data.length) return <EmptyState icon="heart" title={t('emptyMutual')} text={t('emptyMutualText')} />;
  return (
    <ul className="space-y-3">
      {data.map((m) => {
        const s = status(m);
        return (
          <li key={m.id}>
            <Link href={`/app/matches/${m.id}`}>
              <Card className="flex items-center gap-3 p-3 transition-colors hover:bg-surface-alt">
                <ProfileAvatar profile={m.other} size={64} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{m.other.displayName}</p>
                  <p className="truncate text-sm text-ink-3">
                    {m.other.ageRange} · {m.other.city}, {names.country(m.other.country)}
                  </p>
                  <div className="mt-1">
                    <Chip tone={s.tone}>
                      <Icon name={s.icon} size={12} /> {s.text}
                    </Chip>
                  </div>
                </div>
                <Icon name="forward" className="flip-rtl text-ink-3" />
              </Card>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ProfileList({ tab }: { tab: 'mine' | 'favorites' }) {
  const t = useTranslations('likes');
  const tc = useTranslations('common');
  const names = useDisplayNames();
  const errorText = useErrorText();
  const { refreshMe } = useAuth();
  const { data, mutate } = useSWR<PublicProfile[]>(`/likes?tab=${tab}`);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  if (!data) return <PageLoader />;
  if (!data.length) return <EmptyState icon={tab === 'mine' ? 'heart' : 'star'} title={t(tab === 'mine' ? 'emptyMine' : 'emptyFavorites')} />;
  const mine = tab === 'mine';

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      await mutate();
      void refreshMe();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
      setConfirmReset(false);
    }
  }

  return (
    <>
      {mine && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm text-ink-2">{t('mineIntro')}</p>
          <Button size="sm" variant="secondary" icon="undo" onClick={() => setConfirmReset(true)} className="shrink-0">
            {t('resetAll')}
          </Button>
        </div>
      )}
      {error && (
        <div className="mb-3">
          <Notice tone="warning">{error}</Notice>
        </div>
      )}
      <ul className="grid grid-cols-2 gap-3">
        {data.map((p) => (
          <li key={p.userId}>
            <Card className="flex h-full flex-col items-center p-3 text-center">
              <Link href={`/app/profiles/${p.userId}`} className="flex w-full flex-col items-center">
                <ProfileAvatar profile={p} size={80} />
                <p className="mt-1 w-full truncate font-semibold">{p.displayName}</p>
                <p className="w-full truncate text-xs text-ink-3">
                  {p.ageRange} · {names.country(p.country)}
                </p>
              </Link>
              {mine && (
                <Button
                  size="sm"
                  variant="ghost"
                  icon="undo"
                  className="mt-2 w-full"
                  loading={busy === p.userId}
                  onClick={() => run(p.userId, () => api(`/feed/${p.userId}/like`, { method: 'DELETE' }))}
                >
                  {t('undoLike')}
                </Button>
              )}
            </Card>
          </li>
        ))}
      </ul>
      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title={t('resetAllTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmReset(false)}>
              {tc('cancel')}
            </Button>
            <Button variant="danger" loading={busy === 'all'} onClick={() => run('all', () => api('/likes/reset', { method: 'POST' }))}>
              {t('resetAll')}
            </Button>
          </>
        }
      >
        {t('resetAllText', { n: data.length })}
      </Modal>
    </>
  );
}
