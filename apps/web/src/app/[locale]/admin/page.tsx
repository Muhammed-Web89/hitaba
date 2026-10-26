'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import type { ModerationTarget } from '@hitaba/shared';
import { Card, Chip, EmptyState, PageLoader } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { useRelativeTime } from '@/lib/format';

interface ModerationItemRow {
  id: string;
  targetType: ModerationTarget;
  targetId: string;
  subjectUserId: string;
  subjectGender: 'MALE' | 'FEMALE';
  aiFlags: string[];
  status: string;
  createdAt: string;
}

const TYPES: Array<ModerationTarget | 'ALL'> = ['ALL', 'MESSAGE', 'MAHRAM_CONTACT', 'PROFILE', 'PHOTO'];

export default function QueuePage() {
  const t = useTranslations('admin');
  const time = useRelativeTime();
  const [type, setType] = useState<ModerationTarget | 'ALL'>('ALL');
  const { data: counts } = useSWR<Partial<Record<ModerationTarget, number>>>('/moderation/counts', { refreshInterval: 15_000 });
  const { data } = useSWR<ModerationItemRow[]>(`/moderation/queue${type === 'ALL' ? '' : `?type=${type}`}`, { refreshInterval: 15_000 });

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {TYPES.map((k) => (
          <Chip key={k} active={type === k} onClick={() => setType(k)}>
            {t(`target.${k}`)}
            {k !== 'ALL' && counts?.[k] ? ` · ${counts[k]}` : ''}
          </Chip>
        ))}
      </div>
      <p className="mb-4 text-sm text-ink-3">{t('segregationNote')}</p>
      {!data ? (
        <PageLoader />
      ) : !data.length ? (
        <EmptyState icon="check" title={t('queueEmpty')} />
      ) : (
        <Card className="divide-y divide-line">
          {data.map((i) => (
            <Link key={i.id} href={`/admin/items/${i.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-alt">
              <Chip tone={i.targetType === 'MESSAGE' || i.targetType === 'MAHRAM_CONTACT' ? 'warning' : 'info'}>{t(`target.${i.targetType}`)}</Chip>
              <span className="text-sm text-ink-2">{t(`gender.${i.subjectGender}`)}</span>
              <span className="flex flex-1 flex-wrap gap-1">
                {i.aiFlags.map((f) => (
                  <Chip key={f} tone="accent">
                    {f}
                  </Chip>
                ))}
              </span>
              <span className="text-xs text-ink-3">{time.ago(i.createdAt)}</span>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
