'use client';

import { useEffect, useState } from 'react';
import type { PublicProfile } from '@hitaba/shared/client';
import { mediaUrl } from '@/lib/api';
import { cx } from './ui';

/**
 * Tek seferlik fotoğraf görüntüleyici: tüm fotoğraflar açılışta bir kez yüklenir ve üst üste durur;
 * geçişte yalnızca görünürlük değişir (sunucu erişimi kapattıktan sonra yeniden indirme gerekmez).
 * Bileşen kaldırıldığında (pencere kapandı, sayfadan çıkıldı) `onEnd` çağrılır.
 */
export function OneTimePhotoViewer({ profile, onEnd }: { profile: PublicProfile; onEnd: () => void }) {
  const [i, setI] = useState(0);
  const urls = profile.photoUrls;

  useEffect(() => {
    window.addEventListener('pagehide', onEnd);
    return () => {
      window.removeEventListener('pagehide', onEnd);
      onEnd();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative aspect-[3/4] w-full select-none overflow-hidden rounded-card bg-surface-alt">
      {urls.map((u, j) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={u}
          src={mediaUrl(u)}
          alt={j === i ? profile.displayName : ''}
          draggable={false}
          onContextMenu={(e) => e.preventDefault()}
          className={cx('absolute inset-0 h-full w-full object-cover', j === i ? 'visible' : 'invisible')}
        />
      ))}
      {urls.length > 1 && (
        <div className="absolute inset-x-3 top-2 flex gap-1">
          {urls.map((_, j) => (
            <button key={j} type="button" aria-label={`${j + 1}`} onClick={() => setI(j)} className={cx('h-1 flex-1 rounded-full', j === i ? 'bg-white' : 'bg-white/40')} />
          ))}
        </div>
      )}
    </div>
  );
}
