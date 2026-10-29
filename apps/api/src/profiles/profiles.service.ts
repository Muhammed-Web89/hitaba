import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
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
import { AiScreenService } from '../moderation/ai-screen.service';
import { ModerationService } from '../moderation/moderation.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PhotosService } from '../photos/photos.service';
import { PrismaService } from '../prisma/prisma.service';

export type UserWithProfile = User & { profile: Profile | null };

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
    };
  }

  async likesLeftToday(user: User): Promise<number | null> {
    if (user.gender === 'FEMALE') return null;
    const used = await this.prisma.like.count({
      where: { fromId: user.id, createdAt: { gte: startOfLocalDay(user.timezone) } },
    });
    return Math.max(0, RULES.maleDailyFreeLikes - used);
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
      childrenCount: p.childrenCount,
      polygamyAnswer: p.polygamyAnswer,
      aboutMe: p.aboutMe,
      aboutSpouse: p.aboutSpouse,
      beliefsManhaj: p.beliefsManhaj,
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

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.profile.update({
        where: { userId: user.id },
        data: { moderationStatus: 'PENDING', submittedAt: new Date() },
      });
      return tx.user.update({ where: { id: user.id }, data: { status: 'PENDING_MODERATION', statusReason: null } });
    });
    await this.enqueueProfile(updated, profile);
    return this.me(updated);
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

  async toPublic(viewer: Pick<User, 'id' | 'role' | 'gender'>, target: UserWithProfile): Promise<PublicProfile> {
    const p = target.profile!;
    const age = p.birthDate ? ageFromBirthDate(p.birthDate) : RULES.minAge;
    const isFemale = target.gender === 'FEMALE';
    const [photoUrls, photoCount, busy, witnessCount, wali] = await Promise.all([
      this.photos.urlsFor(viewer, target.id),
      this.prisma.photo.count({ where: { userId: target.id, status: 'APPROVED' } }),
      isFemale && !p.hideBusyBadge ? this.isBusy(target.id) : Promise.resolve(false),
      isFemale ? this.prisma.witness.count({ where: { femaleId: target.id } }) : Promise.resolve(0),
      isFemale ? this.prisma.waliLink.findUnique({ where: { femaleId: target.id }, select: { id: true } }) : null,
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
      childrenCount: p.childrenCount,
      polygamyAnswer: isFemale ? p.polygamyAnswer : null,
      aboutMe: p.aboutMe ?? '',
      aboutSpouse: p.aboutSpouse ?? '',
      beliefsManhaj: p.beliefsManhaj ?? '',
      photoUrls,
      hasPhoto: photoCount > 0,
      busy,
      witnessCount,
      hasWali: Boolean(wali),
    };
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
        return {
          maritalStatus: v.maritalStatus as Profile['maritalStatus'],
          nikahCount: v.nikahCount as number,
          childrenCount: v.childrenCount as number,
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

  private async enqueueProfile(user: User, profile: Profile) {
    const text = [profile.displayName, profile.aboutMe, profile.aboutSpouse, profile.beliefsManhaj].filter(Boolean).join('\n');
    await this.moderation.enqueue({
      targetType: 'PROFILE',
      targetId: user.id,
      subjectUserId: user.id,
      subjectGender: user.gender,
      aiFlags: this.ai.screenText(text),
    });
  }
}
