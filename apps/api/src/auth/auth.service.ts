import { BadRequestException, ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { ConsentKind, Prisma, User } from '@prisma/client';
import { EMAIL_VERIFY_TTL_HOURS, POLICY_VERSION, RULES, type AuthTokens, type LoginInput, type RegisterInput, type TelegramAuthInput } from '@hitaba/shared';
import { env } from '../config/env';
import { decrypt, hashPassword, randomToken, sha256, verifyPassword } from '../common/crypto';
import { hours } from '../common/time';
import { verifyTotp } from '../common/totp';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AccessPayload } from './guards';
import { verifyTelegramInitData } from './telegram-init-data';

/** Hoş geldin: yeni erkek hesaba ilk sohbet için 1 ücretsiz jeton (kadınlar jeton harcamaz). */
function welcomeBonus(gender: User['gender']): Pick<Prisma.UserCreateInput, 'connectBalance' | 'connectTxs'> {
  if (gender !== 'MALE') return {};
  return {
    connectBalance: RULES.welcomeConnects,
    connectTxs: { create: { amount: RULES.welcomeConnects, type: 'BONUS', note: 'welcome' } },
  };
}

interface RefreshPayload {
  sub: string;
  tv: number;
  /** Personel oturumu (StaffSession). Eski token'larda yoktur; ilk yenilemede oluşturulur. */
  sid?: string;
}

/** Yönetici ve moderatörlerin oturumları ve girişleri ayrıca kaydedilir. */
export const isStaff = (u: Pick<User, 'role'>) => u.role !== 'USER';

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
    private readonly notifications: NotificationsService,
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
        ...welcomeBonus(input.gender),
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

  async login(input: LoginInput, meta: RequestMeta = {}): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    // Kullanıcı yoksa da hash doğrulaması yapılır: zamanlama ile e-posta tespiti engellenir.
    const ok = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) {
      if (user && isStaff(user)) await this.recordLogin(user.id, false, 'password', meta);
      throw new UnauthorizedException({ error: 'invalid_credentials' });
    }
    if (user.status === 'BANNED' || user.status === 'DELETED') {
      throw new UnauthorizedException({ error: 'account_blocked' });
    }
    if (user.totpEnabledAt) {
      // Şifre doğruysa kod istenir; istemci kod alanını gösterip aynı isteği tekrarlar.
      if (!input.otp) throw new UnauthorizedException({ error: 'otp_required' });
      if (!(await this.consumeTotp(user, input.otp))) {
        await this.recordLogin(user.id, false, 'otp', meta);
        throw new UnauthorizedException({ error: 'invalid_otp' });
      }
    }
    if (isStaff(user)) await this.recordLogin(user.id, true, null, meta);
    return this.issue(user, true, meta);
  }

  /** Kodu doğrular ve adımını kaydeder: aynı kod (ör. omuz üstünden görülmüş) ikinci kez geçmez. */
  async consumeTotp(user: User, code: string, secretEnc = user.totpSecretEnc): Promise<boolean> {
    if (!secretEnc) return false;
    const step = verifyTotp(decrypt(secretEnc), code);
    if (step === null) return false;
    const res = await this.prisma.user.updateMany({
      where: { id: user.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
      data: { totpLastStep: step },
    });
    return res.count > 0;
  }

  private async recordLogin(userId: string, ok: boolean, reason: string | null, meta: RequestMeta) {
    await this.prisma.loginEvent.create({
      data: { userId, ok, reason, ip: meta.ip ?? null, userAgent: meta.userAgent?.slice(0, 300) ?? null },
    });
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
          ...welcomeBonus(input.gender),
          profile: { create: {} },
          consents: { create: consentRows(meta) },
        },
      });
    } else if (user.status === 'BANNED' || user.status === 'DELETED') {
      throw new UnauthorizedException({ error: 'account_blocked' });
    } else if (tgUser.username && tgUser.username !== user.telegramUsername) {
      user = await this.prisma.user.update({ where: { id: user.id }, data: { telegramUsername: tgUser.username } });
    }
    void this.notifications.refreshTelegramStatus(user.id);
    return this.issue(user);
  }

  async refresh(refreshToken: string, meta: RequestMeta = {}): Promise<AuthTokens> {
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
    if (payload.sid) {
      const session = await this.prisma.staffSession.findUnique({ where: { id: payload.sid } });
      if (!session || session.userId !== user.id || session.revokedAt) throw new UnauthorizedException();
      if (Date.now() - session.lastUsedAt.getTime() > 60_000) {
        await this.prisma.staffSession.update({
          where: { id: session.id },
          data: { lastUsedAt: new Date(), ip: meta.ip ?? session.ip, userAgent: meta.userAgent?.slice(0, 300) ?? session.userAgent },
        });
      }
      return this.issue(user, false, meta, session.id);
    }
    // Oturum kimliği olmayan eski personel token'ı: oturum kapanmaz, şimdi kayda alınır.
    return this.issue(user, false, meta);
  }

  /** Bu cihazın oturumunu kapat (çıkış). */
  async logout(sessionId: string | undefined): Promise<void> {
    if (!sessionId) return;
    await this.prisma.staffSession.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  /** Tüm oturumları kapat. */
  async revokeAll(userId: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
  }

  /** Token çifti üretir. Personel için oturum yoksa yeni bir StaffSession açılır. */
  async issue(user: User, touchLogin = true, meta: RequestMeta = {}, sessionId?: string): Promise<AuthTokens> {
    if (touchLogin) {
      await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    }
    let sid = sessionId;
    if (!sid && isStaff(user)) {
      const session = await this.prisma.staffSession.create({
        data: { userId: user.id, ip: meta.ip ?? null, userAgent: meta.userAgent?.slice(0, 300) ?? null },
      });
      sid = session.id;
    }
    const access: AccessPayload = { sub: user.id, role: user.role, ...(sid && { sid }) };
    const refresh: RefreshPayload = { sub: user.id, tv: user.tokenVersion, ...(sid && { sid }) };
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
