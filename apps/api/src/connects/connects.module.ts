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
import { NotificationsService } from '../notifications/notifications.service';
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

/** /start karşılaması: [mesaj, düğme yazısı, menü düğmesi yazısı]. */
const START_TEXT: Record<string, [string, string, string]> = {
  uz: [
    `Assalomu alaykum va rohmatullohi va barakatuh! 🌿

Hitaba — nikoh niyatidagi musulmon erkak va ayollar uchun tanishuv.

👥 Har bir suhbat guvohlar ishtirokida
🛡 Valiy suhbatni kuzatib borishi mumkin
🔒 Ayollarning suratlari faqat ruxsat bilan ko‘rinadi
✅ Har bir anketa moderator tomonidan tekshiriladi

Boshlash uchun pastdagi tugmani bosing 👇`,
    'Hitaba’ni ochish',
    'Ochish',
  ],
  ru: [
    `Ассаляму алейкум ва рахматуллахи ва баракятух! 🌿

Hitaba — знакомства для мусульман и мусульманок с намерением никаха.

👥 Каждый чат — в присутствии свидетелей
🛡 Вали может следить за перепиской
🔒 Фото женщин видны только с их разрешения
✅ Каждую анкету проверяет модератор

Чтобы начать, нажмите кнопку ниже 👇`,
    'Открыть Hitaba',
    'Открыть',
  ],
  tr: [
    `Esselâmü aleyküm ve rahmetullâhi ve berakâtüh! 🌿

Hitaba — nikâh niyetiyle tanışmak isteyen Müslüman kadın ve erkekler için.

👥 Her sohbet şahitler huzurunda
🛡 Veli sohbeti takip edebilir
🔒 Kadınların fotoğrafı yalnızca izinleriyle görünür
✅ Her profil moderatör tarafından incelenir

Başlamak için aşağıdaki düğmeye dokunun 👇`,
    'Hitaba’yı aç',
    'Aç',
  ],
  en: [
    `Assalamu alaykum wa rahmatullahi wa barakatuh! 🌿

Hitaba is where Muslim men and women meet with the intention of nikah.

👥 Every conversation is witnessed
🛡 The wali can follow the conversation
🔒 Women's photos are shown only with their permission
✅ Every profile is reviewed by a moderator

Tap the button below to begin 👇`,
    'Open Hitaba',
    'Open',
  ],
  ar: [
    `السلام عليكم ورحمة الله وبركاته! 🌿

هِتابة — تعارف للمسلمين والمسلمات بنية الزواج.

👥 كل محادثة بحضور شهود
🛡 يمكن للولي متابعة المحادثة
🔒 صور النساء لا تظهر إلا بإذنهن
✅ كل ملف يراجعه مشرف

اضغط الزر أدناه للبدء 👇`,
    'افتح هِتابة',
    'فتح',
  ],
};

@Controller('telegram')
@SkipThrottle()
export class TelegramWebhookController {
  constructor(
    private readonly connects: ConnectsService,
    private readonly telegram: TelegramService,
    private readonly notifications: NotificationsService,
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
      const [text, label, menu] = START_TEXT[lang] ?? START_TEXT.en;
      const chatId = String(update.message.chat.id);
      await Promise.all([this.telegram.sendMessage(chatId, text, label), this.telegram.setMenuButton(chatId, menu)]);
      // Kayıtlı kullanıcıysa sabitlenmiş durum satırı oluşturulur/güncellenir.
      const known = await this.connects.userIdByTelegram(chatId);
      if (known) await this.notifications.refreshTelegramStatus(known);
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
