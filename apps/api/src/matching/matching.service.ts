import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Chat, ChatStatus, Match, Prisma, Profile, User } from '@prisma/client';
import { RULES, type FeedCard, type FeedFilter, type MatchSummary, type PublicProfile } from '@hitaba/shared';
import { hours, startOfLocalDay } from '../common/time';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProfilesService } from '../profiles/profiles.service';

@Injectable()
export class MatchingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfilesService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Feed ──────────────────────────────────────────────────────────────

  async next(viewer: User, filter: FeedFilter): Promise<FeedCard | null> {
    const own = await this.prisma.profile.findUnique({ where: { userId: viewer.id }, select: { polygamyAnswer: true } });
    const where = this.candidateWhere(viewer, filter, own?.polygamyAnswer ?? null);
    const [target, remaining] = await Promise.all([
      this.prisma.user.findFirst({
        where,
        include: { profile: true },
        orderBy: [{ profile: { approvedAt: 'desc' } }, { id: 'asc' }],
        skip: filter.offset ?? 0,
      }),
      this.prisma.user.count({ where }),
    ]);
    if (!target) return null;
    return { profile: await this.profiles.toPublic(viewer, target), remaining: remaining - (filter.offset ?? 0) };
  }

  private candidateWhere(viewer: User, f: FeedFilter, viewerPolygamy: Profile['polygamyAnswer']): Prisma.UserWhereInput {
    const profile: Prisma.ProfileWhereInput = {};
    // Çok eşliliğe "Hayır" diyen kadına evli erkekler hiç gösterilmez.
    if (viewer.gender === 'FEMALE' && viewerPolygamy === 'NO') profile.maritalStatus = { not: 'MARRIED' };
    const now = new Date();
    if (f.countries?.length) profile.country = { in: f.countries.map((c) => c.toUpperCase()) };
    if (f.city) profile.city = { equals: f.city, mode: 'insensitive' };
    if (f.nationality) profile.nationality = { equals: f.nationality, mode: 'insensitive' };
    if (f.language) profile.languages = { has: f.language };
    if (f.ageMin || f.ageMax) {
      profile.birthDate = {
        // ageMax yaşındaki en yaşlı kişi: bugünden (ageMax + 1) yıl önce + 1 gün
        ...(f.ageMax && { gt: new Date(Date.UTC(now.getUTCFullYear() - f.ageMax - 1, now.getUTCMonth(), now.getUTCDate())) }),
        ...(f.ageMin && { lte: new Date(Date.UTC(now.getUTCFullYear() - f.ageMin, now.getUTCMonth(), now.getUTCDate())) }),
      };
    }
    if (f.heightMin || f.heightMax) {
      profile.heightCm = { ...(f.heightMin && { gte: f.heightMin }), ...(f.heightMax && { lte: f.heightMax }) };
    }
    if (f.weightMin || f.weightMax) {
      profile.weightKg = { ...(f.weightMin && { gte: f.weightMin }), ...(f.weightMax && { lte: f.weightMax }) };
    }
    if (f.willingToRelocate) profile.willingToRelocate = true;
    if (f.noChildren) profile.childrenCount = 0;
    if (f.neverMarried) profile.maritalStatus = 'NEVER_MARRIED';
    if (f.openToPolygamy && viewer.gender === 'MALE') profile.polygamyAnswer = 'YES';

    return {
      id: { not: viewer.id },
      role: 'USER',
      status: 'APPROVED',
      gender: viewer.gender === 'MALE' ? 'FEMALE' : 'MALE',
      profile: { is: profile },
      likesReceived: { none: { fromId: viewer.id } },
      passesReceived: { none: { fromId: viewer.id } },
      ...(viewer.gender === 'MALE'
        ? {
            matchesAsFemale: {
              none: {
                OR: [
                  { maleId: viewer.id },
                  // "Sohbette olanları gizle": başka biriyle açık sohbeti olan kadınlar.
                  ...(f.notBusy ? [{ chat: { status: { in: ['ACTIVE', 'PAUSED'] as ChatStatus[] } } }] : []),
                ],
              },
            },
          }
        : { matchesAsMale: { none: { femaleId: viewer.id } } }),
      ...(f.withPhoto && { photos: { some: { status: 'APPROVED' } } }),
    };
  }

  async like(viewer: User, targetId: string) {
    const target = await this.assertCandidate(viewer, targetId);
    if (viewer.gender === 'MALE') {
      const left = await this.profiles.likesLeftToday(viewer);
      if (!left) throw new ForbiddenException({ error: 'daily_like_limit' });
    }

    const alreadyLiked = await this.prisma.like.findUnique({ where: { fromId_toId: { fromId: viewer.id, toId: target.id } } });
    await this.prisma.$transaction([
      this.prisma.pass.deleteMany({ where: { fromId: viewer.id, toId: target.id } }),
      this.prisma.like.upsert({
        where: { fromId_toId: { fromId: viewer.id, toId: target.id } },
        create: { fromId: viewer.id, toId: target.id },
        update: {},
      }),
    ]);

    const reciprocal = await this.prisma.like.findUnique({
      where: { fromId_toId: { fromId: target.id, toId: viewer.id } },
    });
    let matchId: string | null = null;
    if (reciprocal) {
      const [maleId, femaleId] = viewer.gender === 'MALE' ? [viewer.id, target.id] : [target.id, viewer.id];
      const match = await this.prisma.match.upsert({
        where: { maleId_femaleId: { maleId, femaleId } },
        create: { maleId, femaleId },
        update: {},
      });
      matchId = match.id;
      await Promise.all([
        this.notifications.notify(maleId, 'mutual_match', { matchId }),
        // Kadın için karşılıklı ilgi = erkek fotoğrafını görmek istiyor; karar onda.
        this.notifications.notify(femaleId, 'photo_view_first_request', { matchId }),
      ]);
    } else if (!alreadyLiked && !(await this.recentlyNotified(viewer.id, target.id))) {
      // Tek taraflı yeni beğeni: karşı taraf "Beni beğenenler"de görür. Geri alıp yeniden beğenmek
      // 7 gün içinde ikinci bildirim üretmez (bildirim yağmuru olmasın).
      await this.notifications.notify(target.id, 'new_like', { fromId: viewer.id });
    }
    return { mutual: Boolean(reciprocal), matchId, likesLeftToday: await this.profiles.likesLeftToday(viewer) };
  }

  private async recentlyNotified(fromId: string, toId: string): Promise<boolean> {
    const n = await this.prisma.notification.count({
      where: { userId: toId, type: 'new_like', data: { path: ['fromId'], equals: fromId }, createdAt: { gte: new Date(Date.now() - hours(24 * 7)) } },
    });
    return n > 0;
  }

  /** Karşılıksız beğeniyi geri alır. Karşılıklı olmuşsa geri alınamaz (eşleşmede "reddet" kullanılır). */
  async unlike(viewer: User, targetId: string) {
    const like = await this.prisma.like.findUnique({ where: { fromId_toId: { fromId: viewer.id, toId: targetId } } });
    if (!like) throw new NotFoundException();
    const reciprocal = await this.prisma.like.findUnique({ where: { fromId_toId: { fromId: targetId, toId: viewer.id } } });
    if (reciprocal) throw new BadRequestException({ error: 'already_mutual' });
    await this.withdraw(viewer, [like]);
    return { ok: true, likesLeftToday: await this.profiles.likesLeftToday(viewer) };
  }

  /** Tüm karşılıksız beğenilerimi sıfırlar. */
  async resetLikes(viewer: User) {
    const likes = await this.prisma.like.findMany({
      where: { fromId: viewer.id, to: { likesGiven: { none: { toId: viewer.id } } } },
    });
    await this.withdraw(viewer, likes);
    return { removed: likes.length, likesLeftToday: await this.profiles.likesLeftToday(viewer) };
  }

  private async withdraw(viewer: User, likes: { toId: string; createdAt: Date }[]) {
    if (!likes.length) return;
    const today = startOfLocalDay(viewer.timezone);
    const todays = likes.filter((l) => l.createdAt >= today);
    await this.prisma.$transaction([
      this.prisma.like.deleteMany({ where: { fromId: viewer.id, toId: { in: likes.map((l) => l.toId) } } }),
      // Erkeğin bugün harcadığı hak iade edilmez (bkz. ProfilesService.likesLeftToday); eski beğeniler etkilemez.
      ...(viewer.gender === 'MALE' && todays.length ? [this.prisma.likeWithdrawal.createMany({ data: todays.map(() => ({ userId: viewer.id })) })] : []),
    ]);
  }

  async pass(viewer: User, targetId: string) {
    const target = await this.assertCandidate(viewer, targetId);
    await this.prisma.pass.upsert({
      where: { fromId_toId: { fromId: viewer.id, toId: target.id } },
      create: { fromId: viewer.id, toId: target.id },
      update: { createdAt: new Date() },
    });
    return { ok: true };
  }

  /** Tüm geçilen profilleri yeniden feed'e döndürür ("kimse kalmadı" ekranından). */
  async resetPasses(viewer: User) {
    const { count } = await this.prisma.pass.deleteMany({ where: { fromId: viewer.id } });
    return { restored: count };
  }

  /** Son kaçırılan profili geri getirir (son kaçırma ücretsiz — §5.3). */
  async undoPass(viewer: User): Promise<PublicProfile | null> {
    const last = await this.prisma.pass.findFirst({ where: { fromId: viewer.id }, orderBy: { createdAt: 'desc' } });
    if (!last) return null;
    await this.prisma.pass.delete({ where: { fromId_toId: { fromId: last.fromId, toId: last.toId } } });
    const target = await this.prisma.user.findUnique({ where: { id: last.toId }, include: { profile: true } });
    return target?.status === 'APPROVED' ? this.profiles.toPublic(viewer, target) : null;
  }

  async setFavorite(viewer: User, targetId: string, on: boolean) {
    if (on) {
      await this.assertCandidate(viewer, targetId);
      await this.prisma.favorite.upsert({
        where: { userId_targetId: { userId: viewer.id, targetId } },
        create: { userId: viewer.id, targetId },
        update: {},
      });
    } else {
      await this.prisma.favorite.deleteMany({ where: { userId: viewer.id, targetId } });
    }
    return { ok: true };
  }

  async favorites(viewer: User): Promise<PublicProfile[]> {
    const rows = await this.prisma.favorite.findMany({
      where: { userId: viewer.id, target: { status: 'APPROVED' } },
      include: { target: { include: { profile: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(rows.map((r) => this.profiles.toPublic(viewer, r.target)));
  }

  /** Beni beğenenler: henüz karşılık vermediklerim (karşılık verilince "Karşılıklılar"a geçer). */
  async likedMe(viewer: User): Promise<PublicProfile[]> {
    const rows = await this.prisma.like.findMany({
      where: {
        toId: viewer.id,
        from: { role: 'USER', status: 'APPROVED', likesReceived: { none: { fromId: viewer.id } } },
      },
      include: { from: { include: { profile: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return Promise.all(rows.map((r) => this.profiles.toPublic(viewer, r.from)));
  }

  /** Beğendiklerim (henüz karşılıklı olmayan). */
  async myLikes(viewer: User): Promise<PublicProfile[]> {
    const rows = await this.prisma.like.findMany({
      where: {
        fromId: viewer.id,
        to: { status: 'APPROVED', likesGiven: { none: { toId: viewer.id } } },
      },
      include: { to: { include: { profile: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return Promise.all(rows.map((r) => this.profiles.toPublic(viewer, r.to)));
  }

  // ── Eşleşmeler ────────────────────────────────────────────────────────

  async matches(viewer: User): Promise<MatchSummary[]> {
    const rows = await this.prisma.match.findMany({
      where: {
        ...(viewer.gender === 'MALE' ? { maleId: viewer.id } : { femaleId: viewer.id }),
        stage: { not: 'CLOSED' },
      },
      include: { chat: true },
      orderBy: { updatedAt: 'desc' },
    });
    return Promise.all(rows.map((m) => this.summary(viewer, m)));
  }

  async match(viewer: User, id: string): Promise<MatchSummary> {
    return this.summary(viewer, await this.ownMatch(viewer, id));
  }

  /** Kadın, erkeğin fotoğrafını gördükten sonra karar verir; karar kalıcıdır (§5.4). */
  async photoDecision(viewer: User, id: string, approve: boolean) {
    const m = await this.ownMatch(viewer, id);
    if (viewer.gender !== 'FEMALE' || m.stage !== 'MUTUAL') throw new BadRequestException({ error: 'invalid_stage' });
    const now = new Date();
    const updated = await this.prisma.match.update({
      where: { id },
      data: approve
        ? { stage: 'PHOTO_APPROVED', femaleApprovedAt: now, malePhotoViewGranted: true }
        : { stage: 'CLOSED', closedById: viewer.id, closedAt: now },
      include: { chat: true },
    });
    if (approve) await this.notifications.notify(m.maleId, 'photo_approved', { matchId: id });
    return this.summary(viewer, updated);
  }

  // ── Kadın fotoğrafı: istek başına tek seferlik görüntüleme ─────────────

  /**
   * Erkek görme hakkını kullanır. Hak hemen düşer; fotoğraflar yalnızca yüklenme süresi kadar servis edilir
   * ve erkek görüntüleyiciyi kapatınca (closePhoto) erişim o anda biter. Tekrar görmek yeni izin ister.
   */
  async openPhoto(viewer: User, id: string) {
    const m = await this.ownMatch(viewer, id);
    if (viewer.gender !== 'MALE' || m.stage === 'CLOSED' || m.stage === 'MUTUAL') throw new BadRequestException({ error: 'invalid_stage' });
    // Koşullu güncelleme: aynı hak iki kez kullanılamaz.
    const res = await this.prisma.match.updateMany({
      where: { id, malePhotoViewGranted: true },
      data: { malePhotoViewGranted: false, malePhotoAccessUntil: new Date(Date.now() + RULES.photoViewLoadSeconds * 1000) },
    });
    if (res.count === 0) throw new ForbiddenException({ error: 'photo_view_not_granted' });
    const female = await this.prisma.user.findUniqueOrThrow({ where: { id: m.femaleId }, include: { profile: true } });
    return { profile: await this.profiles.toPublic(viewer, female), match: await this.match(viewer, id) };
  }

  /** Görüntüleyici kapandı: erişim hemen biter. */
  async closePhoto(viewer: User, id: string) {
    const m = await this.ownMatch(viewer, id);
    if (viewer.gender === 'MALE' && m.malePhotoAccessUntil) {
      await this.prisma.match.update({ where: { id }, data: { malePhotoAccessUntil: null } });
    }
    return { ok: true };
  }

  /** Erkek fotoğrafı yeniden görmek ister; kadına bildirim gider. */
  async requestPhotoView(viewer: User, id: string) {
    const m = await this.ownMatch(viewer, id);
    if (viewer.gender !== 'MALE' || m.stage === 'CLOSED' || m.stage === 'MUTUAL') throw new BadRequestException({ error: 'invalid_stage' });
    if (m.malePhotoViewGranted) throw new BadRequestException({ error: 'photo_view_already_granted' });
    if (!m.photoViewRequestedAt) {
      await this.prisma.match.update({ where: { id }, data: { photoViewRequestedAt: new Date() } });
      await this.notifications.notify(m.femaleId, 'photo_view_requested', { matchId: id });
    }
    return this.match(viewer, id);
  }

  /** Kadın yeniden görme isteğine karar verir. */
  async decidePhotoView(viewer: User, id: string, approve: boolean) {
    const m = await this.ownMatch(viewer, id);
    if (viewer.gender !== 'FEMALE' || !m.photoViewRequestedAt) throw new BadRequestException({ error: 'invalid_stage' });
    await this.prisma.match.update({ where: { id }, data: { photoViewRequestedAt: null, ...(approve && { malePhotoViewGranted: true }) } });
    await this.notifications.notify(m.maleId, approve ? 'photo_view_granted' : 'photo_view_declined', { matchId: id });
    return this.match(viewer, id);
  }

  /** "Sohbeti başlatmasını iste" — kadın için ücretsiz; erkeğe bildirim gider. */
  async requestChat(viewer: User, id: string) {
    const m = await this.ownMatch(viewer, id);
    if (viewer.gender !== 'FEMALE' || m.stage !== 'PHOTO_APPROVED') throw new BadRequestException({ error: 'invalid_stage' });
    if (m.chatRequestedAt) return this.summary(viewer, m);
    const updated = await this.prisma.match.update({ where: { id }, data: { chatRequestedAt: new Date() }, include: { chat: true } });
    await this.notifications.notify(m.maleId, 'chat_requested', { matchId: id });
    return this.summary(viewer, updated);
  }

  /** Sohbet açılmadan önce iki taraf da eşleşmeyi kapatabilir. */
  async decline(viewer: User, id: string) {
    const m = await this.ownMatch(viewer, id);
    if (m.stage === 'CHAT_OPEN' || m.stage === 'CLOSED') throw new BadRequestException({ error: 'invalid_stage' });
    await this.prisma.match.update({ where: { id }, data: { stage: 'CLOSED', closedById: viewer.id, closedAt: new Date() } });
    return { ok: true };
  }

  async ownMatch(viewer: User, id: string): Promise<Match & { chat: Chat | null }> {
    const m = await this.prisma.match.findUnique({ where: { id }, include: { chat: true } });
    if (!m || (m.maleId !== viewer.id && m.femaleId !== viewer.id)) throw new NotFoundException();
    return m;
  }

  private async summary(viewer: User, m: Match & { chat: Chat | null }): Promise<MatchSummary> {
    const otherId = viewer.id === m.maleId ? m.femaleId : m.maleId;
    const other = await this.prisma.user.findUniqueOrThrow({ where: { id: otherId }, include: { profile: true } });
    const isMale = viewer.gender === 'MALE';
    const femaleBusy = isMale && m.stage === 'PHOTO_APPROVED' ? await this.profiles.isBusy(m.femaleId) : false;
    return {
      id: m.id,
      stage: m.stage,
      other: await this.profiles.toPublic(viewer, other),
      awaitingMyPhotoDecision: !isMale && m.stage === 'MUTUAL',
      photoViewAvailable: isMale && m.malePhotoViewGranted,
      photoViewOpenUntil: isMale && m.malePhotoAccessUntil && m.malePhotoAccessUntil > new Date() ? m.malePhotoAccessUntil.toISOString() : null,
      photoViewRequested: Boolean(m.photoViewRequestedAt),
      chatRequested: Boolean(m.chatRequestedAt),
      chatId: m.chat?.id ?? null,
      chatStatus: m.chat?.status ?? null,
      canOpenChat: isMale && m.stage === 'PHOTO_APPROVED' && !m.chat && !femaleBusy && other.status === 'APPROVED',
      createdAt: m.createdAt.toISOString(),
    };
  }

  private async assertCandidate(viewer: User, targetId: string) {
    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target || target.role !== 'USER' || target.status !== 'APPROVED' || target.gender === viewer.gender) {
      throw new NotFoundException();
    }
    return target;
  }
}
