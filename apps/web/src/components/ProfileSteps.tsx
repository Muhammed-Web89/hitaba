'use client';

import { useTranslations } from 'next-intl';
import { MaritalStatus, PolygamyAnswer, PROFILE_STEP_ORDER, RULES, type OwnProfile, type ProfileStepKey } from '@hitaba/shared';
import { LANGUAGE_CODES, useDisplayNames } from '@/lib/format';
import { Icon } from './icons';
import { PhotoManager } from './PhotoManager';
import { cx, Field, Input, Notice, Select, Textarea, Toggle } from './ui';
import { WaliForm } from './WaliForm';

export type WizardStep = ProfileStepKey | 'photos' | 'wali';
export type Draft = Record<string, any>;

export function stepsFor(gender: 'MALE' | 'FEMALE'): WizardStep[] {
  const base = PROFILE_STEP_ORDER.filter((s) => s !== 'rules');
  return [...base, 'photos', ...(gender === 'FEMALE' ? (['wali'] as const) : []), 'rules'];
}

export function draftFrom(p: OwnProfile): Draft {
  return {
    displayName: p.displayName ?? '',
    birthDate: p.birthDate ?? '',
    country: p.country ?? 'UZ',
    city: p.city ?? '',
    nationality: p.nationality ?? '',
    languages: p.languages.length ? p.languages : [],
    willingToRelocate: p.willingToRelocate,
    heightCm: p.heightCm ?? '',
    weightKg: p.weightKg ?? '',
    maritalStatus: p.maritalStatus ?? 'NEVER_MARRIED',
    nikahCount: p.nikahCount,
    currentWives: p.currentWives || 1,
    childrenCount: p.childrenCount,
    polygamyAnswer: p.polygamyAnswer ?? 'PREFER_NOT_TO_SAY',
    aboutMe: p.aboutMe ?? '',
    aboutSpouse: p.aboutSpouse ?? '',
    beliefsManhaj: p.beliefsManhaj ?? '',
    prayer: 'ALWAYS',
    alcohol: false,
    drugs: false,
    relationsOutsideNikah: false,
    contagiousDisease: false,
    hijab: 'HIJAB',
    acceptedRules: p.acceptedRules,
  };
}

export function payloadFor(step: ProfileStepKey, d: Draft, gender: 'MALE' | 'FEMALE') {
  switch (step) {
    case 'basics':
      return { displayName: d.displayName, birthDate: d.birthDate };
    case 'location':
      return {
        country: d.country,
        city: d.city,
        nationality: d.nationality,
        languages: d.languages,
        willingToRelocate: d.willingToRelocate,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    case 'body':
      return { heightCm: Number(d.heightCm), weightKg: Number(d.weightKg) };
    case 'family':
      return {
        maritalStatus: d.maritalStatus,
        nikahCount: Number(d.nikahCount),
        ...(gender === 'MALE' && d.maritalStatus === 'MARRIED' && { currentWives: Number(d.currentWives) }),
        childrenCount: Number(d.childrenCount),
        ...(gender === 'FEMALE' && { polygamyAnswer: d.polygamyAnswer }),
      };
    case 'about':
      return { aboutMe: d.aboutMe };
    case 'spouse':
      return { aboutSpouse: d.aboutSpouse };
    case 'beliefs':
      return { beliefsManhaj: d.beliefsManhaj };
    case 'screening':
      return {
        prayer: d.prayer,
        alcohol: d.alcohol,
        drugs: d.drugs,
        relationsOutsideNikah: d.relationsOutsideNikah,
        contagiousDisease: d.contagiousDisease,
        ...(gender === 'FEMALE' && { hijab: d.hijab }),
      };
    case 'rules':
      return { acceptedRules: d.acceptedRules === true };
  }
}

export function StepFields({ step, draft, set, gender }: { step: WizardStep; draft: Draft; set: (p: Draft) => void; gender: 'MALE' | 'FEMALE' }) {
  const t = useTranslations('onboarding.fields');
  const te = useTranslations('enums');
  const tr = useTranslations('rules');
  const names = useDisplayNames();

  switch (step) {
    case 'basics': {
      const max = new Date();
      max.setFullYear(max.getFullYear() - RULES.minAge);
      return (
        <>
          <Field label={t('displayName')} hint={t('displayNameHint')}>
            <Input value={draft.displayName} maxLength={40} onChange={(e) => set({ displayName: e.target.value })} />
          </Field>
          <Field label={t('birthDate')} hint={t('birthDateHint')}>
            <Input type="date" value={draft.birthDate} max={max.toISOString().slice(0, 10)} onChange={(e) => set({ birthDate: e.target.value })} />
          </Field>
        </>
      );
    }
    case 'location':
      return (
        <>
          <Field label={t('country')}>
            <Select value={draft.country} onChange={(e) => set({ country: e.target.value })}>
              {names.countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('city')}>
            <Input value={draft.city} maxLength={80} onChange={(e) => set({ city: e.target.value })} />
          </Field>
          <Field label={t('nationality')} hint={t('nationalityHint')}>
            <Input value={draft.nationality} maxLength={60} onChange={(e) => set({ nationality: e.target.value })} />
          </Field>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">{t('languages')}</legend>
            <div className="flex flex-wrap gap-2">
              {LANGUAGE_CODES.map((l) => {
                const on = draft.languages.includes(l);
                return (
                  <button
                    key={l}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set({ languages: on ? draft.languages.filter((x: string) => x !== l) : [...draft.languages, l] })}
                    className={cx('rounded-full border px-3 py-1.5 text-sm font-semibold', on ? 'border-brand-500 bg-brand-500 text-brand-ink' : 'border-line bg-surface')}
                  >
                    {names.language(l)}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <Toggle checked={draft.willingToRelocate} onChange={(v) => set({ willingToRelocate: v })} label={t('relocate')} />
        </>
      );
    case 'body':
      return (
        <div className="grid grid-cols-2 gap-4">
          <Field label={t('height')}>
            <Input type="number" inputMode="numeric" min={120} max={230} value={draft.heightCm} onChange={(e) => set({ heightCm: e.target.value })} />
          </Field>
          <Field label={t('weight')}>
            <Input type="number" inputMode="numeric" min={35} max={250} value={draft.weightKg} onChange={(e) => set({ weightKg: e.target.value })} />
          </Field>
          <p className="col-span-2 text-xs text-ink-3">{t('bodyHint')}</p>
        </div>
      );
    case 'family':
      return (
        <>
          <Field label={t('maritalStatus')}>
            <Select value={draft.maritalStatus} onChange={(e) => set({ maritalStatus: e.target.value })}>
              {/* Evli bir kadın nikah arayamaz; "Evli" yalnızca erkeklere sunulur. */}
              {Object.values(MaritalStatus)
                .filter((m) => gender === 'MALE' || m !== 'MARRIED')
                .map((m) => (
                  <option key={m} value={m}>
                    {te(`marital.${m}`, { gender })}
                  </option>
                ))}
            </Select>
          </Field>
          {gender === 'MALE' && draft.maritalStatus === 'MARRIED' && (
            <Field label={t('currentWives')} hint={t('currentWivesHint')}>
              <Select value={draft.currentWives} onChange={(e) => set({ currentWives: e.target.value })}>
                {Array.from({ length: RULES.maxCurrentWives }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('nikahCount')}>
              <Input type="number" min={0} max={RULES.maxNikahCount} value={draft.nikahCount} onChange={(e) => set({ nikahCount: e.target.value })} />
            </Field>
            <Field label={t('childrenCount')}>
              <Input type="number" min={0} max={30} value={draft.childrenCount} onChange={(e) => set({ childrenCount: e.target.value })} />
            </Field>
          </div>
          {gender === 'FEMALE' && (
            <Field label={t('polygamy')} hint={t('polygamyHint')}>
              <Select value={draft.polygamyAnswer} onChange={(e) => set({ polygamyAnswer: e.target.value })}>
                {Object.values(PolygamyAnswer).map((p) => (
                  <option key={p} value={p}>
                    {te(`polygamy.${p}`)}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </>
      );
    case 'about':
    case 'spouse':
    case 'beliefs': {
      const key = step === 'about' ? 'aboutMe' : step === 'spouse' ? 'aboutSpouse' : 'beliefsManhaj';
      const min = step === 'about' ? RULES.aboutMinChars : 30;
      const len = (draft[key] as string).trim().length;
      return (
        <Field
          label={t(key)}
          hint={t(`${key}Hint`)}
          counter={
            <span className={cx('text-xs font-semibold tabular-nums', len < min ? 'text-danger' : 'text-brand-500')} aria-live="polite">
              {len} / {min}+
            </span>
          }
        >
          <Textarea rows={8} maxLength={RULES.aboutMaxChars} value={draft[key]} onChange={(e) => set({ [key]: e.target.value })} />
        </Field>
      );
    }
    case 'screening':
      return (
        <>
          <Notice icon="lock">{t('screeningPrivacy')}</Notice>
          <Field label={t('prayer')}>
            <Select value={draft.prayer} onChange={(e) => set({ prayer: e.target.value })}>
              {(['ALWAYS', 'MOSTLY', 'SOMETIMES', 'NO'] as const).map((p) => (
                <option key={p} value={p}>
                  {te(`prayer.${p}`)}
                </option>
              ))}
            </Select>
          </Field>
          {gender === 'FEMALE' && (
            <Field label={t('hijab')}>
              <Select value={draft.hijab} onChange={(e) => set({ hijab: e.target.value })}>
                {(['NIQAB', 'HIJAB', 'PARTIAL', 'NONE'] as const).map((h) => (
                  <option key={h} value={h}>
                    {te(`hijab.${h}`)}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {(['alcohol', 'drugs', 'relationsOutsideNikah', 'contagiousDisease'] as const).map((k) => (
            <Toggle key={k} checked={draft[k]} onChange={(v) => set({ [k]: v })} label={t(k)} />
          ))}
        </>
      );
    case 'photos':
      return (
        <>
          <Notice icon="eye">{t(gender === 'FEMALE' ? 'photosFemale' : 'photosMale')}</Notice>
          <PhotoManager />
        </>
      );
    case 'wali':
      return <WaliForm />;
    case 'rules':
      return (
        <>
          <ul className="space-y-3">
            {(['niyyah', 'witnesses', 'contact', 'photos', 'respect', 'honesty'] as const).map((r) => (
              <li key={r} className="flex gap-3 rounded-card border border-line bg-surface p-4">
                <Icon name="check" className="mt-0.5 shrink-0 text-brand-500" />
                <span className="text-[15px]">{tr(r)}</span>
              </li>
            ))}
          </ul>
          <label className="flex items-start gap-3 rounded-card bg-brand-50 p-4">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 accent-[var(--brand-500)]"
              checked={draft.acceptedRules}
              onChange={(e) => set({ acceptedRules: e.target.checked })}
            />
            <span className="font-semibold">{t('acceptRules')}</span>
          </label>
        </>
      );
  }
}
