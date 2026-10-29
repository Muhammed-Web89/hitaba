import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { User } from '@prisma/client';
import type { Request } from 'express';
import { z } from 'zod';
import {
  loginSchema,
  registerSchema,
  telegramAuthSchema,
  verifyEmailSchema,
  type LoginInput,
  type RegisterInput,
  type TelegramAuthInput,
} from '@hitaba/shared';
import { ZodPipe } from '../common/zod.pipe';
import { AuthService, type RequestMeta } from './auth.service';
import { CurrentUser, Public } from './guards';

const refreshSchema = z.object({ refreshToken: z.string().min(1) });

const metaOf = (req: Request): RequestMeta => ({ ip: req.ip, userAgent: req.headers['user-agent'] });

@Controller('auth')
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  register(@Body(new ZodPipe(registerSchema)) body: RegisterInput, @Req() req: Request) {
    return this.auth.register(body, metaOf(req));
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body(new ZodPipe(loginSchema)) body: LoginInput) {
    return this.auth.login(body);
  }

  @Public()
  @Post('telegram')
  @HttpCode(200)
  telegram(@Body(new ZodPipe(telegramAuthSchema)) body: TelegramAuthInput, @Req() req: Request) {
    return this.auth.telegram(body, metaOf(req));
  }

  @Public()
  @Post('verify-email')
  @HttpCode(200)
  verifyEmail(@Body(new ZodPipe(verifyEmailSchema)) body: { token: string }) {
    return this.auth.verifyEmail(body.token);
  }

  /** Kötüye kullanım ve e-posta bombardımanına karşı sıkı sınır: 15 dakikada 3. */
  @Post('resend-verification')
  @HttpCode(204)
  @Throttle({ default: { limit: 3, ttl: 15 * 60_000 } })
  async resendVerification(@CurrentUser() user: User) {
    await this.auth.sendVerification(user);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  refresh(@Body(new ZodPipe(refreshSchema)) body: { refreshToken: string }) {
    return this.auth.refresh(body.refreshToken);
  }

  @Post('logout-all')
  @HttpCode(204)
  async logoutAll(@CurrentUser() user: User) {
    await this.auth.revokeAll(user.id);
  }
}
