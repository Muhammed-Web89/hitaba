'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { Card, Chip, EmptyState, Input, PageLoader } from '@/components/ui';
import { Link } from '@/i18n/navigation';

interface UserRow {
  id: string;
  role: string;
  gender: string;
  status: string;
  email: string | null;
  telegramUsername: string | null;
  profile: { displayName: string | null; city: string | null; country: string | null } | null;
  _count: { reportsAgainst: number };
}

export default function AdminUsersPage() {
  const t = useTranslations('admin');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const { data } = useSWR<UserRow[]>(`/admin/users${query ? `?q=${encodeURIComponent(query)}` : ''}`);
  return (
    <div>
      <form
        className="mb-4"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(q.trim());
        }}
      >
        <Input placeholder={t('searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} />
      </form>
      {!data ? (
        <PageLoader />
      ) : !data.length ? (
        <EmptyState icon="users" title={t('usersEmpty')} />
      ) : (
        <Card className="divide-y divide-line">
          {data.map((u) => (
            <Link key={u.id} href={`/admin/users/${u.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-surface-alt">
              <span className="min-w-40 flex-1 font-semibold">{u.profile?.displayName ?? '—'}</span>
              <span className="text-sm text-ink-3">{u.email ?? (u.telegramUsername ? `@${u.telegramUsername}` : '')}</span>
              <Chip>{t(`gender.${u.gender as 'MALE' | 'FEMALE'}`)}</Chip>
              {u.role !== 'USER' && <Chip tone="accent">{t(`role.${u.role as 'MODERATOR' | 'ADMIN' | 'USER'}`)}</Chip>}
              <Chip tone={u.status === 'APPROVED' ? 'brand' : u.status === 'BANNED' ? 'warning' : 'info'}>{t(`userStatus.${u.status}` as never)}</Chip>
              {u._count.reportsAgainst > 0 && <Chip tone="warning">⚑ {u._count.reportsAgainst}</Chip>}
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
