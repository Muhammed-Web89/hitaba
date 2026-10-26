'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import type { OwnProfile } from '@hitaba/shared';
import { LocaleMenu } from '@/components/LocaleMenu';
import { ThemeSelector } from '@/components/ThemeToggle';
import { Button, Card, IconButton, Modal, PageLoader, SectionTitle, Toggle } from '@/components/ui';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function SettingsPage() {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const router = useRouter();
  const { me, signOut, refreshMe } = useAuth();
  const { data: p, mutate } = useSWR<OwnProfile>('/profile');
  const [confirmAll, setConfirmAll] = useState(false);
  if (!p || !me) return <PageLoader />;

  const update = async (body: Record<string, unknown>) => {
    await api('/profile/settings', { method: 'PATCH', body });
    await Promise.all([mutate(), refreshMe()]);
  };

  return (
    <div>
      <IconButton icon="back" label={tc('back')} onClick={() => router.push('/app/profile')} className="flip-rtl" />
      <h1 className="mt-2 text-2xl font-semibold">{t('title')}</h1>

      <SectionTitle>{t('appearance')}</SectionTitle>
      <Card className="space-y-4 p-4">
        <div>
          <p className="mb-2 text-sm font-semibold">{t('theme')}</p>
          <ThemeSelector />
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold">{t('language')}</p>
          <LocaleMenu full />
        </div>
      </Card>

      <SectionTitle>{t('privacy')}</SectionTitle>
      <Card className="space-y-4 p-4">
        {me.gender === 'MALE' ? (
          <Toggle checked={p.showPhotoInFeed} onChange={(v) => update({ showPhotoInFeed: v })} label={t('showPhotoInFeed')} description={t('showPhotoInFeedHint')} />
        ) : (
          <Toggle checked={p.hideBusyBadge} onChange={(v) => update({ hideBusyBadge: v })} label={t('hideBusyBadge')} description={t('hideBusyBadgeHint')} />
        )}
      </Card>

      <SectionTitle>{t('account')}</SectionTitle>
      <Card className="space-y-3 p-4">
        <p className="text-sm text-ink-2">{me.email ?? (me.telegramUsername ? `@${me.telegramUsername}` : '')}</p>
        <Button variant="secondary" className="w-full" icon="logout" onClick={() => { signOut(); router.replace('/'); }}>
          {t('logout')}
        </Button>
        <Button variant="ghost" className="w-full text-danger" onClick={() => setConfirmAll(true)}>
          {t('logoutAll')}
        </Button>
      </Card>

      <Modal
        open={confirmAll}
        onClose={() => setConfirmAll(false)}
        title={t('logoutAll')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmAll(false)}>
              {tc('cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await api('/auth/logout-all', { method: 'POST' });
                signOut();
                router.replace('/login');
              }}
            >
              {tc('confirm')}
            </Button>
          </>
        }
      >
        {t('logoutAllText')}
      </Modal>
    </div>
  );
}
