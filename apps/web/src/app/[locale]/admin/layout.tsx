'use client';

import { useEffect, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { LocaleMenu } from '@/components/LocaleMenu';
import { Logo } from '@/components/Logo';
import { Chip, cx, PageLoader } from '@/components/ui';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth';

const TABS = [
  { href: '/admin', key: 'queue' },
  { href: '/admin/reports', key: 'reports' },
  { href: '/admin/chats', key: 'chats' },
  { href: '/admin/users', key: 'users' },
] as const;

export default function AdminLayout({ children }: { children: ReactNode }) {
  const t = useTranslations('admin');
  const { me, loading, signedIn, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { data: stats } = useSWR<{ pendingModeration: number; openReports: number; activeChats: number }>(me && me.role !== 'USER' ? '/admin/stats' : null, {
    refreshInterval: 30_000,
  });

  useEffect(() => {
    if (!loading && !signedIn) router.replace('/login');
    else if (me && me.role === 'USER') router.replace('/app');
  }, [loading, signedIn, me, router]);

  if (!me || me.role === 'USER') return <PageLoader />;

  const badge: Record<string, number | undefined> = { queue: stats?.pendingModeration, reports: stats?.openReports, chats: stats?.activeChats };

  return (
    <div className="mx-auto max-w-6xl px-4">
      <header className="flex h-16 items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Logo href="/admin" />
          <Chip tone="accent">{t(`role.${me.role}`)}</Chip>
          <Chip>{t(`gender.${me.gender}`)}</Chip>
        </div>
        <div className="flex items-center gap-3">
          <LocaleMenu />
          <button
            type="button"
            className="text-sm font-semibold text-ink-3 hover:text-ink"
            onClick={() => {
              signOut();
              router.replace('/login');
            }}
          >
            {t('logout')}
          </button>
        </div>
      </header>
      <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-line" aria-label={t('title')}>
        {TABS.map((tab) => {
          const active = tab.href === '/admin' ? pathname === '/admin' || pathname.startsWith('/admin/items') : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={cx('-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold', active ? 'border-brand-500 text-ink' : 'border-transparent text-ink-3 hover:text-ink')}
            >
              {t(`tabs.${tab.key}`)}
              {!!badge[tab.key] && <span className="rounded-full bg-surface-alt px-2 text-xs">{badge[tab.key]}</span>}
            </Link>
          );
        })}
      </nav>
      <main className="pb-16">{children}</main>
    </div>
  );
}
