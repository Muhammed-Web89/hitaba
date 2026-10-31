'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { RULES, type FeedCard, type FeedFilter, type PublicProfile } from '@hitaba/shared';
import { Icon } from '@/components/icons';
import { ProfileCard } from '@/components/ProfileView';
import { RangeSlider } from '@/components/RangeSlider';
import { ReportDialog } from '@/components/ReportDialog';
import { StatusGate } from '@/components/StatusGate';
import { Button, cx, IconButton, Input, Modal, Notice, PageLoader, Select, Toggle } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { LANGUAGE_CODES, useDisplayNames, useErrorText } from '@/lib/format';

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
    window.scrollTo({ top: 0 });
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
            <Button variant="secondary" icon="undo" loading={busy} onClick={resetPasses}>
              {t('resetPasses')}
            </Button>
          </div>
        </div>
      )}

      {card && (
        <ProfileCard
          profile={card.profile}
          actions={
            <>
              <IconButton icon="star" label={t('favorite')} onClick={toggleFavorite} className={favorited ? 'text-accent' : ''} />
              <IconButton icon="flag" label={t('report')} onClick={() => setReportOpen(true)} />
            </>
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

      {/* Karar çubuğu: geç · kalan · ilgileniyorum */}
      {card && (
        <div className="pointer-events-none fixed inset-x-0 bottom-20 z-10 flex justify-center px-4" style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="pointer-events-auto flex w-full max-w-sm items-center justify-between rounded-full border border-line bg-surface/95 p-1.5 shadow-card backdrop-blur">
            <button
              type="button"
              aria-label={t('pass')}
              disabled={busy}
              onClick={() => act('pass')}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-alt text-ink-2 transition-transform hover:scale-105 disabled:opacity-50"
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
              className="flex h-12 items-center gap-1.5 rounded-full bg-brand-500 px-5 font-semibold text-brand-ink transition-transform hover:scale-105 disabled:opacity-50"
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
      {card && <ReportDialog open={reportOpen} onClose={() => setReportOpen(false)} targetUserId={card.profile.userId} />}
    </div>
  );
}

function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-surface p-4">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-3">{title}</h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

/** Tam ekran filtre sayfası; değişiklikler "Uygula" ile bir sonraki profilden itibaren geçerli olur. */
function FilterSheet({ onClose, value, onApply }: { onClose: () => void; value: FeedFilter; onApply: (f: FeedFilter) => void }) {
  const t = useTranslations('feed.filter');
  const tf = useTranslations('feed');
  const names = useDisplayNames();
  const { me } = useAuth();
  const [f, setF] = useState<FeedFilter>(value);
  const isMale = me?.gender === 'MALE';
  const toggle = (key: keyof FeedFilter, label: string, hint?: string) => (
    <Toggle checked={!!f[key]} onChange={(v) => setF({ ...f, [key]: v || undefined })} label={label} description={hint} />
  );

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-base" role="dialog" aria-modal="true" aria-labelledby="filters-title">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-line px-2">
        <IconButton icon="x" label={tf('close')} onClick={onClose} />
        <h2 id="filters-title" className="text-lg font-semibold">
          {tf('filters')}
        </h2>
        <button type="button" onClick={() => setF({})} className={cx('px-3 text-sm font-semibold', countActive(f) ? 'text-brand-600' : 'text-ink-3')}>
          {t('clear')}
        </button>
      </header>

      <div className="mx-auto w-full max-w-lg flex-1 space-y-3 overflow-y-auto px-4 py-4">
        <FilterSection title={t('where')}>
          <label className="block">
            <span className="mb-1 block text-sm text-ink-2">{t('country')}</span>
            <Select value={f.countries?.[0] ?? ''} onChange={(e) => setF({ ...f, countries: e.target.value ? [e.target.value] : undefined, city: e.target.value ? f.city : undefined })}>
              <option value="">{t('any')}</option>
              {names.countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-ink-2">{t('city')}</span>
            <Input
              value={f.city ?? ''}
              disabled={!f.countries?.length}
              placeholder={f.countries?.length ? '' : t('pickCountryFirst')}
              onChange={(e) => setF({ ...f, city: e.target.value || undefined })}
            />
          </label>
        </FilterSection>

        <FilterSection title={t('origin')}>
          <label className="block">
            <span className="mb-1 block text-sm text-ink-2">{t('nationality')}</span>
            <Input value={f.nationality ?? ''} placeholder={t('any')} onChange={(e) => setF({ ...f, nationality: e.target.value || undefined })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-ink-2">{t('language')}</span>
            <Select value={f.language ?? ''} onChange={(e) => setF({ ...f, language: e.target.value || undefined })}>
              <option value="">{t('any')}</option>
              {LANGUAGE_CODES.map((l) => (
                <option key={l} value={l}>
                  {names.language(l)}
                </option>
              ))}
            </Select>
          </label>
        </FilterSection>

        <section className="space-y-6 rounded-card border border-line bg-surface p-4">
          <RangeSlider label={t('age')} min={RULES.minAge} max={RULES.maxAge} value={[f.ageMin, f.ageMax]} onChange={([a, b]) => setF({ ...f, ageMin: a, ageMax: b })} marks={[18, 30, 50, 80]} />
          <RangeSlider label={t('height')} min={120} max={230} unit="cm" value={[f.heightMin, f.heightMax]} onChange={([a, b]) => setF({ ...f, heightMin: a, heightMax: b })} marks={[120, 150, 180, 230]} />
          <RangeSlider label={t('weight')} min={35} max={200} unit="kg" value={[f.weightMin, f.weightMax]} onChange={([a, b]) => setF({ ...f, weightMin: a, weightMax: b })} marks={[35, 80, 140, 200]} />
        </section>

        <FilterSection title={t('profile')}>
          {toggle('willingToRelocate', t('relocate'), t('relocateHint'))}
          {toggle('withPhoto', t('withPhoto'), t('withPhotoHint'))}
          {toggle('noChildren', t('noChildren'), t('noChildrenHint'))}
          {toggle('neverMarried', t('neverMarried'), t('neverMarriedHint'))}
          {isMale && toggle('openToPolygamy', t('polygamy'), t('polygamyHint'))}
          {isMale && toggle('notBusy', t('notBusy'), t('notBusyHint'))}
        </FilterSection>
      </div>

      <footer className="shrink-0 border-t border-line bg-surface px-4 py-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <div className="mx-auto max-w-lg">
          <Button size="lg" className="w-full" onClick={() => onApply(f)}>
            {t('apply')}
          </Button>
          <p className="mt-2 text-center text-xs text-ink-3">{t('applyHint')}</p>
        </div>
      </footer>
    </div>
  );
}
