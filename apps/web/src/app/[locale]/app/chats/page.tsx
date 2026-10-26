'use client';

import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import type { ChatSummary } from '@hitaba/shared';
import { Icon } from '@/components/icons';
import { StatusGate } from '@/components/StatusGate';
import { Card, Chip, EmptyState, PageLoader } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { useRelativeTime } from '@/lib/format';

export default function ChatsPage() {
  return (
    <StatusGate>
      <Chats />
    </StatusGate>
  );
}

function Chats() {
  const t = useTranslations('chats');
  const tm = useTranslations('chat.system');
  const time = useRelativeTime();
  const { data } = useSWR<ChatSummary[]>('/chats', { refreshInterval: 30_000 });
  if (!data) return <PageLoader />;
  if (!data.length) return <EmptyState icon="chat" title={t('emptyTitle')} text={t('emptyText')} />;

  const preview = (c: ChatSummary) => {
    const l = c.lastMessage;
    if (!l) return '';
    if (l.text.startsWith('#')) {
      const key = l.text.slice(1);
      return key === 'mahram' ? t('mahramShared') : tm.has(key as never) ? tm(key as never) : '';
    }
    return (l.mine ? `${t('you')}: ` : '') + l.text;
  };

  return (
    <ul className="space-y-2">
      {data.map((c) => (
        <li key={c.id}>
          <Link href={`/app/chats/${c.id}`}>
            <Card className="flex items-center gap-3 p-3 transition-colors hover:bg-surface-alt">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-50 font-serif text-lg font-semibold text-brand-600">
                {c.other.displayName.slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-semibold">{c.other.displayName}</p>
                  <span className="shrink-0 text-xs text-ink-3">{time.ago(c.lastActivityAt)}</span>
                </div>
                <p className="truncate text-sm text-ink-2">{preview(c)}</p>
                <div className="mt-1 flex gap-1">
                  {c.status === 'PAUSED' && (
                    <Chip tone="warning">
                      <Icon name="pause" size={12} /> {t('paused')}
                    </Chip>
                  )}
                  {c.status === 'CLOSED' && <Chip>{t('closed')}</Chip>}
                  <Chip tone="neutral">
                    <Icon name="users" size={12} /> {t('witnessed')}
                  </Chip>
                </div>
              </div>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
