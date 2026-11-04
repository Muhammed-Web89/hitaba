import { BadRequestException, Body, Controller, Get, HttpCode, Injectable, NotFoundException, Param, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { User } from '@prisma/client';
import type { Request } from 'express';
import { z } from 'zod';
import type { AuthTokens } from '@hitaba/shared';
import { encrypt, hashPassword, verifyPassword } from '../common/crypto';
import { hours } from '../common/time';
import { generateTotpSecret, otpauthUrl } from '../common/totp';
import { ZodPipe } from '../common/zod.pipe';
import { PrismaService } from '../prisma/prisma.service';
import { metaOf } from './auth.controller';
import { AuthService, type RequestMeta } from './auth.service';
import { CurrentSession, CurrentUser, Roles } from './guards';

/** Personel şifresi create-admin ile aynı kurala uyar. */
const passwordSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(14).max(128) });
const confirmSchema = z.object({ password: z.string().min(1).max(128) });
const codeSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/) });
const disableSchema = confirmSchema.extend(codeSchema.shape);

/** Refresh token 30 gün geçerli; daha eski oturumlar zaten kendiliğinden düşmüştür. */
const SESSION_MAX_AGE_DAYS = 30;

/**
 * Yönetici/moderatör profili: şifre değiştirme, iki adımlı doğrulama, cihaz oturumları ve giriş geçmişi.
 * E-posta değişikliği ve e-postayla şifre sıfırlama bilerek yok: e-posta ele geçirilse bile
 * personel hesabı ele geçirilemez. Kurtarma sunucudan yapılır (create-admin, reset-2fa).
 */
@Injectable()
export class StaffSecurityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async overview(user: User, sessionId: string | undefined) {
    const [sessions, logins] = await Promise.all([
      this.prisma.staffSession.findMany({
        where: { userId: user.id, revokedAt: null, lastUsedAt: { gt: new Date(Date.now() - hours(24 * SESSION_MAX_AGE_DAYS)) } },
        orderBy: { lastUsedAt: 'desc' },
        take: 20,
      }),
      this.prisma.loginEvent.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 15 }),
    ]);
    return {
      email: user.email,
      role: user.role,
      totpEnabled: Boolean(user.totpEnabledAt),
      totpEnabledAt: user.totpEnabledAt?.toISOString() ?? null,
      passwordChangedAt: user.passwordChangedAt?.toISOString() ?? null,
      sessions: sessions.map((s) => ({
        id: s.id,
        ip: s.ip,
        userAgent: s.userAgent,
        createdAt: s.createdAt.toISOString(),
        lastUsedAt: s.lastUsedAt.toISOString(),
        current: s.id === sessionId,
      })),
      logins: logins.map((l) => ({ id: l.id, ok: l.ok, reason: l.reason, ip: l.ip, userAgent: l.userAgent, createdAt: l.createdAt.toISOString() })),
    };
  }

  /** Şifre değişince diğer cihazlar çıkış yapar; bu cihaz yeni token alır ve açık kalır. */
  async changePassword(user: User, sessionId: string | undefined, input: z.infer<typeof passwordSchema>, meta: RequestMeta): Promise<AuthTokens> {
    await this.assertPassword(user, input.currentPassword);
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(input.newPassword), passwordChangedAt: new Date(), tokenVersion: { increment: 1 } },
    });
    const tokens = await this.reissue(updated, sessionId, meta);
    await this.audit(user.id, 'staff.password_changed');
    return tokens;
  }

  /** Kurulum: gizli anahtar kaydedilir ama kod doğrulanana kadar giriş için istenmez. */
  async setupTotp(user: User, password: string) {
    await this.assertPassword(user, password);
    if (user.totpEnabledAt) throw new BadRequestException({ error: 'otp_already_enabled' });
    const secret = generateTotpSecret();
    await this.prisma.user.update({ where: { id: user.id }, data: { totpSecretEnc: encrypt(secret), totpLastStep: null } });
    return { secret, otpauthUrl: otpauthUrl(secret, user.email ?? user.id) };
  }

  async enableTotp(user: User, code: string) {
    if (user.totpEnabledAt) throw new BadRequestException({ error: 'otp_already_enabled' });
    if (!user.totpSecretEnc) throw new BadRequestException({ error: 'otp_setup_required' });
    if (!(await this.auth.consumeTotp(user, code))) throw new BadRequestException({ error: 'invalid_otp' });
    await this.prisma.user.update({ where: { id: user.id }, data: { totpEnabledAt: new Date() } });
    await this.audit(user.id, 'staff.2fa_enabled');
    return { ok: true };
  }

  async disableTotp(user: User, input: z.infer<typeof disableSchema>) {
    await this.assertPassword(user, input.password);
    if (!user.totpEnabledAt) throw new BadRequestException({ error: 'otp_not_enabled' });
    if (!(await this.auth.consumeTotp(user, input.code))) throw new BadRequestException({ error: 'invalid_otp' });
    await this.prisma.user.update({ where: { id: user.id }, data: { totpEnabledAt: null, totpSecretEnc: null, totpLastStep: null } });
    await this.audit(user.id, 'staff.2fa_disabled');
    return { ok: true };
  }

  async revokeSession(user: User, sessionId: string | undefined, id: string) {
    if (id === sessionId) throw new BadRequestException({ error: 'session_current' });
    const res = await this.prisma.staffSession.updateMany({ where: { id, userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    if (res.count === 0) throw new NotFoundException();
    await this.audit(user.id, 'staff.session_revoked');
    return { ok: true };
  }

  /** Diğer tüm cihazlar: oturum kimliği olmayan eski token'lar da tokenVersion ile düşer. */
  async revokeOthers(user: User, sessionId: string | undefined, meta: RequestMeta): Promise<AuthTokens> {
    const updated = await this.prisma.user.update({ where: { id: user.id }, data: { tokenVersion: { increment: 1 } } });
    const tokens = await this.reissue(updated, sessionId, meta);
    await this.audit(user.id, 'staff.sessions_revoked');
    return tokens;
  }

  private async reissue(user: User, sessionId: string | undefined, meta: RequestMeta): Promise<AuthTokens> {
    const tokens = await this.auth.issue(user, false, meta, sessionId);
    const keep = sessionId ?? sidOf(tokens.refreshToken);
    await this.prisma.staffSession.updateMany({
      where: { userId: user.id, revokedAt: null, ...(keep && { id: { not: keep } }) },
      data: { revokedAt: new Date() },
    });
    return tokens;
  }

  private async assertPassword(user: User, password: string) {
    if (!user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
      throw new BadRequestException({ error: 'wrong_password' });
    }
  }

  private async audit(actorId: string, action: string) {
    await this.prisma.auditLog.create({ data: { actorId, action, targetType: 'USER', targetId: actorId } });
  }
}

function sidOf(jwt: string): string | undefined {
  try {
    return JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()).sid;
  } catch {
    return undefined;
  }
}

@Controller('staff/me')
@Roles('ADMIN', 'MODERATOR')
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class StaffSecurityController {
  constructor(private readonly staff: StaffSecurityService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  overview(@CurrentUser() user: User, @CurrentSession() sid: string | undefined) {
    return this.staff.overview(user, sid);
  }

  @Post('password')
  @HttpCode(200)
  password(@CurrentUser() user: User, @CurrentSession() sid: string | undefined, @Body(new ZodPipe(passwordSchema)) body: z.infer<typeof passwordSchema>, @Req() req: Request) {
    return this.staff.changePassword(user, sid, body, metaOf(req));
  }

  @Post('2fa/setup')
  @HttpCode(200)
  setup(@CurrentUser() user: User, @Body(new ZodPipe(confirmSchema)) body: z.infer<typeof confirmSchema>) {
    return this.staff.setupTotp(user, body.password);
  }

  @Post('2fa/enable')
  @HttpCode(200)
  enable(@CurrentUser() user: User, @Body(new ZodPipe(codeSchema)) body: z.infer<typeof codeSchema>) {
    return this.staff.enableTotp(user, body.code);
  }

  @Post('2fa/disable')
  @HttpCode(200)
  disable(@CurrentUser() user: User, @Body(new ZodPipe(disableSchema)) body: z.infer<typeof disableSchema>) {
    return this.staff.disableTotp(user, body);
  }

  @Post('sessions/revoke-others')
  @HttpCode(200)
  revokeOthers(@CurrentUser() user: User, @CurrentSession() sid: string | undefined, @Req() req: Request) {
    return this.staff.revokeOthers(user, sid, metaOf(req));
  }

  @Post('sessions/:id/revoke')
  @HttpCode(200)
  revoke(@CurrentUser() user: User, @CurrentSession() sid: string | undefined, @Param('id') id: string) {
    return this.staff.revokeSession(user, sid, id);
  }
}
