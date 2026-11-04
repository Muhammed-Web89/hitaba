'use client';

import { useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useErrorText } from '@/lib/format';
import { Icon } from './icons';

/** Kullanıcının yazdığı metni isteğe bağlı olarak görüntüleyenin diline çevirir; asıl metne dönülebilir. */
export function useTranslation(path: string) {
  const locale = useLocale();
  const errorText = useErrorText();
  const [translated, setTranslated] = useState<string | null>(null);
  const [showing, setShowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (showing) return setShowing(false);
    if (translated !== null) return setShowing(true);
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ text: string }>(path, { method: 'POST', body: { lang: locale } });
      setTranslated(res.text);
      setShowing(true);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return { translated: showing ? translated : null, showing, busy, error, toggle };
}

export function TranslateButton({ showing, busy, error, onClick, className = '' }: { showing: boolean; busy: boolean; error: string | null; onClick: () => void; className?: string }) {
  const t = useTranslations('translate');
  return (
    <span className={`inline-flex flex-wrap items-center gap-2 text-xs ${className}`}>
      <button type="button" onClick={onClick} disabled={busy} className="inline-flex items-center gap-1 font-semibold text-brand-500 disabled:opacity-60">
        <Icon name="translate" size={14} />
        {busy ? t('busy') : showing ? t('original') : t('translate')}
      </button>
      {showing && <span className="text-ink-3">{t('note')}</span>}
      {error && <span className="text-danger">{error}</span>}
    </span>
  );
}

/** Profildeki serbest metin + çeviri bağlantısı. `path` yoksa yalnızca metin gösterilir. */
export function TranslatableText({ text, path, className }: { text: string; path?: string; className?: string }): ReactNode {
  const tr = useTranslation(path ?? '');
  return (
    <>
      <p className={className}>{tr.translated ?? text}</p>
      {path && <TranslateButton className="mt-2" showing={tr.showing} busy={tr.busy} error={tr.error} onClick={tr.toggle} />}
    </>
  );
}
