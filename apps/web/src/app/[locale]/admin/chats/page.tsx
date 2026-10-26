'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { Card, Chip, EmptyState, PageLoader } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { useRelativeTime } from '@/lib/format';

interface ChatRow {
  id: string;
  status: string;
  pausedReason: string | null;
  lastActivityAt: string;
  match: { male: { profile: { displayName: string | null } | null }; female: { profile: { displayName: string | null } | null } };
  _count: { messages: number };
}

export default function AdminChatsPage() {
  const t = useTranslations('admin');
  const time = useRelativeTime();
  const [status, setStatus] = useState<'ACTIVE' | 'PAUSED' | 'CLOSED'>('ACTIVE');
  const { data } = useSWR<ChatRow[]>(`/admin/chats?status=${status}`, { refreshInterval: 20_000 });
  return (
    <div>
      <div className="mb-4 flex gap-2">
        {(['ACTIVE', 'PAUSED', 'CLOSED'] as const).map((s) => (
          <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
            {t(`chatStatus.${s}`)}
          </Chip>
        ))}
      </div>
      {!data ? (
        <PageLoader />
      ) : !data.length ? (
        <EmptyState icon="chat" title={t('chatsEmpty')} />
      ) : (
        <Card className="divide-y divide-line">
          {data.map((c) => (
            <Link key={c.id} href={`/admin/chats/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-alt">
              <span className="flex-1 font-semibold">
                {c.match.male.profile?.displayName} ♂ · {c.match.female.profile?.displayName} ♀
              </span>
              {c.pausedReason && <Chip tone="warning">{c.pausedReason}</Chip>}
              <span className="text-sm text-ink-3">{t('messages', { n: c._count.messages })}</span>
              <span className="text-xs text-ink-3">{time.ago(c.lastActivityAt)}</span>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
