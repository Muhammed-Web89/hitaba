'use client';

import { use, useState } from 'react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { Transcript } from '@/components/Transcript';
import { Button, Card, Chip, Field, Notice, PageLoader, Textarea } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useErrorText } from '@/lib/format';

interface AdminChat {
  chat: {
    id: string;
    status: string;
    closeReason: string | null;
    connectSpent: number;
    match: {
      male: { id: string; status: string; profile: { displayName: string | null } | null };
      female: { id: string; status: string; profile: { displayName: string | null } | null };
    };
  };
  messages: any[];
}

export default function AdminChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations('admin');
  const errorText = useErrorText();
  const { data, mutate } = useSWR<AdminChat>(`/admin/chats/${id}`);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const { me } = useAuth();
  if (!data) return <PageLoader />;
  const { chat } = data;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Transcript messages={data.messages} />
      <aside className="space-y-4">
        <Card className="space-y-2 p-4 text-sm">
          <p>
            <Chip>{t(`chatStatus.${chat.status}` as never)}</Chip> {chat.closeReason && <Chip tone="warning">{t(`closeReason.${chat.closeReason}` as never)}</Chip>}
          </p>
          {[chat.match.male, chat.match.female].map((u) => (
            <p key={u.id}>
              <Link href={`/admin/users/${u.id}`} className="font-semibold hover:underline">
                {u.profile?.displayName}
              </Link>{' '}
              <Chip>{t(`userStatus.${u.status}` as never)}</Chip>
            </p>
          ))}
          <p className="text-ink-3">{t('connectSpent', { n: chat.connectSpent })}</p>
        </Card>
        {chat.status === 'CLOSED' && me?.role === 'ADMIN' && (
          <Card className="space-y-3 p-4">
            <h3 className="font-semibold">{t('reopenChat')}</h3>
            <p className="text-xs text-ink-3">{t('reopenChatNote')}</p>
            {error && <Notice tone="danger">{error}</Notice>}
            {armed ? (
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="ghost" onClick={() => setArmed(false)}>
                  {t('genderFixCancel')}
                </Button>
                <Button
                  size="sm"
                  onClick={async () => {
                    setArmed(false);
                    setError(null);
                    try {
                      await api(`/admin/chats/${id}/reopen`, { method: 'POST' });
                      await mutate();
                    } catch (e) {
                      setError(errorText(e));
                    }
                  }}
                >
                  {t('reopenChatConfirm')}
                </Button>
              </div>
            ) : (
              <Button variant="secondary" className="w-full" onClick={() => setArmed(true)}>
                {t('reopenChat')}
              </Button>
            )}
          </Card>
        )}
        {chat.status !== 'CLOSED' && (
          <Card className="space-y-3 p-4">
            <h3 className="font-semibold">{t('closeChat')}</h3>
            <Field label={t('reason')}>
              <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <p className="text-xs text-ink-3">{t('closeRefundNote')}</p>
            {error && <Notice tone="danger">{error}</Notice>}
            <Button
              variant="danger"
              className="w-full"
              disabled={reason.trim().length < 3}
              onClick={async () => {
                try {
                  await api(`/admin/chats/${id}/close`, { method: 'POST', body: { reason } });
                  await mutate();
                } catch (e) {
                  setError(errorText(e));
                }
              }}
            >
              {t('closeChat')}
            </Button>
          </Card>
        )}
      </aside>
    </div>
  );
}
