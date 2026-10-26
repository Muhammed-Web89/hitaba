/**
 * Platform kuralları — tek kaynak. API bunları uygular, web bunları kullanıcıya gösterir.
 * Bkz. docs/00-mimari-tasarim.md §5.
 */
export const RULES = {
  minAge: 18,
  maxAge: 80,
  aboutMinChars: 100,
  aboutMaxChars: 2000,
  maxNikahCount: 20,

  maxPhotos: 3,
  photoViewWindowHours: 24,

  maleDailyFreeLikes: 10,

  maxWitnesses: 2,

  chatOpenCost: 1,
  chatReopenCost: 1,
  messageMaxChars: 2000,
  messageEditWindowMinutes: 15,
  silenceFirstReminderHours: 24,
  silenceSecondReminderHours: 48,
  silenceAutoCloseHours: 72,
  femaleMaxActiveChats: 1,

  reactions: ['👍', '✅', '❤️'] as const,
} as const;

export type Reaction = (typeof RULES.reactions)[number];

export const CONNECT_PACKAGES = [
  { id: 'c1', connects: 1, stars: 150 },
  { id: 'c3', connects: 3, stars: 400 },
  { id: 'c10', connects: 10, stars: 1100 },
] as const;

export type ConnectPackageId = (typeof CONNECT_PACKAGES)[number]['id'];
