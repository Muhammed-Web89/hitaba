'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { RULES, type FeedCard, type FeedFilter, type PublicProfile } from '@hitaba/shared';
import { Icon } from '@/components/icons';
import { PhotoFrame, ProfileDetails, ProfileHeadline } from '@/components/ProfileView';
import { ReportDialog } from '@/components/ReportDialog';
import { StatusGate } from '@/components/StatusGate';
import { Button, Card, EmptyState, Field, IconButton, Input, Modal, Notice, PageLoader, Select, Toggle } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDisplayNames, useErrorText } from '@/lib/format';

const FILTER_KEY = 'hitaba.feedFilter';

function loadFilter(): FeedFilter {
  try {
    return JSON.parse(localStorage.getItem(FILTER_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export default function FeedPage() {
  return (
    <StatusGate>
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

  useEffect(() => setFilter(loadFilter()), []);

  const load = useCallback(async (f: FeedFilter) => {
    setCard(undefined);
    setFavorited(false);
    const res = await api<{ profile: PublicProfile | null; remaining: number }>('/feed/next', { method: 'POST', body: f });
    setCard(res.profile ? (res as FeedCard) : null);
  }, []);

  useEffect(() => {
    if (filter) void load(filter);
  }, [filter, load]);

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
    setFiltersOpen(false);
  };

  const outOfLikes = me?.gender === 'MALE' && me.likesLeftToday === 0;
  const activeFilters = filter ? Object.values(filter).filter((v) => v !== undefined && v !== '' && v !== false).length : 0;

  return (
    <div className="pb-20">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm text-ink-2">
          {me?.gender === 'MALE' ? t('likesLeft', { n: me.likesLeftToday ?? 0, max: RULES.maleDailyFreeLikes }) : t('unlimited')}
        </div>
        <div className="flex items-center">
          <IconButton icon="undo" label={t('undo')} onClick={undo} />
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-3 text-sm font-semibold hover:bg-surface-alt"
          >
            <Icon name="filter" size={16} /> {t('filters')}
            {activeFilters > 0 && <span className="rounded-full bg-brand-500 px-1.5 text-xs text-brand-ink">{activeFilters}</span>}
          </button>
        </div>
      </div>

      {card && (
        <div className="mb-3 flex items-center gap-2 text-xs text-ink-3">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-alt" aria-hidden="true">
            <div className="h-full bg-accent" style={{ width: `${Math.min(100, Math.max(6, 100 / card.remaining))}%` }} />
          </div>
          {t('remaining', { n: card.remaining })}
        </div>
      )}

      {card === undefined && <PageLoader />}
      {card === null && (
        <EmptyState
          icon="compass"
          title={t('emptyTitle')}
          text={t('emptyText')}
          action={
            activeFilters > 0 && (
              <Button variant="secondary" onClick={() => applyFilter({})}>
                {t('resetFilters')}
              </Button>
            )
          }
        />
      )}

      {card && (
        <Card className="overflow-hidden">
          <PhotoFrame profile={card.profile} className="aspect-[4/5] w-full" />
          <div className="space-y-5 p-5">
            <div className="flex items-start justify-between gap-3">
              <ProfileHeadline profile={card.profile} />
              <div className="flex">
                <IconButton icon="star" label={t('favorite')} onClick={toggleFavorite} className={favorited ? 'text-accent' : ''} />
                <IconButton icon="flag" label={t('report')} onClick={() => setReportOpen(true)} />
              </div>
            </div>
            <ProfileDetails profile={card.profile} />
          </div>
        </Card>
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

      {card && (
        <div className="pointer-events-none fixed inset-x-0 bottom-20 z-10 flex justify-center gap-6" style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
          <button
            type="button"
            aria-label={t('pass')}
            disabled={busy}
            onClick={() => act('pass')}
            className="pointer-events-auto flex h-16 w-16 items-center justify-center rounded-full border border-line bg-surface text-ink-2 shadow-card transition-transform hover:scale-105 disabled:opacity-50"
          >
            <Icon name="x" size={28} />
          </button>
          <button
            type="button"
            aria-label={t('like')}
            disabled={busy || outOfLikes}
            onClick={() => act('like')}
            className="pointer-events-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-500 text-brand-ink shadow-card transition-transform hover:scale-105 disabled:opacity-50"
          >
            <Icon name="heart" size={28} />
          </button>
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

      {filter && <FilterSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} value={filter} onApply={applyFilter} />}
      {card && <ReportDialog open={reportOpen} onClose={() => setReportOpen(false)} targetUserId={card.profile.userId} />}
    </div>
  );
}

function FilterSheet({ open, onClose, value, onApply }: { open: boolean; onClose: () => void; value: FeedFilter; onApply: (f: FeedFilter) => void }) {
  const t = useTranslations('feed.filter');
  const tf = useTranslations('feed');
  const names = useDisplayNames();
  const { me } = useAuth();
  const [f, setF] = useState<FeedFilter>(value);
  useEffect(() => setF(value), [value, open]);
  const num = (v: string) => (v === '' ? undefined : Number(v));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={tf('filters')}
      footer={
        <>
          <Button variant="ghost" onClick={() => onApply({})}>
            {tf('resetFilters')}
          </Button>
          <Button onClick={() => onApply(f)}>{t('apply')}</Button>
        </>
      }
    >
      <div className="max-h-[60dvh] space-y-4 overflow-y-auto pe-1">
        <Field label={t('country')}>
          <Select value={f.countries?.[0] ?? ''} onChange={(e) => setF({ ...f, countries: e.target.value ? [e.target.value] : undefined })}>
            <option value="">{t('any')}</option>
            {names.countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('city')}>
          <Input value={f.city ?? ''} onChange={(e) => setF({ ...f, city: e.target.value || undefined })} />
        </Field>
        <Field label={t('nationality')}>
          <Input value={f.nationality ?? ''} onChange={(e) => setF({ ...f, nationality: e.target.value || undefined })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('ageMin')}>
            <Input type="number" min={RULES.minAge} max={RULES.maxAge} value={f.ageMin ?? ''} onChange={(e) => setF({ ...f, ageMin: num(e.target.value) })} />
          </Field>
          <Field label={t('ageMax')}>
            <Input type="number" min={RULES.minAge} max={RULES.maxAge} value={f.ageMax ?? ''} onChange={(e) => setF({ ...f, ageMax: num(e.target.value) })} />
          </Field>
          <Field label={t('heightMin')}>
            <Input type="number" value={f.heightMin ?? ''} onChange={(e) => setF({ ...f, heightMin: num(e.target.value) })} />
          </Field>
          <Field label={t('heightMax')}>
            <Input type="number" value={f.heightMax ?? ''} onChange={(e) => setF({ ...f, heightMax: num(e.target.value) })} />
          </Field>
        </div>
        <Toggle checked={!!f.withPhoto} onChange={(v) => setF({ ...f, withPhoto: v || undefined })} label={t('withPhoto')} />
        <Toggle checked={!!f.neverMarried} onChange={(v) => setF({ ...f, neverMarried: v || undefined })} label={t('neverMarried')} />
        <Toggle checked={!!f.noChildren} onChange={(v) => setF({ ...f, noChildren: v || undefined })} label={t('noChildren')} />
        <Toggle checked={!!f.willingToRelocate} onChange={(v) => setF({ ...f, willingToRelocate: v || undefined })} label={t('relocate')} />
        {me?.gender === 'MALE' && (
          <Toggle checked={!!f.openToPolygamy} onChange={(v) => setF({ ...f, openToPolygamy: v || undefined })} label={t('polygamy')} />
        )}
      </div>
    </Modal>
  );
}
