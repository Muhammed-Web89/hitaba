import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import type { AuthTokens, LoginInput, RegisterInput, TelegramAuthInput } from '@hitaba/shared';
import { env } from '../config/env';
import { hashPassword, verifyPassword } from '../common/crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { AccessPayload } from './guards';
import { verifyTelegramInitData } from './telegram-init-data';

interface RefreshPayload {
  sub: string;
  tv: number;
}

const SUPPORTED_LOCALES = new Set(['uz', 'ru', 'tr', 'en', 'ar']);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(input: RegisterInput): Promise<AuthTokens> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictException({ error: 'email_taken' });
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash: await hashPassword(input.password),
        gender: input.gender,
        locale: normalizeLocale(input.locale),
        profile: { create: {} },
      },
    });
    return this.issue(user);
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

  async telegram(input: TelegramAuthInput): Promise<AuthTokens> {
    const tgUser = verifyTelegramInitData(input.initData, env.TELEGRAM_BOT_TOKEN);
    if (!tgUser) throw new UnauthorizedException({ error: 'invalid_init_data' });

    const telegramId = String(tgUser.id);
    let user = await this.prisma.user.findUnique({ where: { telegramId } });
    if (!user) {
      if (!input.gender) throw new ConflictException({ error: 'gender_required' });
      user = await this.prisma.user.create({
        data: {
          telegramId,
          telegramUsername: tgUser.username ?? null,
          gender: input.gender,
          locale: normalizeLocale(tgUser.language_code),
          profile: { create: {} },
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
  return SUPPORTED_LOCALES.has(l) ? l : 'uz';
}

// Var olmayan kullanıcılar için sabit maliyetli doğrulama.
const DUMMY_HASH =
  'scrypt$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
