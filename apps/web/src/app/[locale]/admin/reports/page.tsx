'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { Button, Card, Chip, EmptyState, PageLoader, Textarea } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { useRelativeTime } from '@/lib/format';

interface ReportRow {
  id: string;
  category: string;
  details: string | null;
  chatId: string | null;
  pairChatId: string | null;
  blocked: boolean;
  status: string;
  resolution: string | null;
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
                <Chip>{t(`userStatus.${r.targetUser.status}` as never)}</Chip>{' '}
                <Chip tone={r.blocked ? 'warning' : 'neutral'}>{t(r.blocked ? 'reportBlocked' : 'reportNotBlocked')}</Chip>
              </p>
              {r.details ? <p className="whitespace-pre-wrap text-sm text-ink-2">{r.details}</p> : <p className="text-sm italic text-ink-3">{t('reportNoDetails')}</p>}
              <div className="flex flex-wrap gap-2">
                {r.pairChatId && (
                  <Link href={`/admin/chats/${r.pairChatId}`} className="inline-flex h-9 items-center rounded-control border border-line px-3 text-sm font-semibold">
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
              {r.resolution && (
                <div className="rounded-control border border-line bg-surface-alt p-3">
                  <p className="text-xs font-semibold text-ink-3">{t('repliesSent')}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{r.resolution}</p>
                </div>
              )}
              <ReplyBox reportId={r.id} onSent={() => mutate()} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/** Şikâyet edene yanıt: uygulama bildirimi ve Telegram mesajı olarak gider. */
function ReplyBox({ reportId, onSent }: { reportId: string; onSent: () => void }) {
  const t = useTranslations('admin');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      await api(`/admin/reports/${reportId}/reply`, { method: 'POST', body: { text } });
      setText('');
      setSent(true);
      onSent();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      <Textarea rows={3} maxLength={1000} value={text} placeholder={t('replyPlaceholder')} onChange={(e) => (setText(e.target.value), setSent(false))} />
      <div className="flex items-center gap-3">
        <Button size="sm" variant="secondary" disabled={busy || text.trim().length < 2} onClick={send}>
          {t('sendReply')}
        </Button>
        {sent && <span className="text-xs text-brand-500">{t('replySent')}</span>}
      </div>
    </div>
  );
}
