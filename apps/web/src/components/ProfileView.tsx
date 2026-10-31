'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { PublicProfile } from '@hitaba/shared';
import { mediaUrl } from '@/lib/api';
import { useDisplayNames } from '@/lib/format';
import { Icon } from './icons';
import { Chip, cx } from './ui';

/** Fotoğraf yoksa ya da görüntüleme izni yoksa nötr silüet gösterilir (§8.4). */
export function PhotoFrame({ profile, className }: { profile: PublicProfile; className?: string }) {
  const t = useTranslations('profile');
  const [i, setI] = useState(0);
  const urls = profile.photoUrls;
  return (
    <div className={cx('relative overflow-hidden bg-surface-alt', className)}>
      {urls.length ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaUrl(urls[i % urls.length])}
            alt={profile.displayName}
            className="h-full w-full select-none object-cover"
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
          />
          {urls.length > 1 && (
            <div className="absolute inset-x-3 top-2 flex gap-1">
              {urls.map((_, j) => (
                <button key={j} type="button" aria-label={`${j + 1}`} onClick={() => setI(j)} className={cx('h-1 flex-1 rounded-full', j === i ? 'bg-white' : 'bg-white/40')} />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-ink-3">
          <svg viewBox="0 0 100 100" className="h-24 w-24 opacity-50" aria-hidden="true">
            <circle cx="50" cy="36" r="18" fill="currentColor" />
            <path d="M14 96c2-22 17-34 36-34s34 12 36 34Z" fill="currentColor" />
          </svg>
          <span className="max-w-[80%] text-center text-xs font-semibold">
            {profile.hasPhoto ? t(profile.gender === 'FEMALE' ? 'photoHiddenFemale' : 'photoHiddenMale') : t('noPhoto')}
          </span>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <dt className="text-ink-3">{label}</dt>
      <dd className="text-end font-semibold">{children}</dd>
    </div>
  );
}

export function ProfileHeadline({ profile }: { profile: PublicProfile }) {
  const names = useDisplayNames();
  const t = useTranslations('profile');
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-2xl font-semibold">{profile.displayName}</h2>
        {profile.busy && (
          <Chip tone="warning">
            <Icon name="chat" size={12} /> {t('busy')}
          </Chip>
        )}
      </div>
      <p className="mt-0.5 text-ink-2">
        {t('ageRange', { range: profile.ageRange })} · {profile.city}, {names.country(profile.country)}
      </p>
    </div>
  );
}

export function ProfileDetails({ profile }: { profile: PublicProfile }) {
  const t = useTranslations('profile');
  const te = useTranslations('enums');
  const names = useDisplayNames();
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5">
        <Chip tone={profile.currentWives ? 'warning' : 'brand'}>
          {te(`marital.${profile.maritalStatus}`, { gender: profile.gender })}
          {profile.currentWives > 0 && ` · ${t('currentWivesChip', { n: profile.currentWives })}`}
        </Chip>
        {profile.childrenCount === 0 ? (
          <Chip>{t('noChildren')}</Chip>
        ) : (
          <Chip>
            {t('children', { n: profile.childrenCount })} ·{' '}
            {profile.childrenLivingWith === profile.childrenCount
              ? t('childrenLivingAll')
              : profile.childrenLivingWith === 0
                ? t('childrenLivingNone')
                : t('childrenLivingSome', { n: profile.childrenLivingWith })}
          </Chip>
        )}
        {profile.willingToRelocate && <Chip tone="info">{t('relocate')}</Chip>}
        {profile.gender === 'FEMALE' && profile.witnessCount > 0 && (
          <Chip tone="accent">
            <Icon name="users" size={12} /> {t('witnesses', { n: profile.witnessCount })}
          </Chip>
        )}
        {profile.hasWali && (
          <Chip tone="accent">
            <Icon name="shield" size={12} /> {t('wali')}
          </Chip>
        )}
      </div>

      <section>
        <h3 className="mb-1 text-sm font-bold uppercase tracking-wider text-ink-3">{t('aboutMe')}</h3>
        <p className="whitespace-pre-line text-[15px] leading-relaxed">{profile.aboutMe}</p>
      </section>
      <section>
        <h3 className="mb-1 text-sm font-bold uppercase tracking-wider text-ink-3">{t('aboutSpouse')}</h3>
        <p className="whitespace-pre-line text-[15px] leading-relaxed">{profile.aboutSpouse}</p>
      </section>
      <section>
        <h3 className="mb-1 text-sm font-bold uppercase tracking-wider text-ink-3">{t('beliefs')}</h3>
        <p className="whitespace-pre-line text-[15px] leading-relaxed">{profile.beliefsManhaj}</p>
      </section>

      <dl className="divide-y divide-line rounded-card border border-line bg-surface px-4">
        <Row label={t('nationality')}>{profile.nationality}</Row>
        <Row label={t('languages')}>{profile.languages.map(names.language).join(', ')}</Row>
        {profile.heightCm && <Row label={t('height')}>{profile.heightCm} cm</Row>}
        {profile.weightKg && <Row label={t('weight')}>~{profile.weightKg} kg</Row>}
        {profile.currentWives > 0 && <Row label={t('currentWives')}>{profile.currentWives}</Row>}
        <Row label={t('nikahCount')}>{profile.nikahCount}</Row>
        {profile.polygamyAnswer && <Row label={t('polygamy')}>{te(`polygamy.${profile.polygamyAnswer}`)}</Row>}
      </dl>
    </div>
  );
}
