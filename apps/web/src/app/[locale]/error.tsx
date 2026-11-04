'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/icons';

const RELOADED = 'hitaba.chunkReload';

/**
 * Sayfa çökerse Next'in İngilizce beyaz ekranı yerine bu gösterilir. Yeni bir sürüm yayınlandığı
 * sırada eski sayfa artık var olmayan bir parçayı isterse (ChunkLoadError) bir kez kendiliğinden yenilenir.
 */
export default function ErrorScreen({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('screens');
  useEffect(() => {
    console.error(error);
    if (!/ChunkLoadError|Loading chunk|dynamically imported module/i.test(`${error.name} ${error.message}`)) return;
    try {
      if (sessionStorage.getItem(RELOADED)) return;
      sessionStorage.setItem(RELOADED, '1');
    } catch {
      return;
    }
    window.location.reload();
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="glass w-full max-w-sm rounded-card border p-6 text-center">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-accent/40 bg-brand-50 text-accent">
          <Icon name="info" size={26} />
        </span>
        <h1 className="text-2xl font-semibold">{t('errorTitle')}</h1>
        <p className="mt-2 text-ink-2">{t('errorText')}</p>
        <button
          type="button"
          onClick={() => {
            reset();
            window.location.reload();
          }}
          className="glow mt-5 inline-flex h-12 w-full items-center justify-center rounded-control bg-brand-500 font-semibold text-brand-ink"
        >
          {t('reload')}
        </button>
      </div>
    </main>
  );
}
