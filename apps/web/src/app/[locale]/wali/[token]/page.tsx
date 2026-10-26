'use client';

import { use } from 'react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import type { WaliPortalView } from '@hitaba/shared';
import { Icon } from '@/components/icons';
import { LocaleMenu } from '@/components/LocaleMenu';
import { Logo } from '@/components/Logo';
import { MessageList } from '@/components/MessageList';
import { Button, Card, EmptyState, Notice, PageLoader } from '@/components/ui';
import { api } from '@/lib/api';
import { useDisplayNames } from '@/lib/format';

/** Veli/şahit portalı: kayıt gerektirmez, yalnızca okunur (§5.6, §8.5). */
export default function WaliPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const t = useTranslations('portal');
  const te = useTranslations('enums.relation');
  const names = useDisplayNames();
  const { data, error, isValidating, mutate } = useSWR<WaliPortalView>(`/wali-portal/${token}`, (p: string) => api<WaliPortalView>(p, { auth: false }));

  return (
    <div className="mx-auto min-h-dvh max-w-lg px-4 pb-24">
      <header className="flex h-16 items-center justify-between">
        <Logo href={`/wali/${token}`} />
        <LocaleMenu />
      </header>

      {error && <EmptyState icon="lock" title={t('invalidTitle')} text={t('invalidText')} />}
      {!data && !error && <PageLoader />}

      {data && (
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-semibold">{t('title', { name: data.femaleDisplayName })}</h1>
            {data.waliName && <p className="text-ink-2">{t('greeting', { name: data.waliName })}</p>}
          </div>

          {data.witnesses.length > 0 && (
            <Card className="p-4">
              <p className="mb-2 text-sm font-bold uppercase tracking-wider text-ink-3">{t('witnesses')}</p>
              <ul className="space-y-1 text-[15px]">
                {data.witnesses.map((w, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Icon name="user" size={16} className="text-brand-500" /> {w.name} · {te(w.relation)}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {!data.chat ? (
            <EmptyState icon="chat" title={t('noChat')} />
          ) : (
            <>
              <Card className="p-4">
                <p className="text-sm text-ink-3">{t('with')}</p>
                <p className="font-semibold">
                  {data.chat.other.displayName} · {data.chat.other.ageRange} · {data.chat.other.city}, {names.country(data.chat.other.country)}
                </p>
                <p className="mt-1 text-sm text-ink-3">{t(`status.${data.chat.status}`)}</p>
              </Card>
              <MessageList
                messages={data.chat.messages}
                mineId={data.femaleId}
                labels={{ mine: data.femaleDisplayName, theirs: data.chat.other.displayName }}
              />
            </>
          )}
        </div>
      )}

      {/* Bu bir salt-okunur görünümdür — her zaman sabit (§8.5) */}
      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <span className="flex flex-1 items-center gap-2 text-xs text-ink-2">
            <Icon name="eye" size={16} className="shrink-0 text-brand-500" /> {t('readonly')}
          </span>
          <Button size="sm" variant="secondary" loading={isValidating} onClick={() => mutate()}>
            {t('refresh')}
          </Button>
        </div>
      </div>
      {data && (
        <div className="mt-6">
          <Notice icon="lock">{t('privacy')}</Notice>
        </div>
      )}
    </div>
  );
}
