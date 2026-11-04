'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import type { OwnProfile } from '@hitaba/shared/client';
import { LocaleMenu } from '@/components/LocaleMenu';
import { TelegramDiagnostics } from '@/components/TelegramDiagnostics';
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

      <SectionTitle>{t('dangerZone')}</SectionTitle>
      <Card className="space-y-3 border-danger/40 p-4">
        <p className="text-sm text-ink-2">{t('deleteAccountHint')}</p>
        <Button variant="danger" className="w-full" icon="trash" onClick={() => setConfirmDelete(true)}>
          {t('deleteAccount')}
        </Button>
      </Card>

      <Modal
        open={confirmDelete}
        onClose={() => {
          setConfirmDelete(false);
          setUnderstood(false);
        }}
        title={t('deleteAccountTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              {tc('cancel')}
            </Button>
            <Button
              variant="danger"
              loading={deleting}
              disabled={!understood}
              onClick={async () => {
                setDeleting(true);
                try {
                  await api('/me/delete', { method: 'POST', body: { confirm: true } });
                  signOut();
                  router.replace('/');
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {t('deleteAccount')}
            </Button>
          </>
        }
      >
        <p>{t('deleteAccountText')}</p>
        <label className="mt-4 flex items-start gap-3 text-ink">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-[var(--danger)]" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
          <span className="font-semibold">{t('deleteAccountConfirm')}</span>
        </label>
      </Modal>

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
      <TelegramDiagnostics />
    </div>
  );
}
