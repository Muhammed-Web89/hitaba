import { Controller, Delete, Get, Injectable, Module, NotFoundException, Param, Post } from '@nestjs/common';
import type { Prisma, User } from '@prisma/client';
import { CurrentUser } from '../auth/guards';
import { ChatModule } from '../chat/chat.module';
import { ChatService } from '../chat/chat.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

/** Karşı kullanıcıya uygulanır: izleyiciyle arasında hiçbir yönde engel yoksa eşleşir. */
export function notBlockedWith(viewerId: string): Prisma.UserWhereInput {
  return { blocksGiven: { none: { toId: viewerId } }, blocksReceived: { none: { fromId: viewerId } } };
}

@Injectable()
export class BlocksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chats: ChatService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Engelleme: iki taraf birbirini bir daha akışta, beğenilerde, eşleşmelerde görmez.
   * Açık sohbet kapanır, eşleşme kapanır, karşılıklı beğeni ve favoriler silinir. Karşı tarafa ayrıca bildirim gitmez.
   */
  async block(viewer: User, targetId: string) {
    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target || target.id === viewer.id || target.role !== 'USER' || target.gender === viewer.gender) throw new NotFoundException();
    const pair = [
      { fromId: viewer.id, toId: target.id },
      { fromId: target.id, toId: viewer.id },
    ];
    await this.prisma.$transaction([
      this.prisma.block.upsert({ where: { fromId_toId: pair[0] }, create: pair[0], update: {} }),
      this.prisma.like.deleteMany({ where: { OR: pair } }),
      this.prisma.favorite.deleteMany({ where: { OR: [{ userId: viewer.id, targetId: target.id }, { userId: target.id, targetId: viewer.id }] } }),
    ]);

    const [maleId, femaleId] = viewer.gender === 'MALE' ? [viewer.id, target.id] : [target.id, viewer.id];
    const match = await this.prisma.match.findUnique({ where: { maleId_femaleId: { maleId, femaleId } }, include: { chat: true } });
    if (match) {
      if (match.chat && match.chat.status !== 'CLOSED') await this.chats.close({ ...match.chat, match }, 'USER', viewer.id);
      if (match.stage !== 'CLOSED') await this.prisma.match.update({ where: { id: match.id }, data: { stage: 'CLOSED', closedById: viewer.id, closedAt: new Date() } });
    }
    void this.notifications.refreshTelegramStatus(viewer.id);
    void this.notifications.refreshTelegramStatus(target.id);
    return { ok: true };
  }

  async unblock(viewer: User, targetId: string) {
    await this.prisma.block.deleteMany({ where: { fromId: viewer.id, toId: targetId } });
    return { ok: true };
  }

  /** Engellediklerim: yalnızca ad ve engelleme tarihi (fotoğraf ve diğer bilgiler gösterilmez). */
  async list(viewer: User) {
    const rows = await this.prisma.block.findMany({
      where: { fromId: viewer.id },
      include: { to: { include: { profile: { select: { displayName: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({ userId: r.toId, displayName: r.to.profile?.displayName ?? '', createdAt: r.createdAt.toISOString() }));
  }
}

@Controller('blocks')
export class BlocksController {
  constructor(private readonly blocks: BlocksService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.blocks.list(user);
  }

  @Post(':userId')
  block(@CurrentUser() user: User, @Param('userId') userId: string) {
    return this.blocks.block(user, userId);
  }

  @Delete(':userId')
  unblock(@CurrentUser() user: User, @Param('userId') userId: string) {
    return this.blocks.unblock(user, userId);
  }
}

@Module({
  imports: [ChatModule],
  controllers: [BlocksController],
  providers: [BlocksService],
})
export class BlocksModule {}
