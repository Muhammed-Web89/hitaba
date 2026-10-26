'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { RULES, type OwnPhoto } from '@hitaba/shared';
import { api, mediaUrl } from '@/lib/api';
import { useErrorText } from '@/lib/format';
import { Icon } from './icons';
import { Chip, IconButton, Notice, Spinner } from './ui';

export function PhotoManager() {
  const t = useTranslations('photos');
  const errorText = useErrorText();
  const { data: photos, mutate } = useSWR<OwnPhoto[]>('/photos');
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = (photos ?? []).filter((p) => p.status !== 'REJECTED');

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('kind', active.length ? 'EXTRA' : 'MAIN');
    try {
      await api('/photos', { method: 'POST', body: fd });
      await mutate();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setUploading(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        {(photos ?? []).map((p) => (
          <figure key={p.id} className="relative aspect-[3/4] overflow-hidden rounded-card border border-line bg-surface-alt">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mediaUrl(p.url)} alt="" className="h-full w-full object-cover" />
            <figcaption className="absolute inset-x-1 top-1 flex flex-wrap gap-1">
              {p.kind === 'MAIN' && <Chip tone="accent">{t('main')}</Chip>}
              {p.status !== 'APPROVED' && <Chip tone={p.status === 'PENDING' ? 'info' : 'warning'}>{t(`status.${p.status}`)}</Chip>}
            </figcaption>
            <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/60 p-1">
              {p.kind !== 'MAIN' && p.status !== 'REJECTED' && (
                <IconButton
                  icon="star"
                  label={t('makeMain')}
                  size={18}
                  className="h-8 w-8 text-white hover:bg-white/20 hover:text-white"
                  onClick={() => api(`/photos/${p.id}/main`, { method: 'POST' }).then(() => mutate())}
                />
              )}
              <IconButton
                icon="trash"
                label={t('delete')}
                size={18}
                className="h-8 w-8 text-white hover:bg-white/20 hover:text-white"
                onClick={() => api(`/photos/${p.id}`, { method: 'DELETE' }).then(() => mutate())}
              />
            </div>
            {p.status === 'REJECTED' && p.rejectionReason && (
              <p className="absolute inset-x-1 bottom-10 rounded bg-black/70 p-1 text-[11px] text-white">{p.rejectionReason}</p>
            )}
          </figure>
        ))}
        {active.length < RULES.maxPhotos && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={uploading}
            className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-line text-ink-3 hover:border-brand-500 hover:text-brand-500"
          >
            {uploading ? <Spinner /> : <Icon name="camera" size={26} />}
            <span className="text-xs font-semibold">{t('add')}</span>
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      {error && <Notice tone="danger">{error}</Notice>}
      <p className="text-xs text-ink-3">{t('hint', { max: RULES.maxPhotos })}</p>
    </div>
  );
}
