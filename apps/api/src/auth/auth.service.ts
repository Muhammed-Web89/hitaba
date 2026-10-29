import { BadRequestException, ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { ConsentKind, Prisma, User } from '@prisma/client';
import { EMAIL_VERIFY_TTL_HOURS, POLICY_VERSION, type AuthTokens, type LoginInput, type RegisterInput, type TelegramAuthInput } from '@hitaba/shared';
import { env } from '../config/env';
import { hashPassword, randomToken, sha256, verifyPassword } from '../common/crypto';
import { hours } from '../common/time';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AccessPayload } from './guards';
import { verifyTelegramInitData } from './telegram-init-data';

interface RefreshPayload {
  sub: string;
  tv: number;
}

const SUPPORTED_LOCALES = new Set(['uz', 'ru', 'tr', 'en', 'ar']);
const CONSENT_KINDS: ConsentKind[] = ['PRIVACY', 'TERMS', 'SENSITIVE_DATA', 'ADULT'];
const VERIFY_PURPOSE = 'verify_email';

/** Rıza kaydı için istek bağlamı (KVKK/GDPR ispatı). */
export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

function consentRows(meta: RequestMeta): Prisma.ConsentCreateWithoutUserInput[] {
  return CONSENT_KINDS.map((kind) => ({
    kind,
    version: POLICY_VERSION,
    ip: meta.ip ?? null,
    userAgent: meta.userAgent?.slice(0, 300) ?? null,
  }));
}

@Injectable()
export class AuthService {
  private readonly log = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
  ) {}

  async register(input: RegisterInput, meta: RequestMeta): Promise<AuthTokens> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictException({ error: 'email_taken' });
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash: await hashPassword(input.password),
        gender: input.gender,
        locale: normalizeLocale(input.locale),
        profile: { create: {} },
        consents: { create: consentRows(meta) },
      },
    });
    // E-posta gönderimi başarısız olsa da kayıt tamamlanır; kullanıcı yeniden gönderebilir.
    await this.sendVerification(user).catch((e) => this.log.warn(`verification mail: ${(e as Error).message}`));
    return this.issue(user);
  }

  async sendVerification(user: User): Promise<void> {
    if (!user.email || user.emailVerifiedAt) return;
    const token = randomToken(32);
    await this.prisma.$transaction([
      // Önceki kullanılmamış linkler geçersiz olur.
      this.prisma.emailToken.updateMany({
        where: { userId: user.id, purpose: VERIFY_PURPOSE, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.emailToken.create({
        data: {
          userId: user.id,
          tokenHash: sha256(token),
          purpose: VERIFY_PURPOSE,
          expiresAt: new Date(Date.now() + hours(EMAIL_VERIFY_TTL_HOURS)),
        },
      }),
    ]);
    const link = `${env.PUBLIC_WEB_URL}/${user.locale}/verify-email?token=${token}`;
    await this.mail.send(this.mail.verificationEmail(user.email, user.locale, link));
  }

  async verifyEmail(token: string): Promise<{ ok: true }> {
    const row = await this.prisma.emailToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!row || row.purpose !== VERIFY_PURPOSE || row.usedAt || row.expiresAt < new Date()) {
      throw new BadRequestException({ error: 'invalid_or_expired_token' });
    }
    await this.prisma.$transaction([
      this.prisma.emailToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      this.prisma.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date() } }),
    ]);
    return { ok: true };
  }

  async login(input: LoginInput): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    // Kullanıcı yoksa da hash doğrulaması yapılır: zamanlama ile e-posta tespiti engellenir.
    const ok = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw new UnauthorizedException({ error: 'invalid_credentials' });
    if (user.status === 'BANNED' || user.status === 'DELETED') {
      throw new UnauthorizedException({ error: 'account_blocked' });
    }
    return this.issue(user);
  }

  async telegram(input: TelegramAuthInput, meta: RequestMeta): Promise<AuthTokens> {
    const tgUser = verifyTelegramInitData(input.initData, env.TELEGRAM_BOT_TOKEN);
    if (!tgUser) throw new UnauthorizedException({ error: 'invalid_init_data' });

    const telegramId = String(tgUser.id);
    let user = await this.prisma.user.findUnique({ where: { telegramId } });
    if (!user) {
      // İlk girişte cinsiyet ve rızalar birlikte istenir.
      if (!input.gender || !input.consents) throw new ConflictException({ error: 'signup_required' });
      user = await this.prisma.user.create({
        data: {
          telegramId,
          telegramUsername: tgUser.username ?? null,
          gender: input.gender,
          locale: normalizeLocale(tgUser.language_code),
          profile: { create: {} },
          consents: { create: consentRows(meta) },
        },
      });
    } else if (user.status === 'BANNED' || user.status === 'DELETED') {
      throw new UnauthorizedException({ error: 'account_blocked' });
    } else if (tgUser.username && tgUser.username !== user.telegramUsername) {
      user = await this.prisma.user.update({ where: { id: user.id }, data: { telegramUsername: tgUser.username } });
    }
    return this.issue(user);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: RefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshPayload>(refreshToken, { secret: env.JWT_REFRESH_SECRET });
    } catch {
      throw new UnauthorizedException();
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.tokenVersion !== payload.tv || user.status === 'BANNED' || user.status === 'DELETED') {
      throw new UnauthorizedException();
    }
    return this.issue(user, false);
  }

  /** Tüm oturumları kapat. */
  async revokeAll(userId: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
  }

  private async issue(user: User, touchLogin = true): Promise<AuthTokens> {
    if (touchLogin) {
      await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    }
    const access: AccessPayload = { sub: user.id, role: user.role };
    const refresh: RefreshPayload = { sub: user.id, tv: user.tokenVersion };
    return {
      accessToken: await this.jwt.signAsync(access, { secret: env.JWT_ACCESS_SECRET, expiresIn: '15m' }),
      refreshToken: await this.jwt.signAsync(refresh, { secret: env.JWT_REFRESH_SECRET, expiresIn: '30d' }),
    };
  }
}

function normalizeLocale(locale?: string | null): string {
  const l = (locale ?? '').slice(0, 2).toLowerCase();
  return SUPPORTED_LOCALES.has(l) ? l : 'en';
}

// Var olmayan kullanıcılar için sabit maliyetli doğrulama.
const DUMMY_HASH =
  'scrypt$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
