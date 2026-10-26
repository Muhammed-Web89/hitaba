import { z } from 'zod';
import { Gender, MaritalStatus, PolygamyAnswer, Relation, ReportCategory } from './enums';
import { RULES } from './rules';

const enumOf = <T extends Record<string, string>>(o: T) =>
  z.enum(Object.values(o) as [T[keyof T], ...T[keyof T][]]);

// ── Auth ────────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(128),
  gender: enumOf(Gender),
  locale: z.string().min(2).max(5).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const telegramAuthSchema = z.object({
  initData: z.string().min(1).max(4096),
  /** Yalnızca ilk girişte (hesap yoksa) zorunlu. */
  gender: enumOf(Gender).optional(),
});
export type TelegramAuthInput = z.infer<typeof telegramAuthSchema>;

// ── Profil sihirbazı ──────────────────────────────────────────────────────
// Her adım ayrı kaydedilir (otomatik taslak). Adım anahtarları web ve API'de aynı.

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export function ageFromBirthDate(birthDate: string | Date, now = new Date()): number {
  const d = typeof birthDate === 'string' ? new Date(birthDate + 'T00:00:00Z') : birthDate;
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age--;
  return age;
}

export const profileSteps = {
  basics: z.object({
    displayName: z.string().trim().min(2).max(40),
    birthDate: isoDate.refine((v) => {
      const age = ageFromBirthDate(v);
      return age >= RULES.minAge && age <= RULES.maxAge;
    }, 'age_out_of_range'),
  }),
  location: z.object({
    country: z.string().length(2).toUpperCase(),
    city: z.string().trim().min(1).max(80),
    nationality: z.string().trim().min(2).max(60),
    languages: z.array(z.string().min(2).max(5)).min(1).max(8),
    willingToRelocate: z.boolean(),
    timezone: z.string().max(64).optional(),
  }),
  body: z.object({
    heightCm: z.number().int().min(120).max(230),
    weightKg: z.number().int().min(35).max(250),
  }),
  family: z.object({
    maritalStatus: enumOf(MaritalStatus),
    nikahCount: z.number().int().min(0).max(RULES.maxNikahCount),
    childrenCount: z.number().int().min(0).max(30),
    polygamyAnswer: enumOf(PolygamyAnswer).optional(),
  }),
  about: z.object({
    aboutMe: z.string().trim().min(RULES.aboutMinChars).max(RULES.aboutMaxChars),
  }),
  spouse: z.object({
    aboutSpouse: z.string().trim().min(30).max(RULES.aboutMaxChars),
  }),
  beliefs: z.object({
    beliefsManhaj: z.string().trim().min(30).max(RULES.aboutMaxChars),
  }),
  /** Yalnızca moderatöre görünür, şifreli saklanır. */
  screening: z.object({
    prayer: z.enum(['ALWAYS', 'MOSTLY', 'SOMETIMES', 'NO']),
    alcohol: z.boolean(),
    drugs: z.boolean(),
    relationsOutsideNikah: z.boolean(),
    contagiousDisease: z.boolean(),
    hijab: z.enum(['NIQAB', 'HIJAB', 'PARTIAL', 'NONE']).optional(),
  }),
  rules: z.object({
    acceptedRules: z.literal(true),
  }),
} as const;

export type ProfileStepKey = keyof typeof profileSteps;
export type ProfileStepInput<K extends ProfileStepKey> = z.infer<(typeof profileSteps)[K]>;
export type ScreeningAnswers = ProfileStepInput<'screening'>;

/** Sihirbaz sırası. Kadında ek olarak `wali` adımı vardır (ayrı endpoint). */
export const PROFILE_STEP_ORDER: ProfileStepKey[] = [
  'basics',
  'location',
  'body',
  'family',
  'about',
  'spouse',
  'beliefs',
  'screening',
  'rules',
];

/** Değişince profili yeniden moderasyona sokan serbest metin alanları. */
export const MODERATED_TEXT_FIELDS = ['displayName', 'aboutMe', 'aboutSpouse', 'beliefsManhaj'] as const;

// ── Feed filtreleri ─────────────────────────────────────────────────────

export const feedFilterSchema = z.object({
  countries: z.array(z.string().length(2)).max(30).optional(),
  city: z.string().max(80).optional(),
  nationality: z.string().max(60).optional(),
  language: z.string().max(5).optional(),
  ageMin: z.number().int().min(RULES.minAge).max(RULES.maxAge).optional(),
  ageMax: z.number().int().min(RULES.minAge).max(RULES.maxAge).optional(),
  heightMin: z.number().int().optional(),
  heightMax: z.number().int().optional(),
  willingToRelocate: z.boolean().optional(),
  withPhoto: z.boolean().optional(),
  noChildren: z.boolean().optional(),
  neverMarried: z.boolean().optional(),
  openToPolygamy: z.boolean().optional(),
});
export type FeedFilter = z.infer<typeof feedFilterSchema>;

// ── Veli / şahit ─────────────────────────────────────────────────────────

export const witnessSchema = z.object({
  name: z.string().trim().min(2).max(60),
  relation: enumOf(Relation),
});

export const waliSetupSchema = z.object({
  waliName: z.string().trim().min(2).max(60).optional(),
  waliRelation: enumOf(Relation).optional(),
  witnesses: z.array(witnessSchema).max(RULES.maxWitnesses),
});
export type WaliSetupInput = z.infer<typeof waliSetupSchema>;

export const mahramContactSchema = z.object({
  name: z.string().trim().min(2).max(60),
  relation: enumOf(Relation),
  contact: z.string().trim().min(5).max(120),
  note: z.string().trim().max(300).optional(),
});
export type MahramContactInput = z.infer<typeof mahramContactSchema>;

// ── Sohbet ─────────────────────────────────────────────────────────────

export const sendMessageSchema = z.object({
  chatId: z.string().min(1),
  text: z.string().trim().min(1).max(RULES.messageMaxChars),
  clientId: z.string().max(64).optional(),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const editMessageSchema = z.object({
  text: z.string().trim().min(1).max(RULES.messageMaxChars),
});

export const reactSchema = z.object({
  reaction: z.enum(RULES.reactions).nullable(),
});

// ── Şikâyet ─────────────────────────────────────────────────────────────

export const reportSchema = z.object({
  targetUserId: z.string().min(1),
  chatId: z.string().optional(),
  category: enumOf(ReportCategory),
  details: z.string().trim().max(1000).optional(),
});
export type ReportInput = z.infer<typeof reportSchema>;

// ── Moderasyon kararı ───────────────────────────────────────────────────

export const moderationDecisionSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  /** Kullanıcıya gösterilen gerekçe. Boşsa gerekçe gizlidir (§5.2). */
  reason: z.string().trim().max(500).optional(),
});
export type ModerationDecisionInput = z.infer<typeof moderationDecisionSchema>;
