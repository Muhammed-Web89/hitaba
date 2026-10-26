'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { Button, Card, Chip, EmptyState, PageLoader } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { useRelativeTime } from '@/lib/format';

interface ReportRow {
  id: string;
  category: string;
  details: string | null;
  chatId: string | null;
  status: string;
  createdAt: string;
  reporter: { id: string; profile: { displayName: string | null } | null };
  targetUser: { id: string; status: string; profile: { displayName: string | null } | null };
}

export default function ReportsPage() {
  const t = useTranslations('admin');
  const te = useTranslations('enums.report');
  const time = useRelativeTime();
  const [status, setStatus] = useState<'OPEN' | 'RESOLVED' | 'DISMISSED'>('OPEN');
  const { data, mutate } = useSWR<ReportRow[]>(`/admin/reports?status=${status}`);

  const resolve = (id: string, s: 'RESOLVED' | 'DISMISSED') => api(`/admin/reports/${id}/resolve`, { method: 'POST', body: { status: s } }).then(() => mutate());

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {(['OPEN', 'RESOLVED', 'DISMISSED'] as const).map((s) => (
          <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
            {t(`reportStatus.${s}`)}
          </Chip>
        ))}
      </div>
      {!data ? (
        <PageLoader />
      ) : !data.length ? (
        <EmptyState icon="flag" title={t('reportsEmpty')} />
      ) : (
        <div className="space-y-3">
          {data.map((r) => (
            <Card key={r.id} className="space-y-2 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone={r.category === 'MINOR' ? 'warning' : 'info'}>{te(r.category as never)}</Chip>
                <span className="text-xs text-ink-3">{time.ago(r.createdAt)}</span>
              </div>
              <p className="text-sm">
                <Link href={`/admin/users/${r.reporter.id}`} className="font-semibold hover:underline">
                  {r.reporter.profile?.displayName ?? r.reporter.id}
                </Link>{' '}
                → {' '}
                <Link href={`/admin/users/${r.targetUser.id}`} className="font-semibold text-danger hover:underline">
                  {r.targetUser.profile?.displayName ?? r.targetUser.id}
                </Link>{' '}
                <Chip>{r.targetUser.status}</Chip>
              </p>
              {r.details && <p className="whitespace-pre-wrap text-sm text-ink-2">{r.details}</p>}
              <div className="flex flex-wrap gap-2">
                {r.chatId && (
                  <Link href={`/admin/chats/${r.chatId}`} className="inline-flex h-9 items-center rounded-control border border-line px-3 text-sm font-semibold">
                    {t('openChat')}
                  </Link>
                )}
                {r.status === 'OPEN' && (
                  <>
                    <Button size="sm" onClick={() => resolve(r.id, 'RESOLVED')}>
                      {t('resolve')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => resolve(r.id, 'DISMISSED')}>
                      {t('dismiss')}
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
