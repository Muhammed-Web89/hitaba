import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Gender } from '@prisma/client';
import { hours, localHour } from '../common/time';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';

/**
 * Profilini doldurmayanlara günde bir Telegram hatırlatması (botu engelleyene kadar).
 * Erkeğe teşvik, kadına güven ve nikaha özendiren İslami sözler; botta yalnızca /start
 * diyenlere (cinsiyet bilinmez) genel davet. Mesajlar sırayla döner, her biri kendi dilinde.
 */
type Texts = Record<string, string[]>;

const MALE: Texts = {
  uz: [
    'Assalomu alaykum! 🌿\nAnketangiz sizni kutmoqda — atigi 5 daqiqa vaqt oladi. Toʻldirib qoʻying va nikoh niyatidagi opa-singillar bilan halol yoʻl bilan tanishing.\nBirinchi tanga — bizdan sovgʻa! 🎁',
    '«Orangizdagi yolgʻizlarni uylantiring… Agar ular kambagʻal boʻlsalar, Alloh oʻz fazli bilan ularni boy qiladi» (Nur, 32). 🤲\nXayrli ishni ertaga qoldirmang — anketangizni bugun toʻldiring.',
    'Rasululloh ﷺ: «Nikoh — mening sunnatimdir» (Ibn Moja). 💍\nSunnatga ergashish yoʻlidagi birinchi qadam — toʻliq anketa. Hitaba sizni kutmoqda.',
    'Jiddiy niyatli opa-singillar toʻliq va samimiy anketalarni tanlaydi. ✍️\nOʻzingiz, oilangiz va qadriyatlaringiz haqida yozing — toʻgʻri inson sizni topsin, inshaAlloh.',
  ],
  ru: [
    'Ассаляму алейкум! 🌿\nВаша анкета ждёт вас — это займёт всего 5 минут. Заполните её и знакомьтесь с сёстрами, которые ищут никах, халяльным путём.\nПервая монета — наш подарок! 🎁',
    '«Сочетайте браком одиноких из вас… Если они бедны, Аллах обогатит их по Своей милости» (Ан-Нур, 32). 🤲\nНе откладывайте благое дело — заполните анкету сегодня.',
    'Пророк ﷺ сказал: «Никах — моя сунна» (Ибн Маджа). 💍\nПервый шаг на пути сунны — заполненная анкета. Хитаба ждёт вас.',
    'Сёстры с серьёзными намерениями выбирают полные и искренние анкеты. ✍️\nРасскажите о себе, своей семье и ценностях — пусть нужный человек найдёт вас, ин шаа Аллах.',
  ],
  tr: [
    'Esselâmu aleyküm! 🌿\nProfiliniz sizi bekliyor — sadece 5 dakika sürer. Doldurun ve nikah niyetindeki hanımlarla helal yoldan tanışın.\nİlk jeton bizden hediye! 🎁',
    '«İçinizden bekârları evlendirin… Eğer fakir iseler, Allah onları lütfuyla zenginleştirir» (Nûr, 32). 🤲\nHayırlı işi ertelemeyin — profilinizi bugün doldurun.',
    'Peygamberimiz ﷺ: «Nikah benim sünnetimdir» (İbn Mâce). 💍\nSünnete giden yolda ilk adım: eksiksiz bir profil. Hitaba sizi bekliyor.',
    'Ciddi niyetli hanımlar eksiksiz ve samimi profilleri tercih ediyor. ✍️\nKendinizi, ailenizi ve değerlerinizi yazın — doğru kişi sizi bulsun inşallah.',
  ],
  en: [
    'Assalamu alaikum! 🌿\nYour profile is waiting — it takes only 5 minutes. Complete it and meet sisters seeking nikah, the halal way.\nYour first connect is our gift! 🎁',
    '“Marry off the single among you… If they are poor, Allah will enrich them from His bounty” (An-Nur, 32). 🤲\nDon’t delay a good deed — complete your profile today.',
    'The Prophet ﷺ said: “Nikah is my sunnah” (Ibn Majah). 💍\nThe first step on that path is a complete profile. Hitaba is waiting for you.',
    'Sisters with serious intentions choose complete, sincere profiles. ✍️\nWrite about yourself, your family and your values — so the right person can find you, in sha Allah.',
  ],
  ar: [
    'السلام عليكم! 🌿\nملفك ينتظرك — لا يستغرق سوى 5 دقائق. أكمله وتعرّف على أخوات يبحثن عن الزواج بالطريق الحلال.\nأول عملة هدية منا! 🎁',
    '﴿وَأَنكِحُوا الْأَيَامَىٰ مِنكُمْ … إِن يَكُونُوا فُقَرَاءَ يُغْنِهِمُ اللَّهُ مِن فَضْلِهِ﴾ (النور: 32) 🤲\nلا تؤجّل الخير — أكمل ملفك اليوم.',
    'قال النبي ﷺ: «النكاح من سنتي» (ابن ماجه). 💍\nأول خطوة على طريق السنة: ملف مكتمل. هتابة بانتظارك.',
    'الأخوات الجادّات يخترن الملفات المكتملة والصادقة. ✍️\nاكتب عن نفسك وعائلتك وقيمك — ليجدك الشخص المناسب بإذن الله.',
  ],
};

const FEMALE: Texts = {
  uz: [
    'Assalomu alaykum, aziz opa-singil! 🌸\nHitabada suratingiz yashirin, anketangizni faqat ayol moderator koʻradi, valingiz esa doim yoningizda. Hammasi bepul.\nAnketangizni toʻldiring — xotirjam boʻling. 🤍',
    '«Oʻzingizdan juftlar yaratib, ular bilan orom topishingiz uchun oralaringizda muhabbat va rahmat paydo qilgani ham Uning oyatlaridandir» (Rum, 21). 🌿\nSokinlik va muhabbatga toʻla oila sari birinchi qadam — toʻliq anketa.',
    'Rasululloh ﷺ: «Dunyo — matoʻ, uning eng yaxshi matoʻi solih ayoldir» (Muslim). 🌸\nSizni munosib qadrlaydigan, nikoh niyatidagi insonlar shu yerda. Anketangizni toʻldiring.',
    'Har bir suhbat guvohlar va moderatorlar nazoratida, aloqa maʼlumotlari faqat mahram orqali beriladi. 🛡️\nOdob va hayoni saqlagan holda tanishing. Alloh sizga xayrli juft nasib etsin.',
  ],
  ru: [
    'Ассаляму алейкум, дорогая сестра! 🌸\nВ Хитабе ваше фото скрыто, анкету видит только модератор-женщина, а ваш вали всегда рядом. Всё бесплатно.\nЗаполните анкету — будьте спокойны. 🤍',
    '«Среди Его знамений — то, что Он сотворил из вас самих жён, чтобы вы находили в них успокоение, и установил между вами любовь и милосердие» (Ар-Рум, 21). 🌿\nПервый шаг к семье, полной покоя и любви, — заполненная анкета.',
    'Пророк ﷺ сказал: «Этот мир — благо, а лучшее из его благ — праведная жена» (Муслим). 🌸\nЗдесь те, кто ищет никах и будет ценить вас. Заполните анкету.',
    'Каждая переписка идёт при свидетелях и модераторах, а контакты передаются только через махрама. 🛡️\nЗнакомьтесь, сохраняя скромность и достоинство. Пусть Аллах дарует вам достойного супруга.',
  ],
  tr: [
    'Esselâmu aleyküm, kıymetli kardeşim! 🌸\nHitaba’da fotoğrafınız gizli, profilinizi yalnızca kadın moderatör görür, veliniz her zaman yanınızda. Hepsi ücretsiz.\nProfilinizi doldurun, içiniz rahat olsun. 🤍',
    '«Kendileriyle huzur bulasınız diye size kendi cinsinizden eşler yaratması ve aranızda sevgi ve merhamet var etmesi de O’nun ayetlerindendir» (Rûm, 21). 🌿\nHuzur ve sevgi dolu bir yuvaya ilk adım: eksiksiz bir profil.',
    'Peygamberimiz ﷺ: «Dünya geçici bir faydadır; dünyanın en hayırlı faydası salih kadındır» (Müslim). 🌸\nSizi hak ettiğiniz gibi değerlendirecek, nikah niyetli insanlar burada. Profilinizi doldurun.',
    'Her sohbet şahitler ve moderatörler gözetiminde; iletişim bilgisi yalnızca mahreminiz aracılığıyla paylaşılır. 🛡️\nHaya ve edebinizi koruyarak tanışın. Allah size hayırlı bir eş nasip etsin.',
  ],
  en: [
    'Assalamu alaikum, dear sister! 🌸\nOn Hitaba your photo stays hidden, only a female moderator sees your profile, and your wali is always by your side. It’s all free.\nComplete your profile with peace of mind. 🤍',
    '“And of His signs is that He created for you from yourselves mates that you may find tranquillity in them, and He placed between you affection and mercy” (Ar-Rum, 21). 🌿\nThe first step to a home full of peace and love is a complete profile.',
    'The Prophet ﷺ said: “The world is provision, and the best provision of the world is a righteous woman” (Muslim). 🌸\nPeople seeking nikah who will value you are here. Complete your profile.',
    'Every chat happens before witnesses and moderators, and contact details are shared only through a mahram. 🛡️\nGet to know someone while keeping your modesty. May Allah grant you a righteous spouse.',
  ],
  ar: [
    'السلام عليكم أختي الكريمة! 🌸\nفي هتابة صورتك مخفية، ولا يرى ملفك إلا مشرفة، ووليّك دائمًا بجانبك. وكل ذلك مجاني.\nأكملي ملفك وأنتِ مطمئنة. 🤍',
    '﴿وَمِنْ آيَاتِهِ أَنْ خَلَقَ لَكُم مِّنْ أَنفُسِكُمْ أَزْوَاجًا لِّتَسْكُنُوا إِلَيْهَا وَجَعَلَ بَيْنَكُم مَّوَدَّةً وَرَحْمَةً﴾ (الروم: 21) 🌿\nأول خطوة نحو بيت يملؤه السكن والمودة: ملف مكتمل.',
    'قال النبي ﷺ: «الدنيا متاع، وخير متاع الدنيا المرأة الصالحة» (مسلم). 🌸\nهنا من يبحثون عن الزواج ويقدّرونك. أكملي ملفك.',
    'كل محادثة تجري بحضور الشهود والمشرفين، ولا تُشارك وسائل التواصل إلا عن طريق المحرم. 🛡️\nتعارفي مع الحفاظ على حيائك. رزقكِ الله زوجًا صالحًا.',
  ],
};

/** Yalnızca /start diyenler: cinsiyet bilinmediği için genel davet. */
const STARTER: Texts = {
  uz: [
    'Assalomu alaykum! 🌿\nHitaba — nikoh niyatida halol tanishuv. Ilovani oching, roʻyxatdan oʻting va anketangizni toʻldiring — atigi 5 daqiqa.',
    'Rasululloh ﷺ: «Nikoh — mening sunnatimdir» (Ibn Moja). 💍\nXayrli ishni bugun boshlang — Hitabani oching.',
    'Suratlar yashirin, suhbatlar guvohlar va moderatorlar nazoratida. 🛡️\nHalol yoʻl bilan tanishish uchun Hitabani oching.',
  ],
  ru: [
    'Ассаляму алейкум! 🌿\nХитаба — халяльное знакомство с намерением никаха. Откройте приложение, зарегистрируйтесь и заполните анкету — всего 5 минут.',
    'Пророк ﷺ сказал: «Никах — моя сунна» (Ибн Маджа). 💍\nНачните благое дело сегодня — откройте Хитабу.',
    'Фото скрыты, переписка идёт при свидетелях и модераторах. 🛡️\nОткройте Хитабу, чтобы знакомиться халяльным путём.',
  ],
  tr: [
    'Esselâmu aleyküm! 🌿\nHitaba — nikah niyetiyle helal tanışma. Uygulamayı açın, kaydolun ve profilinizi doldurun — sadece 5 dakika.',
    'Peygamberimiz ﷺ: «Nikah benim sünnetimdir» (İbn Mâce). 💍\nHayırlı işe bugün başlayın — Hitaba’yı açın.',
    'Fotoğraflar gizli, sohbetler şahitler ve moderatörler gözetiminde. 🛡️\nHelal yoldan tanışmak için Hitaba’yı açın.',
  ],
  en: [
    'Assalamu alaikum! 🌿\nHitaba is halal matchmaking with the intention of nikah. Open the app, sign up and complete your profile — just 5 minutes.',
    'The Prophet ﷺ said: “Nikah is my sunnah” (Ibn Majah). 💍\nStart a good deed today — open Hitaba.',
    'Photos stay hidden, and chats happen before witnesses and moderators. 🛡️\nOpen Hitaba to get to know someone the halal way.',
  ],
  ar: [
    'السلام عليكم! 🌿\nهتابة — تعارف حلال بنية الزواج. افتح التطبيق وسجّل وأكمل ملفك — 5 دقائق فقط.',
    'قال النبي ﷺ: «النكاح من سنتي» (ابن ماجه). 💍\nابدأ الخير اليوم — افتح هتابة.',
    'الصور مخفية، والمحادثات بحضور الشهود والمشرفين. 🛡️\nافتح هتابة لتتعرّف بالطريق الحلال.',
  ],
};

const OPEN_LABEL: Record<string, string> = { uz: 'Anketani toʻldirish', ru: 'Заполнить анкету', tr: 'Profili doldur', en: 'Complete profile', ar: 'أكمل الملف' };
const START_LABEL: Record<string, string> = { uz: 'Hitabani ochish', ru: 'Открыть Хитабу', tr: 'Hitaba’yı aç', en: 'Open Hitaba', ar: 'افتح هتابة' };

/** /start diyenlerin saat dilimi bilinmez; dile göre tahmin edilir. */
const STARTER_ZONE: Record<string, string> = { tr: 'Europe/Istanbul', ar: 'Asia/Riyadh' };

/** Akşam, kişinin yerel saatiyle 18:00–21:00 arası; günde en fazla bir kez. */
const SEND_FROM_HOUR = 18;
const SEND_TO_HOUR = 21;
const MIN_GAP_HOURS = 20;

export function nudgeText(kind: Gender | 'STARTER', locale: string, n: number): string {
  const texts = kind === 'STARTER' ? STARTER : kind === 'MALE' ? MALE : FEMALE;
  const list = texts[locale] ?? texts.en;
  return list[n % list.length];
}

/** Telegram'ın "artık ulaşılamaz" yanıtları: kullanıcı botu engellemiş, hesabı silinmiş ya da sohbet yok. */
function unreachable(description?: string) {
  return /blocked|deactivated|chat not found|user not found|Forbidden/i.test(description ?? '');
}

@Injectable()
export class NudgeService {
  private readonly log = new Logger(NudgeService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async tick() {
    if (this.running || !this.telegram.enabled) return;
    this.running = true;
    try {
      await this.run();
    } catch (e) {
      this.log.error((e as Error).message);
    } finally {
      this.running = false;
    }
  }

  async run(now = new Date()) {
    const due = new Date(now.getTime() - hours(MIN_GAP_HOURS));
    const evening = (tz: string) => {
      const h = localHour(tz, now);
      return h >= SEND_FROM_HOUR && h < SEND_TO_HOUR;
    };
    let sent = 0;

    // Uygulamaya girmiş, profilini incelemeye hiç göndermemiş kullanıcılar (kayıttan en az bir gün sonra).
    const users = await this.prisma.user.findMany({
      where: {
        role: 'USER',
        status: 'ONBOARDING',
        telegramId: { not: null },
        botBlockedAt: null,
        createdAt: { lt: due },
        OR: [{ nudgeSentAt: null }, { nudgeSentAt: { lt: due } }],
      },
      select: { id: true, telegramId: true, gender: true, locale: true, timezone: true, nudgeCount: true },
    });
    for (const u of users) {
      if (!evening(u.timezone)) continue;
      const res = await this.telegram.sendMessageRaw(u.telegramId!, nudgeText(u.gender, u.locale, u.nudgeCount), OPEN_LABEL[u.locale] ?? OPEN_LABEL.en);
      if (res.ok) {
        await this.prisma.user.update({ where: { id: u.id }, data: { nudgeSentAt: now, nudgeCount: { increment: 1 } } });
        sent++;
      } else if (unreachable(res.description)) {
        await this.prisma.user.update({ where: { id: u.id }, data: { botBlockedAt: now } });
      }
      await new Promise((r) => setTimeout(r, 60)); // Telegram sınırı: saniyede ~30 mesaj
    }

    // Yalnızca /start diyenler (sonradan hesap açanlar atlanır).
    const starters = await this.prisma.botStarter.findMany({
      where: { blockedAt: null, startedAt: { lt: due }, OR: [{ nudgeSentAt: null }, { nudgeSentAt: { lt: due } }] },
    });
    const registered = new Set(
      (await this.prisma.user.findMany({ where: { telegramId: { in: starters.map((s) => s.chatId) } }, select: { telegramId: true } })).map(
        (u) => u.telegramId,
      ),
    );
    for (const s of starters) {
      if (registered.has(s.chatId) || !evening(STARTER_ZONE[s.locale] ?? 'Asia/Tashkent')) continue;
      const res = await this.telegram.sendMessageRaw(s.chatId, nudgeText('STARTER', s.locale, s.nudgeCount), START_LABEL[s.locale] ?? START_LABEL.en);
      if (res.ok) {
        await this.prisma.botStarter.update({ where: { chatId: s.chatId }, data: { nudgeSentAt: now, nudgeCount: { increment: 1 } } });
        sent++;
      } else if (unreachable(res.description)) {
        await this.prisma.botStarter.update({ where: { chatId: s.chatId }, data: { blockedAt: now } });
      }
      await new Promise((r) => setTimeout(r, 60));
    }
    if (sent) this.log.log(`nudges sent: ${sent}`);
  }
}
