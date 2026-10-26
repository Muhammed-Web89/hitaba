'use client';

import { useEffect, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import type { NotificationItem } from '@hitaba/shared';
import { Icon, type IconName } from '@/components/icons';
import { Logo } from '@/components/Logo';
import { cx, PageLoader } from '@/components/ui';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth';
import { getSocket } from '@/lib/socket';

const NAV: Array<{ href: string; key: 'feed' | 'likes' | 'chats' | 'profile'; icon: IconName }> = [
  { href: '/app/feed', key: 'feed', icon: 'compass' },
  { href: '/app/likes', key: 'likes', icon: 'heart' },
  { href: '/app/chats', key: 'chats', icon: 'chat' },
  { href: '/app/profile', key: 'profile', icon: 'user' },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const t = useTranslations('nav');
  const { me, loading, signedIn } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { data: notes, mutate } = useSWR<{ items: NotificationItem[]; unreadCount: number }>(me ? '/notifications' : null, {
    refreshInterval: 60_000,
  });

  useEffect(() => {
    if (!loading && !signedIn) router.replace('/login');
    else if (me && me.role !== 'USER') router.replace('/admin');
    else if (me && (me.status === 'ONBOARDING' || me.status === 'REJECTED')) router.replace('/onboarding');
  }, [loading, signedIn, me, router]);

  // Yeni bildirimler gerçek zamanlı gelir.
  useEffect(() => {
    if (!me) return;
    const s = getSocket();
    const onNote = () => void mutate();
    s?.on('notification:new', onNote);
    return () => {
      s?.off('notification:new', onNote);
    };
  }, [me, mutate]);

  if (!me || me.role !== 'USER') return <PageLoader />;

  const inChat = /^\/app\/chats\/[^/]+$/.test(pathname);

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      {!inChat && (
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-base/90 px-4 backdrop-blur">
          <Logo href="/app" />
          <div className="flex items-center gap-1">
            {me.gender === 'MALE' && (
              <Link href="/app/wallet" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-3 text-sm font-semibold" aria-label={t('wallet')}>
                <Icon name="wallet" size={16} className="text-accent" />
                <span className="tabular-nums">{me.connectBalance}</span>
              </Link>
            )}
            <Link href="/app/notifications" className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-2 hover:bg-surface-alt" aria-label={t('notifications')}>
              <Icon name="bell" />
              {!!notes?.unreadCount && (
                <span className="absolute end-1.5 top-1.5 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] font-bold leading-4 text-white">
                  {notes.unreadCount > 9 ? '9+' : notes.unreadCount}
                </span>
              )}
            </Link>
          </div>
        </header>
      )}

      <main className={cx('flex-1', !inChat && 'px-4 pb-24 pt-4')}>{children}</main>

      {!inChat && (
        <nav
          className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          aria-label={t('main')}
        >
          <ul className="mx-auto grid max-w-lg grid-cols-4">
            {NAV.map((n) => {
              const active = pathname.startsWith(n.href);
              return (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    aria-current={active ? 'page' : undefined}
                    className={cx('flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold', active ? 'text-brand-500' : 'text-ink-3')}
                  >
                    <Icon name={n.icon} size={22} />
                    {t(n.key)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}
