'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { mediaUrl } from '@/lib/api';
import { Icon } from './icons';
import { cx } from './ui';

/**
 * Tam ekran, tek seferlik fotoğraf görüntüleyici. Tüm fotoğraflar açılışta bir kez yüklenir ve üst üste
 * durur; geçişte yalnızca görünürlük değişir. Kapatınca ya da sayfadan çıkınca `onEnd` çağrılır ve
 * sunucu erişimi hemen kapatır — tekrar görmek yeni izin ister.
 */
export function OneTimePhotoViewer({ urls, name, onEnd }: { urls: string[]; name: string; onEnd: () => void }) {
  const t = useTranslations('match.photo');
  const [i, setI] = useState(0);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onEnd();
    window.addEventListener('keydown', onKey);
    window.addEventListener('pagehide', onEnd);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pagehide', onEnd);
      onEnd();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sayfa katmanlarının (cam yüzeyler, menü çubuğu) üstünde kalsın diye doğrudan <body> altına çizilir.
  return createPortal(
    <div className="fixed inset-0 z-[100] flex select-none flex-col bg-black" role="dialog" aria-modal="true" aria-label={name}>
      <div className="relative z-10 flex items-center justify-between px-3 pt-[max(12px,env(safe-area-inset-top),var(--app-safe-top))]">
        <span className="font-semibold text-white">{name}</span>
        <button type="button" onClick={onEnd} aria-label={t('close')} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white">
          <Icon name="x" size={22} />
        </button>
      </div>
      {urls.length > 1 && (
        <div className="relative z-10 flex gap-1 px-4 pt-3">
          {urls.map((_, j) => (
            <button key={j} type="button" aria-label={`${j + 1}`} onClick={() => setI(j)} className={cx('h-1 flex-1 rounded-full', j === i ? 'bg-white' : 'bg-white/35')} />
          ))}
        </div>
      )}
      <div className="relative flex-1" onClick={() => urls.length > 1 && setI((i + 1) % urls.length)}>
        {urls.map((u, j) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={u}
            src={mediaUrl(u)}
            alt={j === i ? name : ''}
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            className={cx('absolute inset-0 h-full w-full object-contain', j === i ? 'visible' : 'invisible')}
          />
        ))}
      </div>
      <p className="px-4 pb-[max(16px,var(--app-safe-bottom))] pt-3 text-center text-xs text-white/60">{t('onceNote')}</p>
    </div>,
    document.body,
  );
}
