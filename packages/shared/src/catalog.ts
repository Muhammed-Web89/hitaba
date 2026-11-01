/**
 * Seçmeli profil alanlarının kodları. Kod saklanır, ad her dilde arayüzde çevrilir
 * (apps/web/src/messages/*.json → catalog.*). Sıra, ekrandaki sıradır (en yaygın önce).
 */

export const INTEREST_CODES = [
  'QURAN', 'ISLAMIC_KNOWLEDGE', 'ARABIC', 'READING', 'WRITING', 'LANGUAGES', 'TRAVEL', 'NATURE', 'HIKING',
  'GARDENING', 'COOKING', 'SPORTS', 'SWIMMING', 'HORSE_RIDING', 'ARCHERY', 'CHARITY', 'BUSINESS', 'TECHNOLOGY',
  'CALLIGRAPHY', 'CRAFTS', 'HOMEMAKING', 'ANIMALS',
] as const;
export type InterestCode = (typeof INTEREST_CODES)[number];

/** Milliyet (etnik köken) kodları; listede olmayan için serbest metin kabul edilir. */
export const NATIONALITY_CODES = [
  'UZBEK', 'TAJIK', 'KAZAKH', 'KYRGYZ', 'TURKMEN', 'KARAKALPAK', 'UYGHUR', 'TATAR', 'BASHKIR', 'AZERBAIJANI',
  'TURKISH', 'RUSSIAN', 'CHECHEN', 'DAGESTANI', 'ARAB', 'AFGHAN', 'PERSIAN', 'KURDISH', 'PAKISTANI', 'INDIAN',
  'BENGALI', 'MALAY', 'INDONESIAN',
] as const;
export type NationalityCode = (typeof NATIONALITY_CODES)[number];

/** Ülkeye göre en olası milliyet (ön seçim için). */
export const DEFAULT_NATIONALITY: Partial<Record<string, NationalityCode>> = {
  UZ: 'UZBEK', TJ: 'TAJIK', KZ: 'KAZAKH', KG: 'KYRGYZ', TM: 'TURKMEN', AZ: 'AZERBAIJANI', TR: 'TURKISH',
  RU: 'RUSSIAN', AF: 'AFGHAN', PK: 'PAKISTANI', IN: 'INDIAN', BD: 'BENGALI', MY: 'MALAY', ID: 'INDONESIAN',
  SA: 'ARAB', AE: 'ARAB', QA: 'ARAB', KW: 'ARAB', BH: 'ARAB', OM: 'ARAB', EG: 'ARAB', JO: 'ARAB', MA: 'ARAB',
  DZ: 'ARAB', TN: 'ARAB',
};
