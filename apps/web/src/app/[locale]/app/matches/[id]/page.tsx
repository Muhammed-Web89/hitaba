'use client';

import { use, useState } from 'react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { RULES, type ChatSummary, type MatchSummary } from '@hitaba/shared/client';
import { GuideLink } from '@/components/guide/GuideLink';
import { Icon } from '@/components/icons';
import { useMatchStatus } from '@/components/matchStatus';
import { OneTimePhotoViewer } from '@/components/OneTimePhotoViewer';
import { ProfileCard } from '@/components/ProfileView';
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
  const tgl = useTranslations('guideLinks');
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
  const [photo, setPhoto] = useState<string[] | null>(null);

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

  // Kadın fotoğrafı: her görüntüleme kadının izniyle, bir kez.
  const viewPhoto = () =>
    run(async () => {
      const res = await api<{ photoUrls: string[] }>(`/matches/${m.id}/photo/open`, { method: 'POST' });
      setPhoto(res.photoUrls);
    });
  const photoStage = m.stage === 'PHOTO_APPROVED' || m.stage === 'CHAT_OPEN';
  // Görüntüleyici kapandı: erişim sunucuda hemen biter, tekrar görmek yeni izin ister.
  const endPhoto = () => {
    setPhoto(null);
    void api(`/matches/${m.id}/photo/close`, { method: 'POST' })
      .catch(() => {})
      .then(() => mutate());
  };

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
                  <div className="space-y-2 text-center">
                    <Link href="/app/wallet" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-control bg-accent px-4 font-semibold text-white">
                      <Icon name="wallet" size={18} /> {t('buyConnects')}
                    </Link>
                    <GuideLink compact href="/guide/payment" emoji="❓" title={tgl('payment')} />
                  </div>
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

      {male && photoStage && (
        <Card className="space-y-3 p-4">
          <h2 className="flex items-center gap-2 font-sans text-xs font-bold uppercase tracking-wider text-ink-3">
            <Icon name="camera" size={15} className="text-brand-500" /> {t('photo.title')}
          </h2>
          {m.photoViewAvailable ? (
            <>
              <Button className="w-full" icon="eye" loading={busy} onClick={viewPhoto}>
                {t('photo.open')}
              </Button>
              <p className="text-xs text-ink-3">{t('photo.openHint')}</p>
            </>
          ) : m.photoViewRequested ? (
            <Notice icon="clock">{t('photo.requested')}</Notice>
          ) : (
            <>
              <p className="text-sm text-ink-2">{t('photo.used')}</p>
              <Button variant="secondary" className="w-full" icon="send" loading={busy} onClick={() => run(() => api(`/matches/${m.id}/photo/request`, { method: 'POST' }))}>
                {t('photo.request')}
              </Button>
            </>
          )}
        </Card>
      )}

      {!male && m.photoViewRequested && (
        <Card className="space-y-3 border-accent/50 p-4">
          <p className="flex items-start gap-2 text-[15px]">
            <Icon name="eye" size={18} className="mt-0.5 shrink-0 text-accent" />
            <span>
              <strong>{m.other.displayName}</strong> {t('photo.sisterAsk')}
            </span>
          </p>
          <div className="flex gap-2">
            <Button className="flex-1" icon="check" loading={busy} onClick={() => run(() => api(`/matches/${m.id}/photo/decision`, { method: 'POST', body: { approve: true } }))}>
              {t('photo.allow')}
            </Button>
            <Button className="flex-1" variant="secondary" disabled={busy} onClick={() => run(() => api(`/matches/${m.id}/photo/decision`, { method: 'POST', body: { approve: false } }))}>
              {t('photo.deny')}
            </Button>
          </div>
        </Card>
      )}

      <ProfileCard profile={m.other} />

      {photo && <OneTimePhotoViewer urls={photo} name={m.other.displayName} onEnd={endPhoto} />}

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
        {confirm && t(`confirm.${confirm}.text`, { cost: RULES.chatOpenCost })}
      </Modal>

      <ReportDialog open={report} onClose={() => setReport(false)} targetUserId={m.other.userId} />
    </div>
  );
}
