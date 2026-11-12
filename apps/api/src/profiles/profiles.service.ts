import { createHash } from 'node:crypto';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { env } from '../config/env';
import type { Prisma, Profile, User } from '@prisma/client';
import {
  ageFromBirthDate,
  MODERATED_TEXT_FIELDS,
  PROFILE_STEP_ORDER,
  profileSteps,
  RULES,
  type Me,
  type OwnProfile,
  type ProfileStepKey,
  type PublicProfile,
  type ScreeningAnswers,
} from '@hitaba/shared';
import { decrypt, encrypt } from '../common/crypto';
import { ageRange, startOfLocalDay } from '../common/time';
import { AiScreenService, looksLikeText } from '../moderation/ai-screen.service';
import { ModerationService } from '../moderation/moderation.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PhotosService } from '../photos/photos.service';
import { PrismaService } from '../prisma/prisma.service';

export type UserWithProfile = User & { profile: Profile | null };

/** Anket boş ya da anlamsız doldurulduğunda kullanıcının dilinde otomatik ret gerekçesi — azarlamadan, doldurmaya teşvik eder. */
const THIN_PROFILE_REASON: Record<string, string> = {
  uz: 'Assalomu alaykum! Anketangiz hali toʻliq emas, shuning uchun uni koʻrib chiqa olmadik. Sizni kutayotgan inson aynan anketangiz orqali sizni taniydi 🤍 Ismingiz, yoshingizni koʻrsating va «Oʻzim haqimda» (xarakteringiz, ishingiz, oilangiz, orzularingiz) hamda «Qanday turmush oʻrtoq izlayapman» boʻlimlarini toʻliq gaplar bilan yozing. Samimiy va batafsil anketa — xayrli nikoh sari birinchi qadam. Toʻldirib, qayta yuboring — sizni kutamiz!',
  ru: 'Ассаламу алейкум! Ваша анкета пока не заполнена, поэтому мы не смогли её рассмотреть. Человек, который, возможно, ждёт именно вас, узнаёт вас по анкете 🤍 Укажите имя и возраст и расскажите полными предложениями «О себе» (характер, работа, семья, мечты) и «Кого я ищу». Искренняя и подробная анкета — первый шаг к благословенному никаху. Заполните и отправьте снова — мы ждём вас!',
  tr: 'Esselâmu aleyküm! Profiliniz henüz doldurulmadığı için değerlendiremedik. Sizi bekleyen kişi sizi profilinizden tanıyacak 🤍 Adınızı ve yaşınızı girin; “Hakkımda” (karakteriniz, işiniz, aileniz, hayalleriniz) ve “Aradığım eş” bölümlerini tam cümlelerle yazın. Samimi ve ayrıntılı bir profil, hayırlı bir nikaha atılan ilk adımdır. Doldurup yeniden gönderin, sizi bekliyoruz!',
  en: 'Assalamu alaikum! Your profile isn’t filled in yet, so we couldn’t review it. The person who may be waiting for you will get to know you through your profile 🤍 Add your name and age, and write “About me” (your character, work, family, hopes) and “The spouse I seek” in full sentences. A sincere, detailed profile is the first step towards a blessed nikah. Fill it in and submit again — we’re waiting for you!',
  ar: 'السلام عليكم! ملفك لم يُملأ بعد، لذلك لم نتمكن من مراجعته. الشخص الذي ربما ينتظرك سيتعرّف عليك من خلال ملفك 🤍 أضف اسمك وعمرك، واكتب بجمل كاملة «نبذة عني» (طباعك، عملك، عائلتك، آمالك) و«الشريك الذي أبحث عنه». الملف الصادق المفصّل هو أول خطوة نحو نكاح مبارك. املأه وأرسله من جديد — نحن في انتظارك!',
};

/** Reddedilen anket hiç değiştirilmeden yeniden gönderildiğinde: ilk seferde uyarıyla geri çevrilir, ikincisinde hesap engellenir. */
const UNCHANGED_RESUBMIT_REASON: Record<string, string> = {
  uz: 'Anketingiz hech qanday oʻzgarishsiz qayta yuborildi. Iltimos, avvalgi rad etish sababini oʻqib, anketangizni tuzating. Diqqat: anketa yana oʻzgarishsiz yuborilsa, hisobingiz butunlay bloklanadi.',
  ru: 'Анкета отправлена повторно без каких-либо изменений. Пожалуйста, прочитайте прежнюю причину отказа и исправьте анкету. Внимание: если анкета снова будет отправлена без изменений, аккаунт будет заблокирован навсегда.',
  tr: 'Profiliniz hiçbir değişiklik yapılmadan yeniden gönderildi. Lütfen önceki ret gerekçesini okuyup profilinizi düzeltin. Dikkat: profil yine değiştirilmeden gönderilirse hesabınız kalıcı olarak engellenir.',
  en: 'Your profile was resubmitted without any changes. Please read the previous rejection reason and update your profile. Note: if it is submitted unchanged again, your account will be permanently blocked.',
  ar: 'أُعيد إرسال ملفك دون أي تعديل. من فضلك اقرأ سبب الرفض السابق وعدّل ملفك. تنبيه: إذا أُرسل الملف مرة أخرى دون تعديل فسيُحظر حسابك نهائيًا.',
};
const UNCHANGED_RESUBMIT_LIMIT = 2;

/** Anketin içerik özeti (fotoğraflar hariç); şifreli ön eleme cevapları çözülerek karşılaştırılır. */
function profileHash(p: Profile) {
  const { userId: _u, updatedAt: _t, submittedAt: _s, approvedAt: _a, moderationStatus: _m, rejectedHash: _r, unchangedResubmits: _n, screeningEnc, acceptedRulesAt: _ar, completedSteps: _c, showPhotoInFeed: _f, hideBusyBadge: _b, ...content } = p;
  const screening = screeningEnc ? decrypt(screeningEnc) : null;
  return createHash('sha256').update(JSON.stringify({ ...content, screening })).digest('hex');
}

/** Ad, doğum tarihi ya da iki serbest metinden biri boş/anlamsızsa anket incelemeye değmez. */
function isThinProfile(p: Profile) {
  return !p.displayName?.trim() || !p.birthDate || !looksLikeText(p.aboutMe) || !looksLikeText(p.aboutSpouse);
}

const EDITABLE_STATUSES = new Set(['ONBOARDING', 'PENDING_MODERATION', 'REJECTED', 'APPROVED']);

@Injectable()
export class ProfilesService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly photos: PhotosService,
    private readonly ai: AiScreenService,
    private readonly moderation: ModerationService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    this.moderation.register('PROFILE', {
      apply: async ({ item, approved, reason }) => {
        const user = await this.prisma.user.findUniqueOrThrow({ where: { id: item.subjectUserId } });
        await this.prisma.profile.update({
          where: { userId: user.id },
          data: { moderationStatus: approved ? 'APPROVED' : 'REJECTED', ...(approved && { approvedAt: new Date() }) },
        });
        if (!approved) {
          const p = await this.prisma.profile.findUniqueOrThrow({ where: { userId: user.id } });
          await this.prisma.profile.update({ where: { userId: user.id }, data: { rejectedHash: profileHash(p) } });
        }
        if (user.status === 'BANNED' || user.status === 'FROZEN' || user.status === 'DELETED') return;
        await this.prisma.user.update({
          where: { id: user.id },
          data: { status: approved ? 'APPROVED' : 'REJECTED', statusReason: approved ? null : reason },
        });
        await this.notifications.notify(user.id, approved ? 'profile_approved' : 'profile_rejected', { reason });
      },
      context: async (item) => {
        const user = await this.prisma.user.findUnique({
          where: { id: item.subjectUserId },
          include: { profile: true, _count: { select: { photos: true, reportsAgainst: true } } },
        });
        if (!user?.profile) return null;
        const { screeningEnc, ...profile } = user.profile;
        return {
          user: { id: user.id, gender: user.gender, status: user.status, createdAt: user.createdAt, counts: user._count },
          profile: { ...profile, age: profile.birthDate ? ageFromBirthDate(profile.birthDate) : null },
          screening: screeningEnc ? (JSON.parse(decrypt(screeningEnc)) as ScreeningAnswers) : null,
        };
      },
    });
  }

  async me(user: User): Promise<Me> {
    const profile = await this.prisma.profile.findUnique({ where: { userId: user.id } });
    return {
      id: user.id,
      role: user.role,
      gender: user.gender,
      status: user.status,
      statusReason: user.statusReason,
      email: user.email,
      emailVerified: !user.email || Boolean(user.emailVerifiedAt),
      telegramUsername: user.telegramUsername,
      locale: user.locale,
      timezone: user.timezone,
      connectBalance: user.connectBalance,
      displayName: profile?.displayName ?? null,
      completedSteps: profile?.completedSteps ?? [],
      likesLeftToday: await this.likesLeftToday(user),
      translation: Boolean(env.AZURE_TRANSLATOR_KEY || env.ANTHROPIC_API_KEY),
    };
  }

  async likesLeftToday(user: User): Promise<number | null> {
    const since = startOfLocalDay(user.timezone);
    // Bugün geri alınan beğeniler de sayılır: beğen/geri al döngüsüyle sınır aşılamaz.
    const [likes, withdrawn] = await Promise.all([
      this.prisma.like.count({ where: { fromId: user.id, createdAt: { gte: since } } }),
      this.prisma.likeWithdrawal.count({ where: { userId: user.id, createdAt: { gte: since } } }),
    ]);
    const limit = user.gender === 'FEMALE' ? RULES.femaleDailyLikes : RULES.maleDailyFreeLikes;
    return Math.max(0, limit - likes - withdrawn);
  }

  async own(user: User): Promise<OwnProfile> {
    const p = await this.prisma.profile.findUniqueOrThrow({ where: { userId: user.id } });
    return {
      displayName: p.displayName,
      birthDate: p.birthDate?.toISOString().slice(0, 10) ?? null,
      country: p.country,
      city: p.city,
      nationality: p.nationality,
      languages: p.languages,
      willingToRelocate: p.willingToRelocate,
      heightCm: p.heightCm,
      weightKg: p.weightKg,
      maritalStatus: p.maritalStatus,
      nikahCount: p.nikahCount,
      currentWives: p.currentWives,
      childrenCount: p.childrenCount,
      childrenLivingWith: p.childrenLivingWith,
      polygamyAnswer: p.polygamyAnswer,
      aboutMe: p.aboutMe,
      aboutSpouse: p.aboutSpouse,
      beliefsManhaj: p.beliefsManhaj,
      interests: p.interests,
      hasScreening: Boolean(p.screeningEnc),
      acceptedRules: Boolean(p.acceptedRulesAt),
      completedSteps: p.completedSteps,
      showPhotoInFeed: p.showPhotoInFeed,
      hideBusyBadge: p.hideBusyBadge,
      moderationStatus: p.moderationStatus,
      photos: await this.photos.listOwn(user),
    };
  }

  async saveStep(user: User, step: string, body: unknown): Promise<OwnProfile> {
    if (!EDITABLE_STATUSES.has(user.status)) throw new ForbiddenException({ error: 'profile_locked' });
    if (!(step in profileSteps)) throw new NotFoundException();
    const key = step as ProfileStepKey;
    const parsed = profileSteps[key].safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: 'validation_failed',
        issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }

    const current = await this.prisma.profile.findUniqueOrThrow({ where: { userId: user.id } });
    const data = this.stepToData(user, key, parsed.data);
    const completedSteps = current.completedSteps.includes(key) ? current.completedSteps : [...current.completedSteps, key];

    const textChanged = MODERATED_TEXT_FIELDS.some(
      (f) => f in data && (data as Record<string, unknown>)[f] !== current[f],
    );
    // Yayındaki profilde serbest metin değişirse yeniden moderasyona girer (§5.1).
    const remoderate = textChanged && user.status === 'APPROVED';

    const updated = await this.prisma.profile.update({
      where: { userId: user.id },
      data: { ...data, completedSteps, ...(remoderate && { moderationStatus: 'PENDING' }) },
    });
    const timezone = (parsed.data as { timezone?: string }).timezone;
    if (key === 'location' && timezone) {
      await this.prisma.user.update({ where: { id: user.id }, data: { timezone } });
    }
    if (remoderate) await this.enqueueProfile(user, updated);
    return this.own(user);
  }

  async submit(user: User): Promise<Me> {
    if (user.status !== 'ONBOARDING' && user.status !== 'REJECTED') {
      throw new BadRequestException({ error: 'already_submitted' });
    }
    // E-posta ile kayıt olanlar doğrulamadan incelemeye gönderemez (Telegram kimliği zaten doğrulanmış).
    if (user.email && !user.emailVerifiedAt) throw new BadRequestException({ error: 'email_not_verified' });
    const profile = await this.prisma.profile.findUniqueOrThrow({ where: { userId: user.id } });
    const missing = PROFILE_STEP_ORDER.filter((s) => !profile.completedSteps.includes(s));
    if (missing.length) throw new BadRequestException({ error: 'steps_incomplete', missing });

    const unchanged = user.status === 'REJECTED' && profile.rejectedHash !== null && profile.rejectedHash === profileHash(profile);
    const resubmits = unchanged ? profile.unchangedResubmits + 1 : 0;
    if (resubmits >= UNCHANGED_RESUBMIT_LIMIT) {
      await this.prisma.$transaction([
        this.prisma.profile.update({ where: { userId: user.id }, data: { unchangedResubmits: resubmits } }),
        this.prisma.user.update({
          where: { id: user.id },
          data: { status: 'BANNED', statusReason: 'Anket düzeltilmeden tekrar tekrar gönderildi (otomatik)', tokenVersion: { increment: 1 } },
        }),
      ]);
      await this.moderation.audit(null, 'user.ban', { targetType: 'USER', targetId: user.id }, { auto: 'unchanged_resubmit', resubmits });
      throw new UnauthorizedException({ error: 'account_blocked' });
    }
    if (resubmits !== profile.unchangedResubmits) {
      await this.prisma.profile.update({ where: { userId: user.id }, data: { unchangedResubmits: resubmits } });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.profile.update({
        where: { userId: user.id },
        data: { moderationStatus: 'PENDING', submittedAt: new Date() },
      });
      return tx.user.update({ where: { id: user.id }, data: { status: 'PENDING_MODERATION', statusReason: null } });
    });
    await this.enqueueProfile(updated, profile, unchanged);
    void this.notifications.refreshTelegramStatus(user.id);
    // Anlamsız metin hemen reddedilmiş olabilir: güncel durum döner.
    return this.me(await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } }));
  }

  async updateSettings(
    user: User,
    s: { showPhotoInFeed?: boolean; hideBusyBadge?: boolean; timezone?: string; locale?: string },
  ) {
    const profileData: Prisma.ProfileUpdateInput = {};
    if (s.showPhotoInFeed !== undefined && user.gender === 'MALE') profileData.showPhotoInFeed = s.showPhotoInFeed;
    if (s.hideBusyBadge !== undefined && user.gender === 'FEMALE') profileData.hideBusyBadge = s.hideBusyBadge;
    await this.prisma.profile.update({ where: { userId: user.id }, data: profileData });
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { ...(s.timezone && { timezone: s.timezone }), ...(s.locale && { locale: s.locale }) },
    });
    return this.me(updated);
  }

  /** Başka bir kullanıcının profili; yalnızca karşı cinsten, onaylı kullanıcılar arasında. */
  async publicProfile(viewer: User, userId: string): Promise<PublicProfile> {
    const target = await this.prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
    if (!target || target.status !== 'APPROVED' || target.gender === viewer.gender || target.role !== 'USER') {
      throw new NotFoundException();
    }
    return this.toPublic(viewer, target);
  }

  /**
   * "Profilim nasıl görünüyor": karşı cinsten, henüz eşleşmesi olmayan birinin göreceği hal.
   * Görünürlük o kişiye göre hesaplanır; görünen fotoğraflar sahibinin kendi adına imzalanır
   * (fotoğraf ucu gerçek bir görüntüleyen ister).
   */
  async previewOwn(user: User): Promise<{ profile: PublicProfile; photosVisible: boolean }> {
    const target = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: { profile: true } });
    if (!target.profile) throw new NotFoundException();
    const stranger = { id: 'preview', role: 'USER' as const, gender: user.gender === 'MALE' ? ('FEMALE' as const) : ('MALE' as const) };
    const profile = await this.toPublic(stranger, target);
    const photosVisible = profile.photoUrls.length > 0;
    return { profile: { ...profile, photoUrls: photosVisible ? await this.photos.urlsFor(user, user.id) : [] }, photosVisible };
  }

  async toPublic(viewer: Pick<User, 'id' | 'role' | 'gender'>, target: UserWithProfile): Promise<PublicProfile> {
    const p = target.profile!;
    const age = p.birthDate ? ageFromBirthDate(p.birthDate) : RULES.minAge;
    const isFemale = target.gender === 'FEMALE';
    const [photoUrls, photoCount, busy, witnessCount, wali, favorite] = await Promise.all([
      // Kadının fotoğraf adresi erkeğe profil verisiyle hiç gitmez; yalnızca tek seferlik açılışta verilir.
      isFemale && viewer.role === 'USER' && viewer.gender === 'MALE' ? Promise.resolve([]) : this.photos.urlsFor(viewer, target.id),
      this.prisma.photo.count({ where: { userId: target.id, status: 'APPROVED' } }),
      isFemale && !p.hideBusyBadge ? this.isBusy(target.id) : Promise.resolve(false),
      isFemale ? this.prisma.witness.count({ where: { femaleId: target.id } }) : Promise.resolve(0),
      isFemale ? this.prisma.waliLink.findUnique({ where: { femaleId: target.id }, select: { id: true } }) : null,
      viewer.role === 'USER' ? this.prisma.favorite.findUnique({ where: { userId_targetId: { userId: viewer.id, targetId: target.id } }, select: { userId: true } }) : null,
    ]);
    return {
      userId: target.id,
      gender: target.gender,
      displayName: p.displayName ?? '',
      ageRange: ageRange(age),
      country: p.country ?? '',
      city: p.city ?? '',
      nationality: p.nationality ?? '',
      languages: p.languages,
      willingToRelocate: p.willingToRelocate,
      heightCm: p.heightCm,
      weightKg: p.weightKg,
      maritalStatus: p.maritalStatus ?? 'NEVER_MARRIED',
      nikahCount: p.nikahCount,
      currentWives: p.currentWives,
      childrenCount: p.childrenCount,
      childrenLivingWith: p.childrenLivingWith,
      polygamyAnswer: isFemale ? p.polygamyAnswer : null,
      aboutMe: p.aboutMe ?? '',
      aboutSpouse: p.aboutSpouse ?? '',
      beliefsManhaj: p.beliefsManhaj ?? '',
      interests: p.interests,
      photoUrls,
      hasPhoto: photoCount > 0,
      busy,
      favorited: Boolean(favorite),
      witnessCount,
      hasWali: Boolean(wali),
    };
  }

  /** Tek seferlik görüntüleme için kadının fotoğraf adresleri (erişim PhotosService.canView ile denetlenir). */
  femalePhotoUrls(viewer: User, femaleId: string): Promise<string[]> {
    return this.photos.urlsFor(viewer, femaleId);
  }

  /** Kadının aktif (açık veya duraklatılmış) bir sohbeti var mı. */
  async isBusy(femaleId: string): Promise<boolean> {
    const n = await this.prisma.chat.count({
      where: { status: { in: ['ACTIVE', 'PAUSED'] }, match: { femaleId } },
    });
    return n >= RULES.femaleMaxActiveChats;
  }

  private stepToData(user: User, key: ProfileStepKey, input: Record<string, unknown>): Prisma.ProfileUpdateInput {
    switch (key) {
      case 'basics': {
        const v = input as { displayName: string; birthDate: string };
        return { displayName: v.displayName, birthDate: new Date(v.birthDate + 'T00:00:00Z') };
      }
      case 'family': {
        const v = input as Record<string, unknown>;
        const married = v.maritalStatus === 'MARRIED';
        // Evli bir kadın nikah arayamaz; evli erkek ise mevcut eş sayısını belirtmek zorundadır.
        if (married && user.gender === 'FEMALE') throw new BadRequestException({ error: 'married_female_not_allowed' });
        if (married && !v.currentWives) throw new BadRequestException({ error: 'current_wives_required' });
        const living = (v.childrenLivingWith as number | undefined) ?? 0;
        if (living > (v.childrenCount as number)) throw new BadRequestException({ error: 'children_living_invalid' });
        return {
          maritalStatus: v.maritalStatus as Profile['maritalStatus'],
          nikahCount: v.nikahCount as number,
          currentWives: married ? (v.currentWives as number) : 0,
          childrenCount: v.childrenCount as number,
          childrenLivingWith: living,
          // Çok eşlilik sorusu yalnızca kadına sorulur (§6).
          polygamyAnswer: user.gender === 'FEMALE' ? ((v.polygamyAnswer as Profile['polygamyAnswer']) ?? null) : null,
        };
      }
      case 'location': {
        const { timezone: _tz, ...rest } = input as Record<string, unknown>;
        return rest as Prisma.ProfileUpdateInput;
      }
      case 'screening': {
        const v = { ...(input as ScreeningAnswers) };
        if (user.gender === 'MALE') delete v.hijab;
        return { screeningEnc: encrypt(JSON.stringify(v)) };
      }
      case 'rules':
        return { acceptedRulesAt: new Date() };
      default:
        return input as Prisma.ProfileUpdateInput;
    }
  }

  private async enqueueProfile(user: User, profile: Profile, unchanged = false) {
    const text = [profile.displayName, profile.aboutMe, profile.aboutSpouse, profile.beliefsManhaj].filter(Boolean).join('\n');
    const item = await this.moderation.enqueue({
      targetType: 'PROFILE',
      targetId: user.id,
      subjectUserId: user.id,
      subjectGender: user.gender,
      aiFlags: this.ai.screenText(text),
    });
    if (unchanged) await this.moderation.autoReject(item, UNCHANGED_RESUBMIT_REASON[user.locale] ?? UNCHANGED_RESUBMIT_REASON.en);
    else if (isThinProfile(profile)) await this.moderation.autoReject(item, THIN_PROFILE_REASON[user.locale] ?? THIN_PROFILE_REASON.en);
  }

  /** Kuyrukta bekleyen boş anketleri de geri gönderir (kural öncesi gelenler ya da başka bir yoldan düşenler). */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async sweepThinProfiles() {
    const items = await this.prisma.moderationItem.findMany({ where: { targetType: 'PROFILE', status: 'PENDING' } });
    if (!items.length) return;
    const users = await this.prisma.user.findMany({
      // Yalnızca ilk kez incelemeye gönderilenler; onaylı üyenin düzenlemesi moderatöre kalır.
      where: { id: { in: items.map((i) => i.subjectUserId) }, status: 'PENDING_MODERATION' },
      include: { profile: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    for (const item of items) {
      const u = byId.get(item.subjectUserId);
      if (u?.profile && isThinProfile(u.profile)) {
        await this.moderation.autoReject(item, THIN_PROFILE_REASON[u.locale] ?? THIN_PROFILE_REASON.en);
      }
    }
  }
}
