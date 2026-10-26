import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, Injectable, Module, NotFoundException, Param, Post, Put } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { User } from '@prisma/client';
import { ageFromBirthDate, waliSetupSchema, type WaliPortalView, type WaliSetupInput } from '@hitaba/shared';
import { CurrentUser, Public } from '../auth/guards';
import { decrypt, encrypt, randomToken, sha256 } from '../common/crypto';
import { ageRange } from '../common/time';
import { ZodPipe } from '../common/zod.pipe';
import { env } from '../config/env';
import { toChatMessage } from '../chat/chat.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WaliService {
  constructor(private readonly prisma: PrismaService) {}

  async get(user: User) {
    this.assertFemale(user);
    const [link, witnesses] = await Promise.all([
      this.prisma.waliLink.findUnique({ where: { femaleId: user.id } }),
      this.prisma.witness.findMany({ where: { femaleId: user.id }, orderBy: { createdAt: 'asc' } }),
    ]);
    return {
      url: link ? this.urlFor(decrypt(link.tokenEnc)) : null,
      waliName: link?.waliName ?? null,
      waliRelation: link?.waliRelation ?? null,
      lastAccessAt: link?.lastAccessAt?.toISOString() ?? null,
      witnesses: witnesses.map((w) => ({ id: w.id, name: w.name, relation: w.relation })),
    };
  }

  /** Veli bilgisi ve şahitler (en fazla 2, isim + yakınlık zorunlu). */
  async setup(user: User, input: WaliSetupInput) {
    this.assertFemale(user);
    await this.prisma.$transaction(async (tx) => {
      await tx.witness.deleteMany({ where: { femaleId: user.id } });
      if (input.witnesses.length) {
        await tx.witness.createMany({ data: input.witnesses.map((w) => ({ ...w, femaleId: user.id })) });
      }
      const link = await tx.waliLink.findUnique({ where: { femaleId: user.id } });
      if (link) {
        await tx.waliLink.update({
          where: { id: link.id },
          data: { waliName: input.waliName ?? null, waliRelation: input.waliRelation ?? null },
        });
      }
    });
    if (input.waliName && !(await this.prisma.waliLink.findUnique({ where: { femaleId: user.id } }))) {
      await this.regenerate(user, input.waliName, input.waliRelation);
    }
    return this.get(user);
  }

  /** Yeni link oluşturur; varsa eskisi anında geçersiz olur. */
  async regenerate(user: User, waliName?: string, waliRelation?: WaliSetupInput['waliRelation']) {
    this.assertFemale(user);
    const token = randomToken(32);
    const data = { tokenHash: sha256(token), tokenEnc: encrypt(token), lastAccessAt: null };
    await this.prisma.waliLink.upsert({
      where: { femaleId: user.id },
      create: { femaleId: user.id, ...data, waliName: waliName ?? null, waliRelation: waliRelation ?? null },
      update: data,
    });
    return this.get(user);
  }

  async revoke(user: User) {
    this.assertFemale(user);
    await this.prisma.waliLink.deleteMany({ where: { femaleId: user.id } });
  }

  /** Kayıtsız, salt-okunur veli görünümü: kadının en son sohbeti (§5.6). */
  async portal(token: string): Promise<WaliPortalView> {
    const link = await this.prisma.waliLink.findUnique({ where: { tokenHash: sha256(token) }, include: { female: { include: { profile: true } } } });
    if (!link || link.female.status === 'BANNED' || link.female.status === 'DELETED') throw new NotFoundException();

    await Promise.all([
      this.prisma.waliLink.update({ where: { id: link.id }, data: { lastAccessAt: new Date() } }),
      this.prisma.auditLog.create({ data: { action: 'wali.view', targetType: 'WALI_LINK', targetId: link.id } }),
    ]);

    const [witnesses, chat] = await Promise.all([
      this.prisma.witness.findMany({ where: { femaleId: link.femaleId } }),
      this.prisma.chat.findFirst({
        where: { match: { femaleId: link.femaleId } },
        orderBy: { createdAt: 'desc' },
        include: { match: { include: { male: { include: { profile: true } } } } },
      }),
    ]);

    let chatView: WaliPortalView['chat'] = null;
    if (chat) {
      const messages = await this.prisma.message.findMany({
        where: { chatId: chat.id, state: 'DELIVERED' },
        include: { reactions: true },
        orderBy: { createdAt: 'asc' },
        take: 500,
      });
      const mp = chat.match.male.profile;
      chatView = {
        id: chat.id,
        status: chat.status,
        other: {
          displayName: mp?.displayName ?? '',
          ageRange: mp?.birthDate ? ageRange(ageFromBirthDate(mp.birthDate)) : '',
          city: mp?.city ?? '',
          country: mp?.country ?? '',
        },
        messages: messages.map(toChatMessage),
      };
    }

    return {
      femaleDisplayName: link.female.profile?.displayName ?? '',
      waliName: link.waliName,
      witnesses: witnesses.map((w) => ({ name: w.name, relation: w.relation })),
      chat: chatView,
    };
  }

  private urlFor(token: string) {
    return `${env.PUBLIC_WEB_URL}/wali/${token}`;
  }

  private assertFemale(user: User) {
    if (user.gender !== 'FEMALE') throw new ForbiddenException();
  }
}

@Controller('wali')
export class WaliController {
  constructor(private readonly wali: WaliService) {}

  @Get()
  get(@CurrentUser() user: User) {
    return this.wali.get(user);
  }

  @Put()
  setup(@CurrentUser() user: User, @Body(new ZodPipe(waliSetupSchema)) body: WaliSetupInput) {
    return this.wali.setup(user, body);
  }

  @Post('link')
  regenerate(@CurrentUser() user: User) {
    return this.wali.regenerate(user);
  }

  @Delete('link')
  @HttpCode(204)
  revoke(@CurrentUser() user: User) {
    return this.wali.revoke(user);
  }
}

@Controller('wali-portal')
@Throttle({ default: { limit: 30, ttl: 60_000 } })
export class WaliPortalController {
  constructor(private readonly wali: WaliService) {}

  @Public()
  @Get(':token')
  portal(@Param('token') token: string) {
    if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) throw new NotFoundException();
    return this.wali.portal(token);
  }
}

@Module({
  controllers: [WaliController, WaliPortalController],
  providers: [WaliService],
})
export class WaliModule {}
