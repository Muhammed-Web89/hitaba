'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import {
  DEFAULT_NATIONALITY,
  MaritalStatus,
  NATIONALITY_CODES,
  PolygamyAnswer,
  PROFILE_STEP_ORDER,
  RULES,
  type OwnProfile,
  type ProfileStepKey,
} from '@hitaba/shared/client';
import { useCatalog } from '@/lib/catalog';
import { detectLocation, guessCountry } from '@/lib/cities';
import { COUNTRY_CODES, LANGUAGE_CODES, useDisplayNames } from '@/lib/format';
import { Icon, type IconName } from './icons';
import { ChoiceChips, CityPicker, HabitTile, InterestGrid, Stepper, ValueSlider } from './pickers';
import { cx, Field, Input, Notice, Select, Spinner, Textarea, Toggle } from './ui';

// Yalnızca ilgili adımda gereken ağır bileşenler ayrı parçada yüklenir.
const PhotoManager = dynamic(() => import('./PhotoManager').then((m) => m.PhotoManager));
const WaliForm = dynamic(() => import('./WaliForm').then((m) => m.WaliForm));

export type WizardStep = ProfileStepKey | 'photos' | 'wali';
export type Draft = Record<string, any>;

export function stepsFor(gender: 'MALE' | 'FEMALE'): WizardStep[] {
  const base = PROFILE_STEP_ORDER.filter((s) => s !== 'rules');
  return [...base, 'photos', ...(gender === 'FEMALE' ? (['wali'] as const) : []), 'rules'];
}

/** Boş alanlar en yaygın seçimle önceden doldurulur (yazma ve dokunma azalır). */
export function draftFrom(p: OwnProfile, gender: 'MALE' | 'FEMALE', locale: string): Draft {
  const country = p.country ?? guessCountry(COUNTRY_CODES);
  return {
    displayName: p.displayName ?? '',
    birthDate: p.birthDate ?? '',
    country,
    city: p.city ?? '',
    nationality: p.nationality ?? DEFAULT_NATIONALITY[country] ?? '',
    languages: p.languages.length ? p.languages : [locale],
    willingToRelocate: p.willingToRelocate,
    heightCm: p.heightCm ?? (gender === 'MALE' ? 175 : 162),
    weightKg: p.weightKg ?? (gender === 'MALE' ? 75 : 58),
    maritalStatus: p.maritalStatus ?? 'NEVER_MARRIED',
    nikahCount: p.nikahCount,
    currentWives: p.currentWives || 1,
    childrenCount: p.childrenCount,
    childrenLivingWith: p.childrenLivingWith,
    polygamyAnswer: p.polygamyAnswer ?? 'PREFER_NOT_TO_SAY',
    aboutMe: p.aboutMe ?? '',
    interests: p.interests ?? [],
    aboutSpouse: p.aboutSpouse ?? '',
    beliefsManhaj: p.beliefsManhaj ?? '',
    prayer: 'ALWAYS',
    alcohol: false,
    smoking: false,
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
        childrenLivingWith: Math.min(Number(d.childrenLivingWith) || 0, Number(d.childrenCount) || 0),
        ...(gender === 'FEMALE' && { polygamyAnswer: d.polygamyAnswer }),
      };
    case 'about':
      return { aboutMe: d.aboutMe, interests: d.interests };
    case 'spouse':
      return { aboutSpouse: d.aboutSpouse };
    case 'beliefs':
      return { beliefsManhaj: d.beliefsManhaj };
    case 'screening':
      return {
        prayer: d.prayer,
        alcohol: d.alcohol,
        smoking: d.smoking,
        drugs: d.drugs,
        relationsOutsideNikah: d.relationsOutsideNikah,
        contagiousDisease: d.contagiousDisease,
        ...(gender === 'FEMALE' && { hijab: d.hijab }),
      };
    case 'rules':
      return { acceptedRules: d.acceptedRules === true };
  }
}

const HABITS = [
  { key: 'alcohol', icon: 'wine' },
  { key: 'smoking', icon: 'cigarette' },
  { key: 'drugs', icon: 'pill' },
  { key: 'relationsOutsideNikah', icon: 'heartCrack' },
  { key: 'contagiousDisease', icon: 'virus' },
] as const;

const MARITAL_ICONS: Record<string, IconName> = { NEVER_MARRIED: 'sparkle', DIVORCED: 'heartCrack', WIDOWED: 'clock', MARRIED: 'ring' };
const POLYGAMY_ICONS: Record<string, IconName> = { YES: 'check', NO: 'x', PREFER_NOT_TO_SAY: 'lock' };

export function StepFields({ step, draft, set, gender }: { step: WizardStep; draft: Draft; set: (p: Draft) => void; gender: 'MALE' | 'FEMALE' }) {
  const t = useTranslations('onboarding.fields');
  const tp = useTranslations('pickers');
  const te = useTranslations('enums');
  const tr = useTranslations('rules');
  const names = useDisplayNames();
  const catalog = useCatalog();
  const [locating, setLocating] = useState(false);
  const [locateFailed, setLocateFailed] = useState(false);
  const [otherNationality, setOtherNationality] = useState(() => !!draft.nationality && !catalog.isNationalityCode(draft.nationality));

  async function locate() {
    setLocating(true);
    setLocateFailed(false);
    const found = await detectLocation();
    setLocating(false);
    if (!found || !(COUNTRY_CODES as readonly string[]).includes(found.country)) return setLocateFailed(true);
    set({ country: found.country, city: found.city || draft.city, ...(!draft.nationality && { nationality: DEFAULT_NATIONALITY[found.country] ?? '' }) });
  }

  // İzin önceden verilmişse konum sessizce doldurulur (yeni izin penceresi açılmaz).
  useEffect(() => {
    if (step !== 'location' || draft.city) return;
    navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((r) => {
        if (r.state === 'granted') void locate();
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

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
          <button
            type="button"
            onClick={locate}
            disabled={locating}
            className="glass glow flex w-full items-center gap-3 rounded-card border border-brand-500/40 p-4 text-start disabled:opacity-60"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-500">
              {locating ? <Spinner size={20} /> : <Icon name="locate" size={22} />}
            </span>
            <span className="min-w-0">
              <span className="block font-semibold">{tp('useMyLocation')}</span>
              <span className="block text-sm text-ink-3">{locateFailed ? tp('locationFailed') : tp('useMyLocationHint')}</span>
            </span>
          </button>
          <Field label={t('country')}>
            <Select value={draft.country} onChange={(e) => set({ country: e.target.value, city: '' })}>
              {names.countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <div>
            <p className="mb-1.5 text-sm font-semibold">{t('city')}</p>
            <CityPicker country={draft.country} value={draft.city} onChange={(city) => set({ city })} />
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">{t('nationality')}</legend>
            <div className="flex flex-wrap gap-2">
              {sortedNationalities(draft.country).map((code) => {
                const on = !otherNationality && draft.nationality === code;
                return (
                  <button
                    key={code}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      setOtherNationality(false);
                      set({ nationality: code });
                    }}
                    className={cx('glow rounded-full border px-3 py-1.5 text-sm font-semibold', on ? 'border-brand-500 bg-brand-500 text-brand-ink' : 'glass')}
                  >
                    {catalog.nationality(code)}
                  </button>
                );
              })}
              <button
                type="button"
                aria-pressed={otherNationality}
                onClick={() => {
                  setOtherNationality(true);
                  set({ nationality: catalog.isNationalityCode(draft.nationality) ? '' : draft.nationality });
                }}
                className={cx('glow inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-semibold', otherNationality ? 'border-brand-500 bg-brand-500 text-brand-ink' : 'glass')}
              >
                <Icon name="plus" size={14} /> {tp('other')}
              </button>
            </div>
            {otherNationality && (
              <Input className="mt-2" autoFocus value={draft.nationality} maxLength={60} placeholder={t('nationalityHint')} onChange={(e) => set({ nationality: e.target.value })} />
            )}
          </fieldset>
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
                    className={cx('glow inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-semibold', on ? 'border-brand-500 bg-brand-500 text-brand-ink' : 'glass')}
                  >
                    {on && <Icon name="check" size={14} />}
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
        <>
          <ValueSlider label={t('height')} icon="ruler" min={120} max={230} unit="cm" value={Number(draft.heightCm)} onChange={(v) => set({ heightCm: v })} />
          <ValueSlider label={t('weight')} icon="scale" min={35} max={200} unit="kg" value={Number(draft.weightKg)} onChange={(v) => set({ weightKg: v })} />
          <p className="text-xs text-ink-3">{t('bodyHint')}</p>
        </>
      );
    case 'family': {
      const children = Number(draft.childrenCount) || 0;
      return (
        <>
          {/* Evli bir kadın nikah arayamaz; "Evli" yalnızca erkeklere sunulur. */}
          <ChoiceChips
            label={t('maritalStatus')}
            value={draft.maritalStatus}
            onChange={(v) => set({ maritalStatus: v })}
            options={Object.values(MaritalStatus)
              .filter((m) => gender === 'MALE' || m !== 'MARRIED')
              .map((m) => ({ value: m, label: te(`marital.${m}`, { gender }), icon: MARITAL_ICONS[m] }))}
          />
          {gender === 'MALE' && draft.maritalStatus === 'MARRIED' && (
            <ChoiceChips
              wide
              label={t('currentWives')}
              value={Number(draft.currentWives)}
              onChange={(v) => set({ currentWives: v })}
              options={Array.from({ length: RULES.maxCurrentWives }, (_, i) => ({ value: i + 1, label: String(i + 1), icon: 'ring' as const }))}
            />
          )}
          <Stepper label={t('nikahCount')} icon="ring" value={Number(draft.nikahCount) || 0} max={RULES.maxNikahCount} onChange={(v) => set({ nikahCount: v })} />
          <Stepper
            label={t('childrenCount')}
            icon="baby"
            value={children}
            max={30}
            onChange={(v) => set({ childrenCount: v, childrenLivingWith: Math.min(Number(draft.childrenLivingWith) || 0, v) })}
          />
          {children > 0 && (
            <Stepper
              label={t('childrenLivingWith')}
              icon="home"
              value={Math.min(Number(draft.childrenLivingWith) || 0, children)}
              max={children}
              onChange={(v) => set({ childrenLivingWith: v })}
            />
          )}
          {gender === 'FEMALE' && (
            <div>
              <ChoiceChips
                label={t('polygamy')}
                value={draft.polygamyAnswer}
                onChange={(v) => set({ polygamyAnswer: v })}
                options={Object.values(PolygamyAnswer).map((p) => ({ value: p, label: te(`polygamy.${p}`), icon: POLYGAMY_ICONS[p] }))}
              />
              <p className="mt-1.5 text-xs text-ink-3">{t('polygamyHint')}</p>
            </div>
          )}
        </>
      );
    }
    case 'about':
    case 'spouse':
    case 'beliefs': {
      const key = step === 'about' ? 'aboutMe' : step === 'spouse' ? 'aboutSpouse' : 'beliefsManhaj';
      const min = step === 'about' ? RULES.aboutMinChars : step === 'spouse' ? RULES.spouseMinChars : RULES.beliefsMinChars;
      const len = (draft[key] as string).trim().length;
      return (
        <>
          <Field
            label={t(key)}
            hint={t(`${key}Hint`)}
            counter={
              <span className={cx('text-xs font-semibold tabular-nums', len < min ? 'text-danger' : 'text-brand-500')} aria-live="polite">
                {len} / {min}+
              </span>
            }
          >
            <Textarea rows={7} maxLength={RULES.aboutMaxChars} value={draft[key]} onChange={(e) => set({ [key]: e.target.value })} />
          </Field>
          {step === 'about' && <InterestGrid value={draft.interests} onChange={(interests) => set({ interests })} />}
        </>
      );
    }
    case 'screening':
      return (
        <>
          <Notice icon="lock">{t('screeningPrivacy')}</Notice>
          <ChoiceChips
            label={t('prayer')}
            value={draft.prayer}
            onChange={(v) => set({ prayer: v })}
            options={(['ALWAYS', 'MOSTLY', 'SOMETIMES', 'NO'] as const).map((p) => ({ value: p, label: te(`prayer.${p}`) }))}
          />
          {gender === 'FEMALE' && (
            <ChoiceChips
              label={t('hijab')}
              value={draft.hijab}
              onChange={(v) => set({ hijab: v })}
              options={(['NIQAB', 'HIJAB', 'PARTIAL', 'NONE'] as const).map((h) => ({ value: h, label: te(`hijab.${h}`), icon: h === 'NONE' ? undefined : ('hijab' as const) }))}
            />
          )}
          <div>
            <p className="mb-2 text-sm font-semibold">{tp('habits')}</p>
            <div className="grid grid-cols-3 gap-2">
              {HABITS.map((h) => (
                <HabitTile key={h.key} icon={h.icon} label={tp(`habit.${h.key}`)} value={!!draft[h.key]} onChange={(v) => set({ [h.key]: v })} />
              ))}
            </div>
          </div>
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
              <li key={r} className="glass glow flex gap-3 rounded-card border p-4">
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

/** Ülkenin varsayılan milliyeti başta, gerisi katalog sırasıyla. */
function sortedNationalities(country: string) {
  const first = DEFAULT_NATIONALITY[country];
  return first ? [first, ...NATIONALITY_CODES.filter((c) => c !== first)] : [...NATIONALITY_CODES];
}
