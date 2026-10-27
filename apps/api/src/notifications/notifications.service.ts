import { Controller, Get, Global, HttpCode, Injectable, Module, Param, Post, Query } from '@nestjs/common';
import type { Notification, User } from '@prisma/client';
import type { NotificationItem } from '@hitaba/shared';
import { CurrentUser } from '../auth/guards';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { TelegramService } from '../telegram/telegram.service';

export type NotificationType =
  | 'profile_approved'
  | 'profile_rejected'
  | 'photo_rejected'
  | 'mutual_match'
  | 'photo_approved'
  | 'chat_requested'
  | 'chat_opened'
  | 'chat_paused'
  | 'chat_resumed'
  | 'chat_closed'
  | 'silence_reminder'
  | 'mahram_approved'
  | 'mahram_rejected'
  | 'connects_credited';

/** Telegram'a gönderilen kısa metinler. Uygulama içi metinler web tarafında çevrilir. */
const TG_TEXT: Record<string, Partial<Record<NotificationType, string>>> = {
  uz: {
    profile_approved: 'Profilingiz tasdiqlandi. Endi anketlarni ko‘rishingiz mumkin.',
    profile_rejected: 'Profilingiz moderatsiyadan o‘tmadi. Iltimos, ilovada tafsilotlarni ko‘ring.',
    mutual_match: 'Sizda yangi o‘zaro qiziqish bor.',
    photo_approved: 'Suratingiz tasdiqlandi — endi suhbat boshlashingiz mumkin.',
    chat_requested: 'Sizdan suhbatni boshlashingizni so‘rashdi.',
    chat_opened: 'Siz uchun yangi suhbat ochildi.',
    silence_reminder: 'Suhbatingizda bir muddatdan beri xabar yo‘q.',
    chat_closed: 'Suhbatingiz yopildi.',
    mahram_approved: 'Mahram aloqa ma’lumoti suhbatda e’lon qilindi.',
    connects_credited: 'Hisobingizga connect qo‘shildi.',
  },
  ru: {
    profile_approved: 'Ваш профиль одобрен. Теперь вы можете смотреть анкеты.',
    profile_rejected: 'Профиль не прошёл модерацию. Подробности — в приложении.',
    mutual_match: 'У вас новая взаимная симпатия.',
    photo_approved: 'Ваше фото одобрено — теперь вы можете начать чат.',
    chat_requested: 'Вас просят начать чат.',
    chat_opened: 'Для вас открыт новый чат.',
    silence_reminder: 'В вашем чате давно нет сообщений.',
    chat_closed: 'Ваш чат закрыт.',
    mahram_approved: 'Контакт махрама опубликован в чате.',
    connects_credited: 'Коннекты зачислены на ваш баланс.',
  },
  tr: {
    profile_approved: 'Profiliniz onaylandı. Artık profilleri görebilirsiniz.',
    profile_rejected: 'Profiliniz moderasyondan geçmedi. Ayrıntılar uygulamada.',
    mutual_match: 'Yeni bir karşılıklı ilginiz var.',
    photo_approved: 'Fotoğrafınız onaylandı — artık sohbet başlatabilirsiniz.',
    chat_requested: 'Sizden sohbeti başlatmanız isteniyor.',
    chat_opened: 'Sizin için yeni bir sohbet açıldı.',
    silence_reminder: 'Sohbetinizde bir süredir mesaj yok.',
    chat_closed: 'Sohbetiniz kapatıldı.',
    mahram_approved: 'Mahrem iletişim bilgisi sohbette paylaşıldı.',
    connects_credited: 'Bakiyenize connect eklendi.',
  },
  en: {
    profile_approved: 'Your profile is approved. You can now browse profiles.',
    profile_rejected: 'Your profile did not pass moderation. See details in the app.',
    mutual_match: 'You have a new mutual interest.',
    photo_approved: 'Your photo was approved — you can now start a chat.',
    chat_requested: 'You have been asked to start a chat.',
    chat_opened: 'A new chat has been opened for you.',
    silence_reminder: 'Your chat has been quiet for a while.',
    chat_closed: 'Your chat was closed.',
    mahram_approved: 'The mahram contact was posted in the chat.',
    connects_credited: 'Connects were added to your balance.',
  },
  ar: {
    profile_approved: 'تمت الموافقة على ملفك. يمكنك الآن تصفح الملفات.',
    profile_rejected: 'لم يجتز ملفك المراجعة. التفاصيل في التطبيق.',
    mutual_match: 'لديك اهتمام متبادل جديد.',
    photo_approved: 'تمت الموافقة على صورتك — يمكنك الآن بدء المحادثة.',
    chat_requested: 'طُلب منك بدء المحادثة.',
    chat_opened: 'تم فتح محادثة جديدة لك.',
    silence_reminder: 'لا توجد رسائل في محادثتك منذ مدة.',
    chat_closed: 'تم إغلاق محادثتك.',
    mahram_approved: 'تم نشر بيانات تواصل المحرم في المحادثة.',
    connects_credited: 'تمت إضافة الرصيد إلى حسابك.',
  },
};

const OPEN_LABEL: Record<string, string> = { uz: 'Ochish', ru: 'Открыть', tr: 'Aç', en: 'Open', ar: 'فتح' };

export function toNotificationItem(n: Notification): NotificationItem {
  return {
    id: n.id,
    type: n.type,
    data: (n.data ?? {}) as Record<string, unknown>,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  };
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly telegram: TelegramService,
  ) {}

  async notify(userId: string, type: NotificationType, data: Record<string, unknown> = {}) {
    const n = await this.prisma.notification.create({ data: { userId, type, data: data as object } });
    this.realtime.toUser(userId, 'notification:new', toNotificationItem(n));

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { telegramId: true, locale: true },
    });
    const text = user && (TG_TEXT[user.locale] ?? TG_TEXT.en)[type];
    if (user?.telegramId && text) {
      void this.telegram.sendMessage(user.telegramId, `Hitaba · ${text}`, OPEN_LABEL[user.locale] ?? OPEN_LABEL.en);
    }
    return n;
  }
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: User, @Query('unread') unread?: string) {
    const rows = await this.prisma.notification.findMany({
      where: { userId: user.id, ...(unread === '1' && { readAt: null }) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const unreadCount = await this.prisma.notification.count({ where: { userId: user.id, readAt: null } });
    return { items: rows.map(toNotificationItem), unreadCount };
  }

  @Post('read-all')
  @HttpCode(204)
  async readAll(@CurrentUser() user: User) {
    await this.prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  }

  @Post(':id/read')
  @HttpCode(204)
  async read(@CurrentUser() user: User, @Param('id') id: string) {
    await this.prisma.notification.updateMany({ where: { id, userId: user.id }, data: { readAt: new Date() } });
  }
}

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
