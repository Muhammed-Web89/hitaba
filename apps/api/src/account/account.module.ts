import { Body, Controller, ForbiddenException, HttpCode, Injectable, Logger, Module, Post } from '@nestjs/common';
import type { User } from '@prisma/client';
import { z } from 'zod';
import { CurrentUser } from '../auth/guards';
import { ChatModule } from '../chat/chat.module';
import { ChatService } from '../chat/chat.service';
import { ZodPipe } from '../common/zod.pipe';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const deleteSchema = z.object({ confirm: z.literal(true) });

/**
 * Kullanıcının kendi hesabını silmesi (gizlilik politikası: "Saklama süresi").
 * Kimlik bilgileri, profil, fotoğraflar ve beğeniler hemen silinir; açık sohbetler kapanır.
 * Sohbet kayıtları kimliksiz kalır (moderasyon ve güvenlik için), ödeme kayıtları yasal süre boyunca tutulur.
 */
@Injectable()
export class AccountService {
  private readonly log = new Logger(AccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly chats: ChatService,
  ) {}

  async deleteAccount(user: User) {
    if (user.role !== 'USER') throw new ForbiddenException({ error: 'staff_account' });

    // Açık sohbetler kapanır; karşı taraf jeton harcadıysa iade edilir.
    const open = await this.prisma.chat.findMany({
      where: { status: { in: ['ACTIVE', 'PAUSED'] }, match: { OR: [{ maleId: user.id }, { femaleId: user.id }] } },
      include: { match: true },
    });
    for (const chat of open) await this.chats.close(chat, 'USER', user.id, chat.openedById !== user.id);

    const photos = await this.prisma.photo.findMany({ where: { userId: user.id } });
    await this.prisma.$transaction([
      this.prisma.match.updateMany({
        where: { OR: [{ maleId: user.id }, { femaleId: user.id }], stage: { not: 'CLOSED' } },
        data: { stage: 'CLOSED', closedById: user.id, closedAt: new Date() },
      }),
      this.prisma.like.deleteMany({ where: { OR: [{ fromId: user.id }, { toId: user.id }] } }),
      this.prisma.pass.deleteMany({ where: { OR: [{ fromId: user.id }, { toId: user.id }] } }),
      this.prisma.favorite.deleteMany({ where: { OR: [{ userId: user.id }, { targetId: user.id }] } }),
      this.prisma.likeWithdrawal.deleteMany({ where: { userId: user.id } }),
      this.prisma.photo.deleteMany({ where: { userId: user.id } }),
      this.prisma.witness.deleteMany({ where: { femaleId: user.id } }),
      this.prisma.waliLink.deleteMany({ where: { femaleId: user.id } }),
      this.prisma.emailToken.deleteMany({ where: { userId: user.id } }),
      this.prisma.profile.update({
        where: { userId: user.id },
        data: {
          displayName: null,
          birthDate: null,
          city: null,
          nationality: null,
          languages: [],
          heightCm: null,
          weightKg: null,
          aboutMe: null,
          aboutSpouse: null,
          beliefsManhaj: null,
          interests: [],
          screeningEnc: null,
        },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          status: 'DELETED',
          email: null,
          emailVerifiedAt: null,
          passwordHash: null,
          telegramId: null,
          telegramUsername: null,
          connectBalance: 0,
          statusReason: null,
          // Tüm oturumlar kapanır.
          tokenVersion: { increment: 1 },
        },
      }),
    ]);
    // Dosyalar veritabanı kaydından sonra silinir; biri başarısız olsa da hesap silinmiş sayılır.
    for (const p of photos) await this.storage.remove(p.storageKey).catch((e) => this.log.warn(`photo ${p.id}: ${(e as Error).message}`));
    return { ok: true };
  }
}

@Controller('me')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Post('delete')
  @HttpCode(200)
  delete(@CurrentUser() user: User, @Body(new ZodPipe(deleteSchema)) _body: { confirm: true }) {
    return this.account.deleteAccount(user);
  }
}

@Module({
  imports: [ChatModule],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}
