'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { NATIONALITY_CODES, type InterestCode } from '@hitaba/shared/client';
import type { IconName } from '@/components/icons';

export const INTEREST_ICONS: Record<InterestCode, IconName> = {
  QURAN: 'bookOpen',
  ISLAMIC_KNOWLEDGE: 'cap',
  ARABIC: 'translate',
  READING: 'book',
  WRITING: 'edit',
  LANGUAGES: 'globe',
  TRAVEL: 'plane',
  NATURE: 'leaf',
  HIKING: 'mountain',
  GARDENING: 'sprout',
  COOKING: 'pot',
  SPORTS: 'ball',
  SWIMMING: 'wave',
  HORSE_RIDING: 'horseshoe',
  ARCHERY: 'target',
  CHARITY: 'gift',
  BUSINESS: 'briefcase',
  TECHNOLOGY: 'laptop',
  CALLIGRAPHY: 'feather',
  CRAFTS: 'scissors',
  HOMEMAKING: 'home',
  ANIMALS: 'paw',
};

const isNationalityCode = (v: string): v is (typeof NATIONALITY_CODES)[number] => (NATIONALITY_CODES as readonly string[]).includes(v);

/** Kodlu seçimlerin görüntüleyenin dilindeki adları. Eski serbest metin milliyetler olduğu gibi gösterilir. */
export function useCatalog() {
  const t = useTranslations('catalog');
  return useMemo(
    () => ({
      interest: (code: string) => (code in INTEREST_ICONS ? t(`interests.${code as InterestCode}`) : code),
      nationality: (v: string) => (isNationalityCode(v) ? t(`nationalities.${v}`) : v),
      isNationalityCode,
    }),
    [t],
  );
}
