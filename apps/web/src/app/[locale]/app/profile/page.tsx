'use client';

import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { PROFILE_STEP_ORDER, type OwnProfile } from '@hitaba/shared';
import { Icon, type IconName } from '@/components/icons';
import { PhotoManager } from '@/components/PhotoManager';
import { Card, Chip, Notice, PageLoader, SectionTitle } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth';
import { useDisplayNames } from '@/lib/format';

export default function MyProfilePage() {
  const t = useTranslations('myProfile');
  const to = useTranslations('onboarding.steps');
  const { me } = useAuth();
  const names = useDisplayNames();
  const { data: p } = useSWR<OwnProfile>('/profile');
  if (!p || !me) return <PageLoader />;

  const links: Array<{ href: string; icon: IconName; label: string; hint?: string }> = [
    ...(me.gender === 'FEMALE' ? [{ href: '/app/wali', icon: 'shield' as const, label: t('wali'), hint: t('waliHint') }] : []),
    ...(me.gender === 'MALE' ? [{ href: '/app/wallet', icon: 'wallet' as const, label: t('wallet'), hint: t('balance', { n: me.connectBalance }) }] : []),
    { href: '/app/settings', icon: 'settings', label: t('settings') },
  ];

  return (
    <div>
      <div className="flex items-center gap-4">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 font-serif text-2xl font-semibold text-brand-600">
          {(p.displayName ?? '?').slice(0, 1)}
        </span>
        <div>
          <h1 className="text-2xl font-semibold">{p.displayName}</h1>
          <p className="text-sm text-ink-3">
            {p.city}, {names.country(p.country ?? '')}
          </p>
          <div className="mt-1">
            <Chip tone={p.moderationStatus === 'APPROVED' ? 'brand' : p.moderationStatus === 'PENDING' ? 'info' : 'warning'}>
              {t(`moderation.${p.moderationStatus}`)}
            </Chip>
          </div>
        </div>
      </div>

      {p.moderationStatus === 'PENDING' && me.status === 'APPROVED' && (
        <div className="mt-4">
          <Notice icon="clock">{t('remoderation')}</Notice>
        </div>
      )}

      <SectionTitle>{t('quick')}</SectionTitle>
      <Card className="divide-y divide-line">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-alt">
            <Icon name={l.icon} className="text-brand-500" />
            <span className="flex-1 font-semibold">{l.label}</span>
            {l.hint && <span className="text-sm text-ink-3">{l.hint}</span>}
            <Icon name="forward" size={18} className="flip-rtl text-ink-3" />
          </Link>
        ))}
      </Card>

      <SectionTitle>{t('photos')}</SectionTitle>
      <PhotoManager />

      <SectionTitle>{t('edit')}</SectionTitle>
      <Card className="divide-y divide-line">
        {PROFILE_STEP_ORDER.filter((s) => s !== 'rules').map((s) => (
          <Link key={s} href={`/app/profile/edit/${s}`} className="flex items-center justify-between px-4 py-3.5 hover:bg-surface-alt">
            <span className="font-semibold">{to(`${s}.title`)}</span>
            <Icon name="edit" size={18} className="text-ink-3" />
          </Link>
        ))}
      </Card>
      <p className="mt-2 text-xs text-ink-3">{t('editHint')}</p>
    </div>
  );
}
