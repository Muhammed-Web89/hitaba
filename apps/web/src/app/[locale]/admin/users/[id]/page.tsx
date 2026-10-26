'use client';

import { use, useState } from 'react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { Button, Card, Chip, Field, Modal, Notice, PageLoader, Textarea } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useErrorText, useRelativeTime } from '@/lib/format';

interface AdminUser {
  id: string;
  role: string;
  gender: string;
  status: string;
  statusReason: string | null;
  email: string | null;
  telegramUsername: string | null;
  connectBalance: number;
  createdAt: string;
  profile: Record<string, any> | null;
  reportsAgainst: { id: string; category: string; details: string | null; createdAt: string }[];
  connectTxs: { id: string; amount: number; type: string; createdAt: string }[];
  _count: Record<string, number>;
}

export default function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const errorText = useErrorText();
  const time = useRelativeTime();
  const { me } = useAuth();
  const { data: u, mutate } = useSWR<AdminUser>(`/admin/users/${id}`);
  const [action, setAction] = useState<'ban' | 'freeze' | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (!u) return <PageLoader />;

  async function run(path: string, body?: unknown) {
    setError(null);
    try {
      await api(`/admin/users/${id}/${path}`, { method: 'POST', body });
      setAction(null);
      setReason('');
      await mutate();
    } catch (e) {
      setError(errorText(e));
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">{u.profile?.displayName ?? u.id}</h1>
          <div className="mt-1 flex flex-wrap gap-2">
            <Chip>{t(`gender.${u.gender as 'MALE' | 'FEMALE'}`)}</Chip>
            <Chip tone={u.status === 'APPROVED' ? 'brand' : 'warning'}>{u.status}</Chip>
            {u.role !== 'USER' && <Chip tone="accent">{t(`role.${u.role as 'MODERATOR' | 'ADMIN' | 'USER'}`)}</Chip>}
          </div>
          {u.statusReason && <p className="mt-2 text-sm text-ink-2">{u.statusReason}</p>}
        </div>
        <Card className="p-4 text-sm">
          <dl className="grid grid-cols-[140px_1fr] gap-y-1.5">
            <dt className="text-ink-3">ID</dt>
            <dd className="font-mono text-xs">{u.id}</dd>
            <dt className="text-ink-3">Email</dt>
            <dd>{u.email ?? '—'}</dd>
            <dt className="text-ink-3">Telegram</dt>
            <dd>{u.telegramUsername ? `@${u.telegramUsername}` : '—'}</dd>
            <dt className="text-ink-3">{t('balance')}</dt>
            <dd>{u.connectBalance}</dd>
            <dt className="text-ink-3">{t('joined')}</dt>
            <dd>{time.ago(u.createdAt)}</dd>
            {Object.entries(u._count).map(([k, v]) => (
              <span key={k} className="contents">
                <dt className="text-ink-3">{k}</dt>
                <dd>{v}</dd>
              </span>
            ))}
          </dl>
        </Card>
        {u.profile?.aboutMe && (
          <Card className="whitespace-pre-wrap p-4 text-sm">{u.profile.aboutMe}</Card>
        )}
        <Card className="p-4">
          <h3 className="mb-2 font-semibold">{t('reportsAgainst')}</h3>
          {u.reportsAgainst.length ? (
            <ul className="space-y-2 text-sm">
              {u.reportsAgainst.map((r) => (
                <li key={r.id}>
                  <Chip tone="warning">{r.category}</Chip> <span className="text-ink-3">{time.ago(r.createdAt)}</span>
                  {r.details && <p className="text-ink-2">{r.details}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-3">—</p>
          )}
        </Card>
      </div>

      <aside className="space-y-3">
        <Card className="space-y-2 p-4">
          <h3 className="font-semibold">{t('actions')}</h3>
          {u.status === 'APPROVED' && (
            <Button variant="secondary" className="w-full" onClick={() => setAction('freeze')}>
              {t('freeze')}
            </Button>
          )}
          {u.status === 'FROZEN' && (
            <Button variant="secondary" className="w-full" onClick={() => run('unfreeze')}>
              {t('unfreeze')}
            </Button>
          )}
          {me?.role === 'ADMIN' && u.status !== 'BANNED' && (
            <Button variant="danger" className="w-full" onClick={() => setAction('ban')}>
              {t('ban')}
            </Button>
          )}
          {error && <Notice tone="danger">{error}</Notice>}
          <p className="text-xs text-ink-3">{t('banNote')}</p>
        </Card>
      </aside>

      <Modal
        open={action !== null}
        onClose={() => setAction(null)}
        title={action === 'ban' ? t('ban') : t('freeze')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAction(null)}>
              {tc('cancel')}
            </Button>
            <Button variant="danger" disabled={reason.trim().length < 3} onClick={() => run(action!, { reason })}>
              {tc('confirm')}
            </Button>
          </>
        }
      >
        <Field label={t('reason')}>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Modal>
    </div>
  );
}
