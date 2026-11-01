'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import type { ConnectPackageId, ConnectTxType } from '@hitaba/shared/client';
import { Icon } from '@/components/icons';
import { Button, Card, cx, IconButton, Notice, PageLoader, SectionTitle } from '@/components/ui';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useErrorText, useRelativeTime } from '@/lib/format';
import { telegramWebApp } from '@/lib/telegram';

interface WalletData {
  balance: number;
  /** stars: liste fiyatı, price: ödenecek fiyat (tanışma indirimi varsa düşük). */
  packages: { id: ConnectPackageId; connects: number; stars: number; price: number }[];
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
        tg!.openInvoice?.(invoiceLink, (status) => {
          if (status === 'failed') setError(t('paymentFailed'));
          if (status !== 'paid') return;
          // Jeton, Telegram'ın sunucumuza gönderdiği ödeme bildirimiyle eklenir; birkaç saniye içinde yenile.
          const refresh = () => Promise.all([mutate(), refreshMe()]);
          void refresh();
          setTimeout(refresh, 2000);
          setTimeout(refresh, 6000);
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
        {data.packages.map((p) => {
          const deal = p.price < p.stars;
          return (
            <Card key={p.id} className={cx('relative flex flex-col items-center p-4 pt-5 text-center', deal && 'border-accent/70 shadow-[0_0_24px_-6px_var(--accent-500)]')}>
              {deal && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-ink">
                  {t('introBadge')}
                </span>
              )}
              <span className="font-serif text-3xl font-semibold">{p.connects}</span>
              <span className="text-xs text-ink-3">{t('connects', { n: p.connects })}</span>
              <span className="mt-2 flex flex-col items-center leading-tight">
                {deal && (
                  <s className="text-xs text-ink-3" aria-label={t('oldPrice', { n: p.stars })}>
                    ⭐ {p.stars}
                  </s>
                )}
                <span className={cx('font-semibold text-accent', deal ? 'text-lg' : 'text-sm')}>⭐ {p.price}</span>
              </span>
              <Button size="sm" className="mt-3 w-full" loading={busy === p.id} onClick={() => buy(p.id)}>
                {t('buy')}
              </Button>
            </Card>
          );
        })}
      </div>
      {data.packages.some((p) => p.price < p.stars) && <p className="mt-3 text-center text-xs text-ink-3">{t('introNote')}</p>}
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
