import { Controller, Get, Global, Injectable, Logger, Module, NotFoundException, Query } from '@nestjs/common';
import { Public } from '../auth/guards';
import { env } from '../config/env';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Geliştirmede gönderilen son e-postalar (yalnızca log sürücüsü; testler doğrulama linkini buradan okur). */
const devOutbox: MailMessage[] = [];

@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);

  async send(m: MailMessage): Promise<void> {
    if (env.MAIL_DRIVER === 'log') {
      devOutbox.unshift(m);
      devOutbox.length = Math.min(devOutbox.length, 50);
      this.log.log(`[mail → ${m.to}] ${m.subject}\n${m.text}`);
      return;
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [m.to], subject: m.subject, text: m.text, html: m.html }),
    });
    if (!res.ok) {
      // Gövde alıcı adresini içerebilir; yalnızca durum kodu loglanır.
      this.log.error(`resend failed: ${res.status}`);
      throw new Error('mail_send_failed');
    }
  }

  verificationEmail(to: string, locale: string, link: string): MailMessage {
    const t = VERIFY_TEXT[locale] ?? VERIFY_TEXT.en;
    const dir = locale === 'ar' ? 'rtl' : 'ltr';
    return {
      to,
      subject: t.subject,
      text: `${t.greeting}\n\n${t.body}\n\n${link}\n\n${t.ignore}`,
      html: `<!doctype html><html lang="${locale}" dir="${dir}"><body style="font-family:system-ui,sans-serif;background:#FBFAF6;padding:24px;color:#1C1B17">
<div style="max-width:480px;margin:auto;background:#fff;border:1px solid #E8E3D4;border-radius:12px;padding:24px">
<h1 style="font-size:20px;margin:0 0 12px">Hitaba</h1>
<p>${t.greeting}</p><p>${t.body}</p>
<p style="margin:24px 0"><a href="${link}" style="background:#2F8F5B;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:600">${t.button}</a></p>
<p style="font-size:13px;color:#8C887A">${t.ignore}</p></div></body></html>`,
    };
  }
}

const VERIFY_TEXT: Record<string, { subject: string; greeting: string; body: string; button: string; ignore: string }> = {
  en: {
    subject: 'Confirm your email — Hitaba',
    greeting: 'Assalamu alaykum,',
    body: 'Please confirm your email address to continue creating your profile. The link is valid for 48 hours.',
    button: 'Confirm email',
    ignore: 'If you did not create a Hitaba account, you can ignore this email.',
  },
  uz: {
    subject: 'Emailingizni tasdiqlang — Hitaba',
    greeting: 'Assalomu alaykum,',
    body: 'Anketa yaratishni davom ettirish uchun email manzilingizni tasdiqlang. Havola 48 soat amal qiladi.',
    button: 'Emailni tasdiqlash',
    ignore: 'Agar siz Hitaba’da hisob ochmagan boʻlsangiz, bu xatni eʼtiborsiz qoldiring.',
  },
  ru: {
    subject: 'Подтвердите email — Hitaba',
    greeting: 'Ассаляму алейкум,',
    body: 'Подтвердите адрес электронной почты, чтобы продолжить создание анкеты. Ссылка действует 48 часов.',
    button: 'Подтвердить email',
    ignore: 'Если вы не регистрировались в Hitaba, просто проигнорируйте это письмо.',
  },
  tr: {
    subject: 'E-postanızı doğrulayın — Hitaba',
    greeting: 'Esselamü aleyküm,',
    body: 'Profilinizi oluşturmaya devam etmek için e-posta adresinizi doğrulayın. Bağlantı 48 saat geçerlidir.',
    button: 'E-postayı doğrula',
    ignore: 'Hitaba’da hesap oluşturmadıysanız bu e-postayı yok sayabilirsiniz.',
  },
  ar: {
    subject: 'أكّد بريدك الإلكتروني — هِتابة',
    greeting: 'السلام عليكم،',
    body: 'يرجى تأكيد بريدك الإلكتروني لمتابعة إنشاء ملفك. الرابط صالح لمدة ٤٨ ساعة.',
    button: 'تأكيد البريد',
    ignore: 'إذا لم تُنشئ حسابًا في هِتابة، يمكنك تجاهل هذه الرسالة.',
  },
};

/** Yalnızca geliştirme/test: log sürücüsüne düşen son e-postalar. Üretimde 404. */
@Controller('dev')
export class DevMailController {
  @Public()
  @Get('mails')
  mails(@Query('to') to?: string) {
    if (env.NODE_ENV === 'production' || env.MAIL_DRIVER !== 'log') throw new NotFoundException();
    return devOutbox.filter((m) => !to || m.to === to.toLowerCase()).map(({ to, subject, text }) => ({ to, subject, text }));
  }
}

@Global()
@Module({ controllers: [DevMailController], providers: [MailService], exports: [MailService] })
export class MailModule {}
