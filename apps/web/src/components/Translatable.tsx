'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { Icon } from './icons';

/**
 * Kullanıcıların yazdığı metinler, uygulamada seçilen dile (cihaz dili değil) otomatik çevrilir.
 * Çeviri sunucuda saklanır; aynı metin aynı dile bir kez çevrilir.
 */

/** Profilin üç serbest metni tek istekte, görüntüleyenin dilinde. */
export function useProfileTranslation(userId: string, enabled: boolean) {
  const locale = useLocale();
  const { data } = useSWR(
    enabled ? [`/translate/profile/${userId}`, locale] : null,
    ([path, lang]: [string, string]) => api<Record<string, string>>(path, { method: 'POST', body: { lang } }),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );
  return data;
}

const same = (a: string, b: string) => a.trim() === b.trim();

/** Çevrilmiş metni gösterir; "Aslını göster" ile asıl metne dönülür. Çeviri asılla aynıysa hiçbir şey eklenmez. */
export function AutoTranslatedText({ text, translated, className }: { text: string; translated?: string; className?: string }) {
  const [original, setOriginal] = useState(false);
  const differs = Boolean(translated) && !same(translated!, text);
  return (
    <>
      <p className={className}>{differs && !original ? translated : text}</p>
      {differs && <TranslationNote original={original} onToggle={() => setOriginal(!original)} className="mt-2" />}
    </>
  );
}

export function TranslationNote({ original, onToggle, className = '' }: { original: boolean; onToggle: () => void; className?: string }) {
  const t = useTranslations('translate');
  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 text-xs ${className}`}>
      <Icon name="translate" size={13} className="text-brand-500" />
      <span className="text-ink-3">{original ? t('originalNote') : t('note')}</span>
      <span className="text-ink-3" aria-hidden="true">
        ·
      </span>
      <button type="button" onClick={onToggle} className="font-semibold text-brand-500">
        {original ? t('showTranslation') : t('original')}
      </button>
    </span>
  );
}

/** Sohbet balonu: çeviri varsa çeviriyi, dokununca aslını gösterir. */
export function TranslatedBubbleText({ text, translated }: { text: string; translated: string }) {
  const [original, setOriginal] = useState(false);
  if (same(text, translated)) return <span className="whitespace-pre-wrap break-words">{text}</span>;
  return (
    <>
      <span className="whitespace-pre-wrap break-words">{original ? text : translated}</span>
      <span className="mt-1 block">
        <TranslationNote original={original} onToggle={() => setOriginal(!original)} />
      </span>
    </>
  );
}
