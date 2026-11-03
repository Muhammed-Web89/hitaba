'use client';

import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import type { PublicProfile } from '@hitaba/shared/client';
import { Icon } from '@/components/icons';
import { ProfileCard } from '@/components/ProfileView';
import { IconButton, Notice, PageLoader } from '@/components/ui';
import { Link, useRouter } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth';

/** "Profilim nasıl görünüyor": karşı cinsten, henüz eşleşmesi olmayan birinin gördüğü hal. */
export default function ProfilePreviewPage() {
  const t = useTranslations('myProfile.preview');
  const tc = useTranslations('common');
  const router = useRouter();
  const { me } = useAuth();
  const { data } = useSWR<{ profile: PublicProfile; photosVisible: boolean }>('/profile/preview');
  if (!data || !me) return <PageLoader />;

  const female = me.gender === 'FEMALE';
  const photoNote = female ? t('photosFemale') : data.photosVisible ? t('photosMaleShown') : t('photosMaleHidden');

  return (
    <div className="pb-6">
      <div className="mb-3 flex items-center gap-2">
        <IconButton icon="back" label={tc('back')} onClick={() => router.back()} className="flip-rtl" />
        <h1 className="text-xl font-semibold">{t('title')}</h1>
      </div>

      <div className="glass mb-4 flex items-center gap-3 rounded-card border border-accent/40 px-4 py-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-accent shadow-[0_0_24px_-8px_var(--accent-500)]">
          <Icon name="eye" size={20} />
        </span>
        <p className="text-sm font-semibold">{female ? t('bannerFemale') : t('bannerMale')}</p>
      </div>

      <ProfileCard profile={data.profile} />

      <div className="mt-4">
        <Notice icon="lock">
          {photoNote}
          {!female && (
            <>
              {' '}
              <Link href="/app/settings" className="font-semibold text-brand-500 underline-offset-2 hover:underline">
                {t('changeInSettings')}
              </Link>
            </>
          )}
        </Notice>
      </div>

      <Link href="/app/profile" className="glow mt-4 flex h-12 items-center justify-center gap-2 rounded-control bg-brand-500 font-semibold text-brand-ink">
        <Icon name="edit" size={18} /> {t('edit')}
      </Link>
    </div>
  );
}
