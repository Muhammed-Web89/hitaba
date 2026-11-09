import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { Prisma, User } from '@prisma/client';
import { CONNECT_PACKAGES, INTRO_OFFER, LAUNCH_OFFER, type ConnectPackageId } from '@hitaba/shared';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';

/** Telegram fatura başlığı kullanıcının dilinde: uz "tanga", ru "монета", tr "jeton", ar "عملة". */
function connectsLabel(locale: string, n: number): string {
  const ruForm = new Intl.PluralRules('ru').select(n);
  const arForm = new Intl.PluralRules('ar').select(n);
  switch (locale) {
    case 'uz':
      return `${n} ta tanga`;
    case 'ru':
      return `${n} ${ruForm === 'one' ? 'монета' : ruForm === 'few' ? 'монеты' : 'монет'}`;
    case 'tr':
      return `${n} jeton`;
    case 'ar':
      return n === 1 ? 'عملة واحدة' : n === 2 ? 'عملتان' : `${n} ${arForm === 'few' ? 'عملات' : 'عملة'}`;
    default:
      return `${n} ${n === 1 ? 'connect' : 'connects'}`;
  }
}

type Tx = Prisma.TransactionClient;

@Injectable()
export class ConnectsService {
  private readonly log = new Logger(ConnectsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Kullanıcı tanışma indirimini daha önce (ödenmiş olarak) kullandı mı? */
  private async introUsed(userId: string, db: Tx | PrismaService = this.prisma): Promise<boolean> {
    const n = await db.payment.count({
      where: { userId, packageId: INTRO_OFFER.packageId, amount: INTRO_OFFER.stars, status: 'PAID' },
    });
    return n > 0;
  }

  /** Paketin bu kullanıcı için geçerli fiyatı ve hangi kampanyadan geldiği (indirim sunucuda hesaplanır). */
  private offerFor(pkg: (typeof CONNECT_PACKAGES)[number], introUsed: boolean): { price: number; promo: 'launch' | 'intro' | null } {
    if (LAUNCH_OFFER.active && pkg.id === LAUNCH_OFFER.packageId) return { price: 0, promo: 'launch' };
    if (pkg.id === INTRO_OFFER.packageId && !introUsed) return { price: INTRO_OFFER.stars, promo: 'intro' };
    return { price: pkg.stars, promo: null };
  }

  private async priceFor(userId: string, pkg: (typeof CONNECT_PACKAGES)[number]): Promise<number> {
    return this.offerFor(pkg, await this.introUsed(userId)).price;
  }

  /**
   * Lansman kampanyası: ücretsiz paket fatura açılmadan verilir (Telegram 0 Yıldızlık fatura kabul etmez).
   * Koşullu güncelleme: yalnızca bakiyesi 0 olan alır, aynı anda iki istek gelse bile bir kez verilir.
   */
  async claimFree(user: User, packageId: ConnectPackageId) {
    const pkg = CONNECT_PACKAGES.find((p) => p.id === packageId);
    if (!pkg) throw new NotFoundException();
    if (this.offerFor(pkg, true).price !== 0) throw new BadRequestException({ error: 'offer_unavailable' });
    if (user.gender !== 'MALE') throw new BadRequestException({ error: 'offer_unavailable' });
    const balance = await this.prisma.$transaction(async (tx) => {
      const res = await tx.user.updateMany({ where: { id: user.id, connectBalance: 0 }, data: { connectBalance: { increment: pkg.connects } } });
      if (res.count === 0) throw new BadRequestException({ error: 'free_claim_has_balance' });
      await tx.connectTx.create({ data: { userId: user.id, amount: pkg.connects, type: 'BONUS', note: 'launch_free' } });
      return pkg.connects;
    });
    void this.notifications.refreshTelegramStatus(user.id);
    return { ok: true, balance };
  }

  async overview(user: User) {
    const [txs, introUsed] = await Promise.all([
      this.prisma.connectTx.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 50 }),
      this.introUsed(user.id),
    ]);
    return {
      balance: user.connectBalance,
      // stars: liste fiyatı; price: ödenecek fiyat (indirimliyse daha düşük).
      // promo: hangi kampanya (rozet ve açıklama metni için).
      packages: CONNECT_PACKAGES.map((p) => ({ ...p, ...this.offerFor(p, introUsed) })),
      telegramPayments: this.telegram.enabled,
      transactions: txs.map((t) => ({
        id: t.id,
        amount: t.amount,
        type: t.type,
        chatId: t.chatId,
        note: t.note,
        createdAt: t.createdAt.toISOString(),
      })),
    };
  }

  /** Telegram'a bağlı kullanıcıların sohbetleri ve dilleri (menü düğmesini yenilemek için). */
  telegramChats() {
    return this.prisma.user.findMany({ where: { telegramId: { not: null } }, select: { telegramId: true, locale: true } });
  }

  async userIdByTelegram(telegramId: string): Promise<string | null> {
    const u = await this.prisma.user.findUnique({ where: { telegramId }, select: { id: true } });
    return u?.id ?? null;
  }

  /** Bakiye yarış koşuluna karşı koşullu güncelleme ile düşülür. */
  async spend(tx: Tx, userId: string, amount: number, chatId: string, note: string) {
    const res = await tx.user.updateMany({
      where: { id: userId, connectBalance: { gte: amount } },
      data: { connectBalance: { decrement: amount } },
    });
    if (res.count === 0) throw new BadRequestException({ error: 'insufficient_connects' });
    await tx.connectTx.create({ data: { userId, amount: -amount, type: 'SPEND', chatId, note } });
  }

  async refund(tx: Tx, userId: string, amount: number, chatId: string, note: string) {
    if (amount <= 0) return;
    await tx.user.update({ where: { id: userId }, data: { connectBalance: { increment: amount } } });
    await tx.connectTx.create({ data: { userId, amount, type: 'REFUND', chatId, note } });
  }

  /** Ban cezası: bakiye sıfırlanır, para iadesi yapılmaz (§5.7). */
  async zeroOut(tx: Tx, userId: string) {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.connectBalance <= 0) return;
    await tx.user.update({ where: { id: userId }, data: { connectBalance: 0 } });
    await tx.connectTx.create({ data: { userId, amount: -user.connectBalance, type: 'PENALTY', note: 'ban' } });
  }

  async createTelegramInvoice(user: User, packageId: ConnectPackageId) {
    if (!this.telegram.enabled) throw new ServiceUnavailableException({ error: 'telegram_payments_disabled' });
    const pkg = CONNECT_PACKAGES.find((p) => p.id === packageId);
    if (!pkg) throw new NotFoundException();
    const stars = await this.priceFor(user.id, pkg);
    if (stars === 0) throw new BadRequestException({ error: 'use_free_claim' });
    const payment = await this.prisma.payment.create({
      data: {
        userId: user.id,
        provider: 'TELEGRAM_STARS',
        packageId: pkg.id,
        connects: pkg.connects,
        amount: stars,
        currency: 'XTR',
      },
    });
    const link = await this.telegram.createStarsInvoiceLink({
      title: `Hitaba · ${connectsLabel(user.locale, pkg.connects)}`,
      description: connectsLabel(user.locale, pkg.connects),
      payload: payment.id,
      stars,
    });
    if (!link) throw new ServiceUnavailableException({ error: 'invoice_failed' });
    return { paymentId: payment.id, invoiceLink: link };
  }

  async validatePreCheckout(paymentId: string, currency: string, amount: number): Promise<boolean> {
    const p = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!p || p.status !== 'PENDING' || p.currency !== currency || p.amount !== amount) return false;
    // Birden çok indirimli fatura açılmışsa yalnızca ilki ödenebilir.
    const isIntro = p.packageId === INTRO_OFFER.packageId && p.amount === INTRO_OFFER.stars;
    return !(isIntro && (await this.introUsed(p.userId)));
  }

  /** Telegram successful_payment — providerChargeId benzersiz olduğu için tekrar gelen webhook çift kredilemez. */
  async completeTelegramPayment(p: { paymentId: string; chargeId: string; currency: string; amount: number }) {
    try {
      const userId = await this.prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findUnique({ where: { id: p.paymentId } });
        if (!payment || payment.status !== 'PENDING') return null;
        if (payment.currency !== p.currency || payment.amount !== p.amount) {
          await tx.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
          return null;
        }
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: 'PAID', paidAt: new Date(), providerChargeId: p.chargeId },
        });
        await this.credit(tx, payment.userId, payment.connects, 'PURCHASE', { paymentId: payment.id });
        return payment.userId;
      });
      if (userId) await this.notifications.notify(userId, 'connects_credited', {});
    } catch (e) {
      this.log.error(`payment ${p.paymentId} failed: ${(e as Error).message}`);
    }
  }

  /** Yalnızca geliştirme ortamı (DEV_PAYMENTS=true). */
  async devCredit(user: User, packageId: ConnectPackageId) {
    const pkg = CONNECT_PACKAGES.find((p) => p.id === packageId);
    if (!pkg) throw new NotFoundException();
    await this.prisma.$transaction((tx) => this.credit(tx, user.id, pkg.connects, 'BONUS', { note: 'dev' }));
    return { ok: true };
  }

  private async credit(
    tx: Tx,
    userId: string,
    amount: number,
    type: 'PURCHASE' | 'BONUS',
    extra: { paymentId?: string; note?: string },
  ) {
    await tx.user.update({ where: { id: userId }, data: { connectBalance: { increment: amount } } });
    await tx.connectTx.create({ data: { userId, amount, type, ...extra } });
  }
}
