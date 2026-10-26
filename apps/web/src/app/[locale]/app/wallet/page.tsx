'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import type { ConnectPackageId, ConnectTxType } from '@hitaba/shared';
import { Icon } from '@/components/icons';
import { Button, Card, IconButton, Notice, PageLoader, SectionTitle } from '@/components/ui';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useErrorText, useRelativeTime } from '@/lib/format';
import { telegramWebApp } from '@/lib/telegram';

interface WalletData {
  balance: number;
  packages: { id: ConnectPackageId; connects: number; stars: number }[];
  telegramPayments: boolean;
  transactions: { id: string; amount: number; type: ConnectTxType; note: string | null; createdAt: string }[];
}

export default function WalletPage() {
  const t = useTranslations('wallet');
  const tc = useTranslations('common');
  const errorText = useErrorText();
  const time = useRelativeTime();
  const router = useRouter();
  const { refreshMe } = useAuth();
  const { data, mutate } = useSWR<WalletData>('/connects');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!data) return <PageLoader />;

  const tg = telegramWebApp();
  const inTelegram = Boolean(tg);

  async function buy(packageId: ConnectPackageId) {
    setBusy(packageId);
    setError(null);
    try {
      if (data!.telegramPayments && inTelegram) {
        const { invoiceLink } = await api<{ invoiceLink: string }>('/connects/invoice', { method: 'POST', body: { packageId } });
        tg!.openInvoice?.(invoiceLink, () => {
          void mutate();
          void refreshMe();
        });
      } else {
        // Geliştirme ortamı: ödeme simülasyonu (API'de DEV_PAYMENTS=true).
        await api('/connects/dev-credit', { method: 'POST', body: { packageId } });
        await Promise.all([mutate(), refreshMe()]);
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <IconButton icon="back" label={tc('back')} onClick={() => router.back()} className="flip-rtl" />
      <Card className="mt-2 flex items-center justify-between p-5">
        <div>
          <p className="text-sm text-ink-3">{t('balance')}</p>
          <p className="font-serif text-4xl font-semibold tabular-nums">{data.balance}</p>
        </div>
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-accent">
          <Icon name="wallet" size={26} />
        </span>
      </Card>
      <p className="mt-3 text-sm text-ink-2">{t('explain')}</p>

      <SectionTitle>{t('packages')}</SectionTitle>
      <div className="grid grid-cols-3 gap-3">
        {data.packages.map((p) => (
          <Card key={p.id} className="flex flex-col items-center p-4 text-center">
            <span className="font-serif text-3xl font-semibold">{p.connects}</span>
            <span className="text-xs text-ink-3">{t('connects', { n: p.connects })}</span>
            <span className="mt-2 text-sm font-semibold text-accent">⭐ {p.stars}</span>
            <Button size="sm" className="mt-3 w-full" loading={busy === p.id} onClick={() => buy(p.id)}>
              {t('buy')}
            </Button>
          </Card>
        ))}
      </div>
      {!inTelegram && (
        <div className="mt-3">
          <Notice>{t('devNote')}</Notice>
        </div>
      )}
      {error && (
        <div className="mt-3">
          <Notice tone="danger">{error}</Notice>
        </div>
      )}

      <SectionTitle>{t('history')}</SectionTitle>
      {data.transactions.length ? (
        <Card className="divide-y divide-line">
          {data.transactions.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-semibold">{t(`tx.${tx.type}`)}</p>
                <p className="text-xs text-ink-3">{time.ago(tx.createdAt)}</p>
              </div>
              <span className={`font-semibold tabular-nums ${tx.amount > 0 ? 'text-success' : 'text-ink-2'}`}>
                {tx.amount > 0 ? '+' : ''}
                {tx.amount}
              </span>
            </div>
          ))}
        </Card>
      ) : (
        <p className="text-sm text-ink-3">{t('noHistory')}</p>
      )}
    </div>
  );
}
