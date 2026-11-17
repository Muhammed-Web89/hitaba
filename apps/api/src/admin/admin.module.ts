import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import type { ChatStatus, Gender, ReportStatus, User } from '@prisma/client';
import { z } from 'zod';
import { ageFromBirthDate, reportSchema, type ReportInput } from '@hitaba/shared';
import { CurrentUser, Roles } from '../auth/guards';
import { ChatModule } from '../chat/chat.module';
import { ChatService } from '../chat/chat.service';
import { decrypt } from '../common/crypto';
import { ZodPipe } from '../common/zod.pipe';
import { ConnectsService } from '../connects/connects.service';
import { ModerationService } from '../moderation/moderation.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PhotosModule } from '../photos/photos.module';
import { PhotosService } from '../photos/photos.service';
import { PrismaService } from '../prisma/prisma.service';

const reasonSchema = z.object({ reason: z.string().trim().min(3).max(500) });
const genderSchema = z.object({ gender: z.enum(['MALE', 'FEMALE']) });
const replySchema = z.object({ text: z.string().trim().min(2).max(1000) });
const resolveSchema = z.object({
  status: z.enum(['RESOLVED', 'DISMISSED']),
  resolution: z.string().trim().max(1000).optional(),
});

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chats: ChatService,
    private readonly connects: ConnectsService,
    private readonly moderation: ModerationService,
    private readonly photos: PhotosService,
    private readonly notifications: NotificationsService,
  ) {}

  async report(reporter: User, input: ReportInput) {
    if (input.targetUserId === reporter.id) throw new BadRequestException();
    const target = await this.prisma.user.findUnique({ where: { id: input.targetUserId } });
    if (!target) throw new NotFoundException();
    const r = await this.prisma.report.create({ data: { reporterId: reporter.id, ...input } });
    return { id: r.id };
  }

  reports(status: ReportStatus = 'OPEN') {
    return this.prisma.report.findMany({
      where: { status },
      // Çocuk güvenliği şikâyetleri her zaman en üstte (§5.13).
      orderBy: [{ createdAt: 'asc' }],
      include: {
        reporter: { select: { id: true, gender: true, profile: { select: { displayName: true } } } },
        targetUser: { select: { id: true, gender: true, status: true, profile: { select: { displayName: true } } } },
      },
      take: 200,
    }).then((rows) => rows.sort((a, b) => Number(b.category === 'MINOR') - Number(a.category === 'MINOR')));
  }

  async resolveReport(mod: User, id: string, body: z.infer<typeof resolveSchema>) {
    const r = await this.prisma.report.update({
      where: { id },
      data: { status: body.status, resolution: body.resolution ?? null, resolvedById: mod.id, resolvedAt: new Date() },
    });
    await this.moderation.audit(mod.id, `report.${body.status.toLowerCase()}`, { targetType: 'REPORT', targetId: id });
    return r;
  }

  /** Şikâyet edene moderatör yanıtı: uygulama bildirimi + Telegram. Yanıtlar şikâyette saklanır. */
  async replyReport(mod: User, id: string, text: string) {
    const r = await this.prisma.report.findUnique({ where: { id } });
    if (!r) throw new NotFoundException();
    const updated = await this.prisma.report.update({
      where: { id },
      data: { resolution: r.resolution ? `${r.resolution}\n\n${text}` : text },
    });
    await this.notifications.notify(r.reporterId, 'report_reply', { reportId: id, reason: text });
    await this.moderation.audit(mod.id, 'report.reply', { targetType: 'REPORT', targetId: id });
    return updated;
  }

  async users(viewer: User, q?: string, gender?: Gender) {
    const term = q?.trim();
    const users = await this.prisma.user.findMany({
      where: {
        ...(gender && { gender }),
        ...(term && {
          OR: [
            { id: term },
            { email: { contains: term, mode: 'insensitive' } },
            { telegramUsername: { contains: term.replace(/^@/, ''), mode: 'insensitive' } },
            { profile: { displayName: { contains: term, mode: 'insensitive' } } },
          ],
        }),
      },
      select: {
        id: true,
        role: true,
        gender: true,
        status: true,
        email: true,
        telegramUsername: true,
        connectBalance: true,
        createdAt: true,
        profile: { select: { displayName: true, country: true, city: true } },
        _count: { select: { reportsAgainst: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    if (viewer.role !== 'ADMIN') return users;

    // Yalnızca yönetici: profili son onaylayan/reddeden personel (moderatörler birbirinin kararını görmez).
    const decisions = await this.prisma.moderationItem.findMany({
      where: { targetType: 'PROFILE', subjectUserId: { in: users.map((u) => u.id) }, status: { in: ['APPROVED', 'REJECTED'] }, decidedById: { not: null } },
      orderBy: { decidedAt: 'desc' },
      select: { subjectUserId: true, status: true, decidedById: true, decidedAt: true },
    });
    const latest = new Map<string, (typeof decisions)[number]>();
    for (const d of decisions) if (!latest.has(d.subjectUserId)) latest.set(d.subjectUserId, d);
    const staff = await this.prisma.user.findMany({
      where: { id: { in: [...new Set([...latest.values()].map((d) => d.decidedById!))] } },
      select: { id: true, role: true, gender: true, email: true, profile: { select: { displayName: true } } },
    });
    const byId = new Map(staff.map((m) => [m.id, m]));
    return users.map((u) => {
      const d = latest.get(u.id);
      const m = d && byId.get(d.decidedById!);
      return {
        ...u,
        decidedBy: m
          ? { status: d!.status, at: d!.decidedAt, role: m.role, gender: m.gender, name: m.email?.split('@')[0] ?? m.profile?.displayName ?? '—' }
          : null,
      };
    });
  }

  async user(mod: User, id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
        reportsAgainst: { orderBy: { createdAt: 'desc' }, take: 20 },
        connectTxs: { orderBy: { createdAt: 'desc' }, take: 20 },
        _count: { select: { likesGiven: true, likesReceived: true, matchesAsMale: true, matchesAsFemale: true } },
      },
    });
    if (!user) throw new NotFoundException();
    await this.moderation.audit(mod.id, 'user.view', { targetType: 'USER', targetId: id });
    const { passwordHash: _pw, profile, ...safe } = user;
    const photos = await this.photos.forStaff(mod, id);
    if (!profile) return { ...safe, profile: null, screening: null, photos };
    const { screeningEnc, ...rest } = profile;
    return {
      ...safe,
      photos,
      profile: { ...rest, age: rest.birthDate ? ageFromBirthDate(rest.birthDate) : null },
      screening: screeningEnc ? JSON.parse(decrypt(screeningEnc)) : null,
    };
  }

  /** Ban: tüm oturumlar kapanır, bakiye sıfırlanır, açık sohbetler kapanır (karşı tarafa iade). */
  async ban(mod: User, id: string, reason: string) {
    const target = await this.assertTargetable(mod, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: target.id },
        data: { status: 'BANNED', statusReason: reason, tokenVersion: { increment: 1 } },
      });
      await this.connects.zeroOut(tx, target.id);
    });
    await this.chats.closeAllForBan(target.id, mod.id);
    await this.moderation.audit(mod.id, 'user.ban', { targetType: 'USER', targetId: id }, { reason });
    return { ok: true };
  }

  async freeze(mod: User, id: string, frozen: boolean, reason?: string) {
    const target = await this.assertTargetable(mod, id);
    if (frozen && target.status !== 'APPROVED') throw new BadRequestException({ error: 'not_approved' });
    if (!frozen && target.status !== 'FROZEN') throw new BadRequestException({ error: 'not_frozen' });
    await this.prisma.user.update({
      where: { id },
      data: { status: frozen ? 'FROZEN' : 'APPROVED', statusReason: frozen ? (reason ?? null) : null },
    });
    await this.moderation.audit(mod.id, frozen ? 'user.freeze' : 'user.unfreeze', { targetType: 'USER', targetId: id }, { reason });
    return { ok: true };
  }

  /**
   * Kayıtta yanlış seçilen cinsiyeti düzelt. Yalnızca beğeni/eşleşme geçmişi olmayan hesapta (karşı cinse göre
   * kurulmuş ilişkiler bozulmasın). Erkekten kadına geçişte hoş geldin jetonu sıfırlanır; oturumlar yenilenir.
   */
  async changeGender(mod: User, id: string, gender: Gender) {
    const target = await this.assertTargetable(mod, id);
    if (target.role !== 'USER' || target.gender === gender) throw new BadRequestException({ error: 'invalid_gender_change' });
    const [likes, matches] = await Promise.all([
      this.prisma.like.count({ where: { OR: [{ fromId: id }, { toId: id }] } }),
      this.prisma.match.count({ where: { OR: [{ maleId: id }, { femaleId: id }] } }),
    ]);
    if (likes || matches) throw new BadRequestException({ error: 'gender_change_blocked' });
    await this.prisma.$transaction(async (tx) => {
      if (gender === 'FEMALE') await this.connects.zeroOut(tx, id);
      await tx.user.update({ where: { id }, data: { gender, tokenVersion: { increment: 1 } } });
      await tx.moderationItem.updateMany({ where: { subjectUserId: id, status: 'PENDING' }, data: { subjectGender: gender } });
    });
    await this.moderation.audit(mod.id, 'user.gender', { targetType: 'USER', targetId: id }, { from: target.gender, to: gender });
    return { ok: true };
  }

  chatsList(status: ChatStatus = 'ACTIVE') {
    return this.prisma.chat.findMany({
      where: { status },
      orderBy: { lastActivityAt: 'desc' },
      take: 100,
      include: {
        match: {
          select: {
            male: { select: { id: true, profile: { select: { displayName: true } } } },
            female: { select: { id: true, profile: { select: { displayName: true } } } },
          },
        },
        _count: { select: { messages: true } },
      },
    });
  }

  async chat(mod: User, id: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id },
      include: {
        match: {
          include: {
            male: { select: { id: true, status: true, profile: { select: { displayName: true } } } },
            female: { select: { id: true, status: true, profile: { select: { displayName: true } } } },
          },
        },
      },
    });
    if (!chat) throw new NotFoundException();
    return { chat, messages: await this.chats.transcriptForModerator(mod, id) };
  }

  async closeChat(mod: User, id: string, reason: string) {
    const chat = await this.prisma.chat.findUnique({ where: { id }, include: { match: true } });
    if (!chat) throw new NotFoundException();
    if (chat.status === 'CLOSED') throw new BadRequestException({ error: 'already_closed' });
    await this.chats.close(chat, 'MODERATOR', mod.id, true);
    await this.moderation.audit(mod.id, 'chat.close', { targetType: 'CHAT', targetId: id }, { reason });
    return { ok: true };
  }

  async stats() {
    const [byStatus, pendingModeration, openReports, activeChats] = await Promise.all([
      this.prisma.user.groupBy({ by: ['status', 'gender'], where: { role: 'USER' }, _count: true }),
      this.prisma.moderationItem.count({ where: { status: 'PENDING' } }),
      this.prisma.report.count({ where: { status: 'OPEN' } }),
      this.prisma.chat.count({ where: { status: { in: ['ACTIVE', 'PAUSED'] } } }),
    ]);
    return { users: byStatus.map((r) => ({ status: r.status, gender: r.gender, count: r._count })), pendingModeration, openReports, activeChats };
  }

  private async assertTargetable(mod: User, id: string) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException();
    // Moderatör başka bir ekip üyesine işlem yapamaz; bunu yalnızca admin yapar.
    if (target.role !== 'USER' && mod.role !== 'ADMIN') throw new BadRequestException({ error: 'forbidden_target' });
    if (target.id === mod.id) throw new BadRequestException();
    return target;
  }
}

@Controller('reports')
export class ReportsController {
  constructor(private readonly admin: AdminService) {}

  @Post()
  create(@CurrentUser() user: User, @Body(new ZodPipe(reportSchema)) body: ReportInput) {
    return this.admin.report(user, body);
  }
}

@Controller('admin')
@Roles('MODERATOR', 'ADMIN')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly photos: PhotosService,
  ) {}

  @Get('stats')
  stats() {
    return this.admin.stats();
  }

  @Get('reports')
  reports(@Query('status') status?: ReportStatus) {
    return this.admin.reports(status);
  }

  @Post('reports/:id/resolve')
  resolve(@CurrentUser() mod: User, @Param('id') id: string, @Body(new ZodPipe(resolveSchema)) body: z.infer<typeof resolveSchema>) {
    return this.admin.resolveReport(mod, id, body);
  }

  @Post('reports/:id/reply')
  reply(@CurrentUser() mod: User, @Param('id') id: string, @Body(new ZodPipe(replySchema)) body: z.infer<typeof replySchema>) {
    return this.admin.replyReport(mod, id, body.text);
  }

  @Get('users')
  users(@CurrentUser() viewer: User, @Query('q') q?: string, @Query('gender') gender?: string) {
    return this.admin.users(viewer, q, gender === 'MALE' || gender === 'FEMALE' ? gender : undefined);
  }

  @Get('users/:id')
  user(@CurrentUser() mod: User, @Param('id') id: string) {
    return this.admin.user(mod, id);
  }

  @Post('users/:id/ban')
  @Roles('ADMIN')
  ban(@CurrentUser() mod: User, @Param('id') id: string, @Body(new ZodPipe(reasonSchema)) body: { reason: string }) {
    return this.admin.ban(mod, id, body.reason);
  }

  @Post('users/:id/freeze')
  freeze(@CurrentUser() mod: User, @Param('id') id: string, @Body(new ZodPipe(reasonSchema)) body: { reason: string }) {
    return this.admin.freeze(mod, id, true, body.reason);
  }

  @Post('users/:id/gender')
  @Roles('ADMIN')
  gender(@CurrentUser() mod: User, @Param('id') id: string, @Body(new ZodPipe(genderSchema)) body: z.infer<typeof genderSchema>) {
    return this.admin.changeGender(mod, id, body.gender);
  }

  @Post('users/:id/unfreeze')
  unfreeze(@CurrentUser() mod: User, @Param('id') id: string) {
    return this.admin.freeze(mod, id, false);
  }

  @Post('photos/:id/reject')
  rejectPhoto(@CurrentUser() mod: User, @Param('id') id: string, @Body(new ZodPipe(reasonSchema)) body: { reason: string }) {
    return this.photos.rejectByStaff(mod, id, body.reason);
  }

  @Get('chats')
  chats(@Query('status') status?: ChatStatus) {
    return this.admin.chatsList(status);
  }

  @Get('chats/:id')
  chat(@CurrentUser() mod: User, @Param('id') id: string) {
    return this.admin.chat(mod, id);
  }

  @Post('chats/:id/close')
  closeChat(@CurrentUser() mod: User, @Param('id') id: string, @Body(new ZodPipe(reasonSchema)) body: { reason: string }) {
    return this.admin.closeChat(mod, id, body.reason);
  }
}

@Module({
  imports: [ChatModule, PhotosModule],
  controllers: [ReportsController, AdminController],
  providers: [AdminService],
})
export class AdminModule {}
