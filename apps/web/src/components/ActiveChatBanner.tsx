'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import type { ChatSummary } from '@hitaba/shared/client';
import { Icon } from '@/components/icons';
import { Button, Modal } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';

const DISMISS_KEY = 'hitaba:active-chat-banner';

/**
 * Kadının aynı anda tek açık sohbeti olabilir. Sohbet bitmiş ama kapatılmamışsa yeni kimseyle tanışamaz;
 * "Sohbeti yakunla" menüde kaldığı için çoğu kişi bulamıyordu. Bu şerit uygulamanın her sayfasında gösterir.
 */
export function ActiveChatBanner() {
  const t = useTranslations('chats');
  const tc = useTranslations('common');
  const { data, mutate } = useSWR<ChatSummary[]>('/chats', { refreshInterval: 60_000 });
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY);
    } catch {
      return null;
    }
  });
  const chat = data?.find((c) => c.status === 'ACTIVE' || c.status === 'PAUSED');
  if (!chat || dismissed === chat.id) return null;

  return (
    <div className="mb-4 rounded-card border border-accent/40 p-3 text-sm">
      <div className="flex items-start gap-2">
        <Icon name="chat" size={18} className="mt-0.5 shrink-0 text-accent" />
        <p className="min-w-0 flex-1">
          <span className="font-semibold">{t('activeChat', { name: chat.other.displayName })}</span>{' '}
          <span className="text-ink-2">{t('activeChatHint')}</span>
        </p>
        <button
          type="button"
          aria-label={tc('close')}
          className="shrink-0 text-ink-3"
          onClick={() => {
            setDismissed(chat.id);
            try {
              sessionStorage.setItem(DISMISS_KEY, chat.id);
            } catch {
              /* yoksay */
            }
          }}
        >
          <Icon name="x" size={16} />
        </button>
      </div>
      <div className="mt-2 flex gap-2">
        <Link href={`/app/chats/${chat.id}`} className="inline-flex h-9 items-center rounded-control border border-line px-3 font-semibold">
          {t('activeChatOpen')}
        </Link>
        <Button size="sm" variant="danger" onClick={() => setConfirm(true)}>
          {t('activeChatClose')}
        </Button>
      </div>
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t('activeChatCloseTitle', { name: chat.other.displayName })}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              {tc('cancel')}
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api(`/chats/${chat.id}/close`, { method: 'POST' });
                  await mutate();
                } finally {
                  setBusy(false);
                  setConfirm(false);
                }
              }}
            >
              {tc('confirm')}
            </Button>
          </>
        }
      >
        {t('activeChatCloseText')}
      </Modal>
    </div>
  );
}
