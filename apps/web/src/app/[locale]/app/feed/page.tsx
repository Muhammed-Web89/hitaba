'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { RULES, type FeedCard, type FeedFilter, type PublicProfile } from '@hitaba/shared/client';
import { Icon } from '@/components/icons';
import { ProfileCard } from '@/components/ProfileView';
import { StatusGate } from '@/components/StatusGate';
import { Button, IconButton, Modal, Notice, PageLoader } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { readFeedCard, writeFeedCard } from '@/lib/cache';
import { useErrorText } from '@/lib/format';

// Yalnızca açıldıklarında indirilir (ilk açılış hafifler).
const FilterSheet = dynamic(() => import('@/components/FeedFilterSheet').then((m) => m.FilterSheet));
const ReportDialog = dynamic(() => import('@/components/ReportDialog').then((m) => m.ReportDialog));

const FILTER_KEY = 'hitaba.feedFilter';

function loadFilter(): FeedFilter {
  try {
    return JSON.parse(localStorage.getItem(FILTER_KEY) ?? '{}');
  } catch {
    return {};
  }
}

const countActive = (f: FeedFilter) => Object.values(f).filter((v) => v !== undefined && v !== '' && v !== false && !(Array.isArray(v) && !v.length)).length;

export default function FeedPage() {
  return (
    <StatusGate allowPending>
      <Feed />
    </StatusGate>
  );
}

function Feed() {
  const t = useTranslations('feed');
  const errorText = useErrorText();
  const { me, refreshMe } = useAuth();
  const [filter, setFilter] = useState<FeedFilter | null>(null);
  const [card, setCard] = useState<FeedCard | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mutual, setMutual] = useState<string | null>(null);
  const [favorited, setFavorited] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  // İnceleme bekleyen kullanıcı salt okunur gezinir: beğenemez, sıra kaydırmayla ilerler.
  const readOnly = me?.status === 'PENDING_MODERATION';
  const [offset, setOffset] = useState(0);

  useEffect(() => setFilter(loadFilter()), []);

  // Son gösterilen kart cihazda saklanır: açılışta hemen görünür, sonra sunucudan tazelenir.
  // Fotoğraf bağlantıları kısa ömürlü olduğundan saklanmaz.
  const scope = `${me?.id}:${JSON.stringify(filter)}`;
  const load = useCallback(
    async (f: FeedFilter, at = 0, fromCache = false) => {
      const cached = fromCache && !at ? readFeedCard<FeedCard>(scope) : undefined;
      setCard(cached);
      setFavorited(false);
      const res = await api<{ profile: PublicProfile | null; remaining: number }>('/feed/next', { method: 'POST', body: at ? { ...f, offset: at } : f });
      const next = res.profile ? (res as FeedCard) : null;
      setCard(next);
      if (!at) writeFeedCard(scope, next && { ...next, profile: { ...next.profile, photoUrls: [] } });
      if (!cached || cached.profile.userId !== next?.profile.userId) window.scrollTo({ top: 0 });
    },
    [scope],
  );
  const [first, setFirst] = useState(true);

  useEffect(() => {
    if (!filter) return;
    void load(filter, offset, first);
    setFirst(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `first` yalnızca ilk yüklemeyi işaretler
  }, [filter, offset, load]);

  async function act(kind: 'like' | 'pass') {
    if (!card) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ mutual: boolean; matchId: string | null }>(`/feed/${card.profile.userId}/${kind}`, { method: 'POST' });
      if (kind === 'like') {
        void refreshMe();
        if (res.mutual) setMutual(res.matchId);
      }
      await load(filter!);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    const res = await api<{ profile: PublicProfile | null }>('/feed/undo', { method: 'POST' });
    if (res.profile) setCard({ profile: res.profile, remaining: (card?.remaining ?? 0) + 1 });
  }

  async function resetPasses() {
    setBusy(true);
    await api('/feed/reset-passes', { method: 'POST' }).catch(() => {});
    setBusy(false);
    if (filter) await load(filter);
  }

  async function toggleFavorite() {
    if (!card) return;
    await api(`/favorites/${card.profile.userId}`, { method: favorited ? 'DELETE' : 'POST' });
    setFavorited(!favorited);
  }

  const applyFilter = (f: FeedFilter) => {
    try {
      localStorage.setItem(FILTER_KEY, JSON.stringify(f));
    } catch {
      /* yoksay */
    }
    setFilter(f);
    setOffset(0);
    setFiltersOpen(false);
  };

  const isMale = me?.gender === 'MALE';
  const outOfLikes = isMale && me.likesLeftToday === 0;
  const activeFilters = filter ? countActive(filter) : 0;

  return (
    <div className="pb-24">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <div className="flex items-center gap-1">
          {!readOnly && <IconButton icon="undo" label={t('undo')} onClick={undo} />}
          <button type="button" onClick={() => setFiltersOpen(true)} className="glass glow inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold">
            <Icon name="filter" size={16} /> {t('filters')}
            {activeFilters > 0 && <span className="rounded-full bg-brand-500 px-1.5 text-xs text-brand-ink">{activeFilters}</span>}
          </button>
        </div>
      </div>

      {card === undefined && <PageLoader />}

      {card === null && (
        <div className="flex flex-col items-center px-4 py-12 text-center">
          <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-500">
            <Icon name="compass" size={30} />
          </span>
          <h2 className="text-xl font-semibold">{t('emptyTitle')}</h2>
          <p className="mt-1 max-w-xs text-sm text-ink-2">{t('emptyText')}</p>
          <div className="mt-6 flex w-full max-w-xs flex-col gap-2">
            {activeFilters > 0 && (
              <Button icon="x" onClick={() => applyFilter({})}>
                {t('resetFilters')}
              </Button>
            )}
            <Button variant="secondary" icon="filter" onClick={() => setFiltersOpen(true)}>
              {t('changeFilters')}
            </Button>
            {readOnly && offset > 0 && (
              <Button variant="secondary" icon="undo" onClick={() => setOffset(0)}>
                {t('browseFromStart')}
              </Button>
            )}
            {!readOnly && (
              <Button variant="secondary" icon="undo" loading={busy} onClick={resetPasses}>
                {t('resetPasses')}
              </Button>
            )}
          </div>
        </div>
      )}

      {card && (
        <ProfileCard
          profile={card.profile}
          actions={
            !readOnly && (
              <>
              <IconButton icon="star" label={t('favorite')} onClick={toggleFavorite} className={favorited ? 'text-accent' : ''} />
              <IconButton icon="flag" label={t('report')} onClick={() => setReportOpen(true)} />
              </>
            )
          }
        />
      )}

      {error && (
        <div className="mt-3">
          <Notice tone="warning">{error}</Notice>
        </div>
      )}
      {outOfLikes && card && (
        <div className="mt-3">
          <Notice tone="warning" icon="clock">
            {t('limitReached')}
          </Notice>
        </div>
      )}

      {/* Salt okunur gezinme çubuğu: önceki · bilgi · sonraki */}
      {card && readOnly && (
        <div className="pointer-events-none fixed inset-x-0 bottom-20 z-10 flex justify-center px-4" style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="glass pointer-events-auto flex w-full max-w-sm items-center justify-between rounded-full border p-1.5">
            <IconButton icon="back" label={t('previous')} disabled={offset === 0} onClick={() => setOffset(offset - 1)} className="flip-rtl h-12 w-12 bg-surface-alt" />
            <span className="flex items-center gap-1.5 px-2 text-center text-xs font-semibold text-info">
              <Icon name="eye" size={15} /> {t('readOnly')}
            </span>
            <IconButton icon="forward" label={t('next')} disabled={card.remaining <= 1} onClick={() => setOffset(offset + 1)} className="flip-rtl h-12 w-12 bg-surface-alt" />
          </div>
        </div>
      )}

      {/* Karar çubuğu: geç · kalan · ilgileniyorum */}
      {card && !readOnly && (
        <div className="pointer-events-none fixed inset-x-0 bottom-20 z-10 flex justify-center px-4" style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="glass pointer-events-auto flex w-full max-w-sm items-center justify-between rounded-full border p-1.5">
            <button
              type="button"
              aria-label={t('pass')}
              disabled={busy}
              onClick={() => act('pass')}
              className="glow flex h-12 w-12 items-center justify-center rounded-full bg-surface-alt text-ink-2 transition-transform hover:scale-105 disabled:opacity-50"
            >
              <Icon name="x" size={22} />
            </button>
            <span className="px-2 text-center text-xs font-semibold text-ink-3">
              {isMale ? t('likesLeftShort', { n: me.likesLeftToday ?? 0, max: RULES.maleDailyFreeLikes }) : t('remaining', { n: card.remaining })}
            </span>
            <button
              type="button"
              aria-label={t('like')}
              disabled={busy || outOfLikes}
              onClick={() => act('like')}
              className="glow flex h-12 items-center gap-1.5 rounded-full bg-brand-500 px-5 font-semibold text-brand-ink shadow-[0_6px_24px_-6px_var(--brand-500)] transition-transform hover:scale-105 disabled:opacity-50"
            >
              <Icon name="heart" size={20} /> {t('like')}
            </button>
          </div>
        </div>
      )}

      <Modal
        open={!!mutual}
        onClose={() => setMutual(null)}
        title={t('mutualTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setMutual(null)}>
              {t('keepBrowsing')}
            </Button>
            <Link href="/app/likes" className="inline-flex h-11 items-center rounded-control bg-brand-500 px-4 font-semibold text-brand-ink">
              {t('viewMutual')}
            </Link>
          </>
        }
      >
        <div className="flex items-center gap-3">
          <span className="animate-pop flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-500">
            <Icon name="heart" size={24} />
          </span>
          {t(me?.gender === 'FEMALE' ? 'mutualTextSister' : 'mutualTextBrother')}
        </div>
      </Modal>

      {filter && filtersOpen && <FilterSheet onClose={() => setFiltersOpen(false)} value={filter} onApply={applyFilter} />}
      {card && reportOpen && <ReportDialog open={reportOpen} onClose={() => setReportOpen(false)} targetUserId={card.profile.userId} />}
    </div>
  );
}
