'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import type { MatchSummary, PublicProfile } from '@hitaba/shared';
import { Icon } from '@/components/icons';
import { useMatchStatus } from '@/components/matchStatus';
import { PhotoFrame } from '@/components/ProfileView';
import { StatusGate } from '@/components/StatusGate';
import { Card, Chip, cx, EmptyState, PageLoader } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { useDisplayNames } from '@/lib/format';

type Tab = 'mutual' | 'mine' | 'favorites';

export default function LikesPage() {
  return (
    <StatusGate>
      <Likes />
    </StatusGate>
  );
}

function Likes() {
  const t = useTranslations('likes');
  const [tab, setTab] = useState<Tab>('mutual');
  return (
    <div>
      <div className="mb-4 grid grid-cols-3 gap-1 rounded-control bg-surface-alt p-1" role="tablist">
        {(['mutual', 'mine', 'favorites'] as const).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cx('h-9 rounded-[6px] text-sm font-semibold', tab === k ? 'bg-surface text-ink shadow-card' : 'text-ink-3')}
          >
            {t(`tabs.${k}`)}
          </button>
        ))}
      </div>
      {tab === 'mutual' ? <MutualList /> : <ProfileList tab={tab} />}
    </div>
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
                <PhotoFrame profile={m.other} className="h-16 w-16 shrink-0 rounded-full" />
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
  const names = useDisplayNames();
  const { data } = useSWR<PublicProfile[]>(`/likes?tab=${tab}`);
  if (!data) return <PageLoader />;
  if (!data.length) return <EmptyState icon={tab === 'mine' ? 'heart' : 'star'} title={t(tab === 'mine' ? 'emptyMine' : 'emptyFavorites')} />;
  return (
    <ul className="grid grid-cols-2 gap-3">
      {data.map((p) => (
        <li key={p.userId}>
          <Link href={`/app/profiles/${p.userId}`}>
            <Card className="overflow-hidden transition-colors hover:bg-surface-alt">
              <PhotoFrame profile={p} className="aspect-square w-full" />
              <div className="p-3">
                <p className="truncate font-semibold">{p.displayName}</p>
                <p className="truncate text-xs text-ink-3">
                  {p.ageRange} · {names.country(p.country)}
                </p>
              </div>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
