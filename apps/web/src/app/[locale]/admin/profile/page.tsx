'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import QRCode from 'qrcode';
import useSWR from 'swr';
import type { AuthTokens } from '@hitaba/shared/client';
import { Button, Card, Chip, Field, Input, Notice, PageLoader, SectionTitle } from '@/components/ui';
import { api, tokens } from '@/lib/api';
import { useErrorText, useRelativeTime } from '@/lib/format';

interface Overview {
  email: string | null;
  role: 'ADMIN' | 'MODERATOR';
  totpEnabled: boolean;
  totpEnabledAt: string | null;
  passwordChangedAt: string | null;
  sessions: { id: string; ip: string | null; userAgent: string | null; createdAt: string; lastUsedAt: string; current: boolean }[];
  logins: { id: string; ok: boolean; reason: 'password' | 'otp' | null; ip: string | null; userAgent: string | null; createdAt: string }[];
}

/** Ürün adları (Chrome, iPhone…) her dilde aynı yazılır; yalnızca "bilinmiyor" çevrilir. */
function device(ua: string | null): string | null {
  if (!ua) return null;
  const browser = /Telegram/i.test(ua)
    ? 'Telegram'
    : /Edg\//.test(ua)
      ? 'Edge'
      : /OPR\/|Opera/.test(ua)
        ? 'Opera'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : /Chrome\/|CriOS/.test(ua)
            ? 'Chrome'
            : /Safari\//.test(ua)
              ? 'Safari'
              : null;
  const os = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Mac OS X|Macintosh/.test(ua)
          ? 'macOS'
          : /Windows/.test(ua)
            ? 'Windows'
            : /Linux/.test(ua)
              ? 'Linux'
              : null;
  return [browser, os].filter(Boolean).join(' · ') || null;
}

export default function AdminProfilePage() {
  const t = useTranslations('admin.profile');
  const { data, mutate } = useSWR<Overview>('/staff/me');
  if (!data) return <PageLoader />;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <AccountCard data={data} />
        <PasswordCard onDone={() => mutate()} />
        <TwoFactorCard enabled={data.totpEnabled} since={data.totpEnabledAt} onDone={() => mutate()} />
      </div>
      <div className="space-y-6">
        <SessionsCard sessions={data.sessions} onDone={() => mutate()} />
        <section>
          <SectionTitle>{t('loginsTitle')}</SectionTitle>
          <Card className="divide-y divide-line">
            {!data.logins.length && <p className="px-4 py-3 text-sm text-ink-3">{t('loginsEmpty')}</p>}
            {data.logins.map((l) => (
              <LoginRow key={l.id} row={l} />
            ))}
          </Card>
        </section>
      </div>
    </div>
  );
}

function useDateTime() {
  const locale = useLocale();
  return (iso: string) => new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short', ...(locale === 'uz' && { hourCycle: 'h23' as const }) });
}

function AccountCard({ data }: { data: Overview }) {
  const t = useTranslations('admin.profile');
  const ta = useTranslations('admin');
  const dateTime = useDateTime();
  return (
    <section>
      <SectionTitle>{t('accountTitle')}</SectionTitle>
      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{data.email}</span>
          <Chip tone="accent">{ta(`role.${data.role}`)}</Chip>
        </div>
        <p className="text-sm text-ink-3">{data.passwordChangedAt ? t('passwordChangedAt', { date: dateTime(data.passwordChangedAt) }) : t('passwordNeverChanged')}</p>
        <p className="text-sm text-ink-3">{t('emailNote')}</p>
      </Card>
    </section>
  );
}

function PasswordCard({ onDone }: { onDone: () => void }) {
  const t = useTranslations('admin.profile');
  const errorText = useErrorText();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (next.length < 14) return setError(t('passwordTooShort'));
    if (next !== repeat) return setError(t('passwordMismatch'));
    setBusy(true);
    try {
      // Diğer cihazlar çıkış yapar; bu cihaz yeni token'la açık kalır.
      tokens.set(await api<AuthTokens>('/staff/me/password', { method: 'POST', body: { currentPassword: current, newPassword: next } }));
      setCurrent('');
      setNext('');
      setRepeat('');
      setDone(true);
      onDone();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <SectionTitle>{t('passwordTitle')}</SectionTitle>
      <Card className="p-4">
        <form onSubmit={submit} className="space-y-4">
          <Field label={t('currentPassword')}>
            <Input type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
          </Field>
          <Field label={t('newPassword')} hint={t('newPasswordHint')}>
            <Input type="password" autoComplete="new-password" required minLength={14} value={next} onChange={(e) => setNext(e.target.value)} />
          </Field>
          <Field label={t('repeatPassword')}>
            <Input type="password" autoComplete="new-password" required value={repeat} onChange={(e) => setRepeat(e.target.value)} />
          </Field>
          {error && <Notice tone="danger">{error}</Notice>}
          {done && <Notice tone="success">{t('passwordChanged')}</Notice>}
          <Button type="submit" loading={busy}>
            {t('passwordSubmit')}
          </Button>
        </form>
      </Card>
    </section>
  );
}

function TwoFactorCard({ enabled, since, onDone }: { enabled: boolean; since: string | null; onDone: () => void }) {
  const t = useTranslations('admin.profile');
  const errorText = useErrorText();
  const dateTime = useDateTime();
  const [step, setStep] = useState<'idle' | 'password' | 'scan' | 'disable'>('idle');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (!setup) return setQr(null);
    void QRCode.toDataURL(setup.otpauthUrl, { margin: 1, width: 200 }).then(setQr).catch(() => setQr(null));
  }, [setup]);

  const reset = () => {
    setStep('idle');
    setPassword('');
    setCode('');
    setSetup(null);
    setError(null);
  };

  async function run(e: FormEvent, action: () => Promise<void>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const codeInput = (
    <Field label={t('codeLabel')}>
      <Input
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
      />
    </Field>
  );
  const passwordInput = (
    <Field label={t('currentPassword')}>
      <Input type="password" autoComplete="current-password" required autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
    </Field>
  );
  const cancel = (
    <Button type="button" variant="ghost" onClick={reset}>
      {t('cancel')}
    </Button>
  );

  return (
    <section>
      <SectionTitle action={enabled ? <Chip tone="brand">{t('twoFactorOn')}</Chip> : <Chip tone="warning">{t('twoFactorOff')}</Chip>}>{t('twoFactorTitle')}</SectionTitle>
      <Card className="space-y-4 p-4">
        <p className="text-sm text-ink-2">{t('twoFactorText')}</p>
        {done && <Notice tone="success">{done}</Notice>}

        {enabled && step === 'idle' && (
          <>
            {since && <p className="text-sm text-ink-3">{t('twoFactorSince', { date: dateTime(since) })}</p>}
            <Button variant="secondary" onClick={() => (setDone(null), setStep('disable'))}>
              {t('twoFactorDisable')}
            </Button>
          </>
        )}
        {enabled && step === 'disable' && (
          <form
            className="space-y-4"
            onSubmit={(e) =>
              run(e, async () => {
                await api('/staff/me/2fa/disable', { method: 'POST', body: { password, code } });
                reset();
                setDone(t('twoFactorDisabled'));
                onDone();
              })
            }
          >
            <Notice tone="warning">{t('twoFactorDisableWarning')}</Notice>
            {passwordInput}
            {codeInput}
            {error && <Notice tone="danger">{error}</Notice>}
            <div className="flex gap-2">
              <Button type="submit" variant="danger" loading={busy}>
                {t('twoFactorDisable')}
              </Button>
              {cancel}
            </div>
          </form>
        )}

        {!enabled && step === 'idle' && (
          <>
            <Notice tone="warning">{t('twoFactorRecommend')}</Notice>
            <Button onClick={() => (setDone(null), setStep('password'))}>{t('twoFactorSetup')}</Button>
          </>
        )}
        {!enabled && step === 'password' && (
          <form
            className="space-y-4"
            onSubmit={(e) =>
              run(e, async () => {
                setSetup(await api<{ secret: string; otpauthUrl: string }>('/staff/me/2fa/setup', { method: 'POST', body: { password } }));
                setPassword('');
                setStep('scan');
              })
            }
          >
            {passwordInput}
            {error && <Notice tone="danger">{error}</Notice>}
            <div className="flex gap-2">
              <Button type="submit" loading={busy}>
                {t('continue')}
              </Button>
              {cancel}
            </div>
          </form>
        )}
        {!enabled && step === 'scan' && setup && (
          <form
            className="space-y-4"
            onSubmit={(e) =>
              run(e, async () => {
                await api('/staff/me/2fa/enable', { method: 'POST', body: { code } });
                reset();
                setDone(t('twoFactorEnabled'));
                onDone();
              })
            }
          >
            <ol className="list-decimal space-y-1 ps-5 text-sm text-ink-2">
              <li>{t('scanStep1')}</li>
              <li>{t('scanStep2')}</li>
              <li>{t('scanStep3')}</li>
            </ol>
            <div className="flex flex-wrap items-center gap-4">
              {qr && <img src={qr} alt={t('qrAlt')} width={200} height={200} className="rounded-lg bg-white p-2" />}
              <div className="min-w-0 space-y-1">
                <p className="text-xs text-ink-3">{t('manualKey')}</p>
                <code dir="ltr" className="block break-all rounded-md bg-surface-alt px-2 py-1 font-mono text-sm tracking-wider">
                  {setup.secret.match(/.{1,4}/g)?.join(' ')}
                </code>
              </div>
            </div>
            {codeInput}
            {error && <Notice tone="danger">{error}</Notice>}
            <div className="flex gap-2">
              <Button type="submit" loading={busy}>
                {t('twoFactorConfirm')}
              </Button>
              {cancel}
            </div>
          </form>
        )}
      </Card>
    </section>
  );
}

function SessionsCard({ sessions, onDone }: { sessions: Overview['sessions']; onDone: () => void }) {
  const t = useTranslations('admin.profile');
  const errorText = useErrorText();
  const { ago } = useRelativeTime();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const others = sessions.filter((s) => !s.current).length;

  async function act(key: string, action: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await action();
      onDone();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section>
      <SectionTitle>{t('sessionsTitle')}</SectionTitle>
      <Card className="divide-y divide-line">
        {sessions.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-40 flex-1">
              <div className="flex flex-wrap items-center gap-2 font-semibold">
                {device(s.userAgent) ?? t('unknownDevice')}
                {s.current && <Chip tone="brand">{t('thisDevice')}</Chip>}
              </div>
              <div className="text-sm text-ink-3">
                <span dir="ltr">{s.ip ?? '—'}</span> · {t('lastActive', { time: ago(s.lastUsedAt) })}
              </div>
            </div>
            {!s.current && (
              <Button
                size="sm"
                variant="secondary"
                loading={busy === s.id}
                onClick={() => act(s.id, async () => void (await api(`/staff/me/sessions/${s.id}/revoke`, { method: 'POST' })))}
              >
                {t('signOutDevice')}
              </Button>
            )}
          </div>
        ))}
        {!sessions.length && <p className="px-4 py-3 text-sm text-ink-3">{t('sessionsEmpty')}</p>}
      </Card>
      {error && (
        <div className="mt-3">
          <Notice tone="danger">{error}</Notice>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          loading={busy === 'others'}
          disabled={!others}
          onClick={() =>
            act('others', async () => {
              tokens.set(await api<AuthTokens>('/staff/me/sessions/revoke-others', { method: 'POST' }));
            })
          }
        >
          {t('signOutOthers')}
        </Button>
        <span className="text-sm text-ink-3">{t('signOutOthersHint')}</span>
      </div>
    </section>
  );
}

function LoginRow({ row }: { row: Overview['logins'][number] }) {
  const t = useTranslations('admin.profile');
  const dateTime = useDateTime();
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <Chip tone={row.ok ? 'brand' : 'warning'}>{row.ok ? t('loginOk') : row.reason === 'otp' ? t('loginBadCode') : t('loginBadPassword')}</Chip>
      <div className="min-w-40 flex-1 text-sm">
        <div>{device(row.userAgent) ?? t('unknownDevice')}</div>
        <div className="text-ink-3">
          <span dir="ltr">{row.ip ?? '—'}</span> · {dateTime(row.createdAt)}
        </div>
      </div>
    </div>
  );
}
