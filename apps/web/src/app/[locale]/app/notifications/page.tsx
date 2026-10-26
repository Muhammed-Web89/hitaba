'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import type { NotificationItem } from '@hitaba/shared';
import { Icon, type IconName } from '@/components/icons';
import { Card, cx, EmptyState, PageLoader } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { useRelativeTime } from '@/lib/format';

const ICONS: Record<string, IconName> = {
  mutual_match: 'heart',
  photo_approved: 'camera',
  chat_requested: 'chat',
  chat_opened: 'chat',
  chat_closed: 'x',
  silence_reminder: 'clock',
  mahram_approved: 'shield',
  mahram_rejected: 'shield',
  profile_approved: 'check',
  profile_rejected: 'info',
  photo_rejected: 'camera',
  connects_credited: 'wallet',
};

function hrefFor(n: NotificationItem): string | null {
  const d = n.data as { matchId?: string; chatId?: string };
  if (d.chatId) return `/app/chats/${d.chatId}`;
  if (d.matchId) return `/app/matches/${d.matchId}`;
  if (n.type.startsWith('profile') || n.type === 'photo_rejected') return '/app/profile';
  if (n.type === 'connects_credited') return '/app/wallet';
  return null;
}

export default function NotificationsPage() {
  const t = useTranslations('notifications');
  const time = useRelativeTime();
  const { data, mutate } = useSWR<{ items: NotificationItem[]; unreadCount: number }>('/notifications');

  useEffect(() => {
    if (data?.unreadCount) void api('/notifications/read-all', { method: 'POST' }).then(() => mutate());
  }, [data?.unreadCount, mutate]);

  if (!data) return <PageLoader />;
  if (!data.items.length) return <EmptyState icon="bell" title={t('empty')} />;

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">{t('title')}</h1>
      <Card className="divide-y divide-line">
        {data.items.map((n) => {
          const href = hrefFor(n);
          const body = (
            <div className={cx('flex gap-3 px-4 py-3', !n.readAt && 'bg-brand-50')}>
              <Icon name={ICONS[n.type] ?? 'bell'} className="mt-0.5 shrink-0 text-brand-500" />
              <div className="min-w-0 flex-1">
                <p className="text-[15px]">{t.has(`types.${n.type}` as never) ? t(`types.${n.type}` as never) : n.type}</p>
                {typeof n.data.reason === 'string' && n.data.reason && <p className="text-sm text-ink-3">{n.data.reason}</p>}
                <p className="mt-0.5 text-xs text-ink-3">{time.ago(n.createdAt)}</p>
              </div>
            </div>
          );
          return href ? (
            <Link key={n.id} href={href} className="block hover:bg-surface-alt">
              {body}
            </Link>
          ) : (
            <div key={n.id}>{body}</div>
          );
        })}
      </Card>
    </div>
  );
}
