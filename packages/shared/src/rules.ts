/**
 * Platform kuralları — tek kaynak. API bunları uygular, web bunları kullanıcıya gösterir.
 * Bkz. docs/00-mimari-tasarim.md §5.
 */
export const RULES = {
  minAge: 18,
  maxAge: 80,
  /** Serbest metin alanlarının en az uzunluğu: kendini anlatma, aradığı kişi, itikad. */
  aboutMinChars: 20,
  spouseMinChars: 20,
  beliefsMinChars: 30,
  aboutMaxChars: 2000,
  maxNikahCount: 20,
  /** Evli erkeğin mevcut eş sayısı (en fazla 4 eşten biri olacağı için 1–3). */
  maxCurrentWives: 3,
  maxInterests: 10,

  maxPhotos: 3,
  /**
   * Tek seferlik görüntüleme: fotoğraflar açılışta bir kez yüklenir, kapatınca erişim hemen biter.
   * Bu süre yalnızca yükleme içindir (uygulama kapatma gibi "kapat" gelmeyen durumlar için üst sınır).
   */
  photoViewLoadSeconds: 60,

  /** Günlük beğeni hakkı; geri alınan beğeni o günün hakkını geri vermez. */
  maleDailyFreeLikes: 15,
  femaleDailyLikes: 5,

  maxWitnesses: 2,

  /** Yeni erkek hesaba ilk sohbet için hediye jeton. */
  welcomeConnects: 1,

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

/** Çok alan daha uygun alır: jeton başı 400 → 350 → 300 Yıldız. */
export const CONNECT_PACKAGES = [
  { id: 'c1', connects: 1, stars: 400 },
  { id: 'c3', connects: 3, stars: 1050 },
  { id: 'c10', connects: 10, stars: 3000 },
] as const;

export type ConnectPackageId = (typeof CONNECT_PACKAGES)[number]['id'];

/**
 * Lansman kampanyası: açıkken bu paket herkese ücretsizdir (%100 indirim). Bitiş tarihi yoktur;
 * kapatmak için `active: false`. Stoklanmasın diye yalnızca bakiyesi 0 olan alabilir.
 */
export const LAUNCH_OFFER = { active: true, packageId: 'c1' } as const satisfies { active: boolean; packageId: ConnectPackageId };

/** Tanışma indirimi: her kullanıcı bu paketi bir kez indirimli fiyatla alabilir (lansman kampanyası kapalıyken). */
export const INTRO_OFFER = { packageId: 'c1', stars: 20 } as const satisfies { packageId: ConnectPackageId; stars: number };

/**
 * Gizlilik politikası / kullanım koşulları sürümü. Metin değiştiğinde artırılır;
 * kullanıcının hangi sürümü onayladığı Consent tablosunda tutulur.
 */
export const POLICY_VERSION = '2026-10-29';

export const EMAIL_VERIFY_TTL_HOURS = 48;
