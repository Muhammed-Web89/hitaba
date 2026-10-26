'use client';

import { use, useState } from 'react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { RULES, type ChatSummary, type MatchSummary } from '@hitaba/shared';
import { Icon } from '@/components/icons';
import { useMatchStatus } from '@/components/matchStatus';
import { PhotoFrame, ProfileDetails, ProfileHeadline } from '@/components/ProfileView';
import { ReportDialog } from '@/components/ReportDialog';
import { StatusGate } from '@/components/StatusGate';
import { Button, Card, Chip, EmptyState, IconButton, Modal, Notice, PageLoader } from '@/components/ui';
import { Link, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useErrorText } from '@/lib/format';

export default function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <StatusGate>
      <Match id={id} />
    </StatusGate>
  );
}

function Match({ id }: { id: string }) {
  const t = useTranslations('match');
  const tc = useTranslations('common');
  const tf = useTranslations('feed');
  const errorText = useErrorText();
  const status = useMatchStatus();
  const router = useRouter();
  const { me, refreshMe } = useAuth();
  const { data: m, error: loadError, mutate } = useSWR<MatchSummary>(`/matches/${id}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'approve' | 'declinePhoto' | 'decline' | 'open' | null>(null);
  const [report, setReport] = useState(false);

  if (loadError) return <EmptyState icon="heart" title={tc('notFound')} />;
  if (!m || !me) return <PageLoader />;

  const male = me.gender === 'MALE';
  const s = status(m);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await mutate();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  const openChat = () =>
    run(async () => {
      const chat = await api<ChatSummary>('/chats', { method: 'POST', body: { matchId: m.id } });
      await refreshMe();
      router.push(`/app/chats/${chat.id}`);
    });

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <IconButton icon="back" label={tc('back')} onClick={() => router.push('/app/likes')} className="flip-rtl" />
        <IconButton icon="flag" label={tf('report')} onClick={() => setReport(true)} />
      </div>

      <Card className="space-y-3 p-4">
        <Chip tone={s.tone}>
          <Icon name={s.icon} size={12} /> {s.text}
        </Chip>

        {!male && m.awaitingMyPhotoDecision && (
          <>
            <p className="text-[15px]">{t('sisterDecisionText')}</p>
            <div className="flex gap-2">
              <Button className="flex-1" icon="check" onClick={() => setConfirm('approve')}>
                {t('approvePhoto')}
              </Button>
              <Button className="flex-1" variant="secondary" onClick={() => setConfirm('declinePhoto')}>
                {t('declinePhoto')}
              </Button>
            </div>
          </>
        )}

        {!male && m.stage === 'PHOTO_APPROVED' && !m.chatId && (
          <>
            <p className="text-[15px]">{t('sisterWaitingText')}</p>
            {!m.chatRequested && (
              <Button variant="secondary" icon="chat" loading={busy} onClick={() => run(() => api(`/matches/${m.id}/request-chat`, { method: 'POST' }))}>
                {t('requestChat')}
              </Button>
            )}
          </>
        )}

        {male && m.stage === 'MUTUAL' && <p className="text-[15px] text-ink-2">{t('brotherWaitingText')}</p>}

        {male && m.stage === 'PHOTO_APPROVED' && !m.chatId && (
          <>
            {m.chatRequested && (
              <Notice tone="success" icon="chat">
                {t('sisterRequested')}
              </Notice>
            )}
            {m.other.busy ? (
              <Notice tone="warning" icon="pause">
                {t('sisterBusy')}
              </Notice>
            ) : (
              <>
                <p className="text-[15px]">{t('openChatText', { cost: RULES.chatOpenCost })}</p>
                {me.connectBalance < RULES.chatOpenCost ? (
                  <Link href="/app/wallet" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-control bg-accent px-4 font-semibold text-white">
                    <Icon name="wallet" size={18} /> {t('buyConnects')}
                  </Link>
                ) : (
                  <Button className="w-full" icon="chat" disabled={!m.canOpenChat} onClick={() => setConfirm('open')}>
                    {t('openChat', { cost: RULES.chatOpenCost })}
                  </Button>
                )}
              </>
            )}
          </>
        )}

        {m.chatId && (
          <Link href={`/app/chats/${m.chatId}`} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-control bg-brand-500 px-4 font-semibold text-brand-ink">
            <Icon name="chat" size={18} /> {t('goToChat')}
          </Link>
        )}

        {!m.chatId && m.stage !== 'CLOSED' && !m.awaitingMyPhotoDecision && (
          <button type="button" className="text-sm font-semibold text-ink-3 underline-offset-4 hover:underline" onClick={() => setConfirm('decline')}>
            {t('decline')}
          </button>
        )}

        {error && <Notice tone="danger">{error}</Notice>}
      </Card>

      <Card className="overflow-hidden">
        <PhotoFrame profile={m.other} className="aspect-[4/5] w-full" />
        <div className="space-y-5 p-5">
          <ProfileHeadline profile={m.other} />
          <ProfileDetails profile={m.other} />
        </div>
      </Card>

      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm ? t(`confirm.${confirm}.title`) : ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              {tc('cancel')}
            </Button>
            <Button
              variant={confirm === 'decline' || confirm === 'declinePhoto' ? 'danger' : 'primary'}
              loading={busy}
              onClick={() => {
                if (confirm === 'approve') void run(() => api(`/matches/${m.id}/photo-decision`, { method: 'POST', body: { approve: true } }));
                if (confirm === 'declinePhoto')
                  void run(async () => {
                    await api(`/matches/${m.id}/photo-decision`, { method: 'POST', body: { approve: false } });
                    router.replace('/app/likes');
                  });
                if (confirm === 'decline')
                  void run(async () => {
                    await api(`/matches/${m.id}/decline`, { method: 'POST' });
                    router.replace('/app/likes');
                  });
                if (confirm === 'open') void openChat();
              }}
            >
              {tc('confirm')}
            </Button>
          </>
        }
      >
        {confirm && t(`confirm.${confirm}.text`, { cost: RULES.chatOpenCost, hours: RULES.photoViewWindowHours })}
      </Modal>

      <ReportDialog open={report} onClose={() => setReport(false)} targetUserId={m.other.userId} />
    </div>
  );
}
