import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Global,
  Headers,
  HttpCode,
  Module,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { User } from '@prisma/client';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { CONNECT_PACKAGES, type ConnectPackageId } from '@hitaba/shared';
import { CurrentUser, Public } from '../auth/guards';
import { ZodPipe } from '../common/zod.pipe';
import { env } from '../config/env';
import { TelegramService } from '../telegram/telegram.service';
import { ConnectsService } from './connects.service';

const packageSchema = z.object({
  packageId: z.enum(CONNECT_PACKAGES.map((p) => p.id) as [ConnectPackageId, ...ConnectPackageId[]]),
});

@Controller('connects')
export class ConnectsController {
  constructor(private readonly connects: ConnectsService) {}

  @Get()
  overview(@CurrentUser() user: User) {
    return this.connects.overview(user);
  }

  @Post('invoice')
  invoice(@CurrentUser() user: User, @Body(new ZodPipe(packageSchema)) body: { packageId: ConnectPackageId }) {
    return this.connects.createTelegramInvoice(user, body.packageId);
  }

  @Post('dev-credit')
  devCredit(@CurrentUser() user: User, @Body(new ZodPipe(packageSchema)) body: { packageId: ConnectPackageId }) {
    if (!env.DEV_PAYMENTS) throw new NotFoundException();
    return this.connects.devCredit(user, body.packageId);
  }
}

interface TelegramUpdate {
  pre_checkout_query?: { id: string; currency: string; total_amount: number; invoice_payload: string };
  message?: {
    chat: { id: number };
    text?: string;
    from?: { language_code?: string };
    successful_payment?: {
      currency: string;
      total_amount: number;
      invoice_payload: string;
      telegram_payment_charge_id: string;
    };
  };
}

const START_TEXT: Record<string, [string, string]> = {
  uz: ['Assalomu alaykum! Hitaba — nikoh niyatidagi, guvohli va valiy nazoratidagi tanishuv.', 'Hitaba’ni ochish'],
  ru: ['Ассаляму алейкум! Hitaba — знакомства с намерением никаха, под наблюдением свидетелей и вали.', 'Открыть Hitaba'],
  tr: ['Esselamü aleyküm! Hitaba — nikah niyetli, şahitli ve veli gözetimli tanışma.', 'Hitaba’yı aç'],
  en: ['Assalamu alaykum! Hitaba — marriage-minded introductions with witnesses and wali oversight.', 'Open Hitaba'],
  ar: ['السلام عليكم! هِتابة — تعارف بنية الزواج بحضور الشهود وإشراف الولي.', 'افتح هِتابة'],
};

@Controller('telegram')
@SkipThrottle()
export class TelegramWebhookController {
  constructor(
    private readonly connects: ConnectsService,
    private readonly telegram: TelegramService,
  ) {}

  @Public()
  @Post('webhook')
  @HttpCode(200)
  async webhook(@Headers('x-telegram-bot-api-secret-token') secret: string | undefined, @Body() update: TelegramUpdate) {
    if (!env.TELEGRAM_WEBHOOK_SECRET || !secret || !safeEqual(secret, env.TELEGRAM_WEBHOOK_SECRET)) {
      throw new ForbiddenException();
    }

    const q = update.pre_checkout_query;
    if (q) {
      const ok = await this.connects.validatePreCheckout(q.invoice_payload, q.currency, q.total_amount);
      await this.telegram.answerPreCheckoutQuery(q.id, ok, ok ? undefined : 'Payment expired');
      return { ok: true };
    }

    const sp = update.message?.successful_payment;
    if (sp) {
      await this.connects.completeTelegramPayment({
        paymentId: sp.invoice_payload,
        chargeId: sp.telegram_payment_charge_id,
        currency: sp.currency,
        amount: sp.total_amount,
      });
      return { ok: true };
    }

    if (update.message?.text?.startsWith('/start')) {
      const lang = update.message.from?.language_code?.slice(0, 2) ?? 'en';
      const [text, label] = START_TEXT[lang] ?? START_TEXT.en;
      await this.telegram.sendMessage(String(update.message.chat.id), text, label);
    }
    return { ok: true };
  }
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

@Global()
@Module({
  controllers: [ConnectsController, TelegramWebhookController],
  providers: [ConnectsService],
  exports: [ConnectsService],
})
export class ConnectsModule {}
