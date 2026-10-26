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
import type { ChatStatus, ReportStatus, User } from '@prisma/client';
import { z } from 'zod';
import { reportSchema, type ReportInput } from '@hitaba/shared';
import { CurrentUser, Roles } from '../auth/guards';
import { ChatModule } from '../chat/chat.module';
import { ChatService } from '../chat/chat.service';
import { ZodPipe } from '../common/zod.pipe';
import { ConnectsService } from '../connects/connects.service';
import { ModerationService } from '../moderation/moderation.service';
import { PrismaService } from '../prisma/prisma.service';

const reasonSchema = z.object({ reason: z.string().trim().min(3).max(500) });
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

  users(q?: string) {
    const term = q?.trim();
    return this.prisma.user.findMany({
      where: term
        ? {
            OR: [
              { id: term },
              { email: { contains: term, mode: 'insensitive' } },
              { telegramUsername: { contains: term.replace(/^@/, ''), mode: 'insensitive' } },
              { profile: { displayName: { contains: term, mode: 'insensitive' } } },
            ],
          }
        : {},
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
  }

  async user(mod: User, id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        profile: { omit: { screeningEnc: true } },
        reportsAgainst: { orderBy: { createdAt: 'desc' }, take: 20 },
        connectTxs: { orderBy: { createdAt: 'desc' }, take: 20 },
        _count: { select: { likesGiven: true, likesReceived: true, matchesAsMale: true, matchesAsFemale: true } },
      },
    });
    if (!user) throw new NotFoundException();
    await this.moderation.audit(mod.id, 'user.view', { targetType: 'USER', targetId: id });
    const { passwordHash: _pw, ...safe } = user;
    return safe;
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
  constructor(private readonly admin: AdminService) {}

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

  @Get('users')
  users(@Query('q') q?: string) {
    return this.admin.users(q);
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

  @Post('users/:id/unfreeze')
  unfreeze(@CurrentUser() mod: User, @Param('id') id: string) {
    return this.admin.freeze(mod, id, false);
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
  imports: [ChatModule],
  controllers: [ReportsController, AdminController],
  providers: [AdminService],
})
export class AdminModule {}
