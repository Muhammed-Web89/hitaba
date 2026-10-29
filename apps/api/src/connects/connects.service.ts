import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { Prisma, User } from '@prisma/client';
import { CONNECT_PACKAGES, type ConnectPackageId } from '@hitaba/shared';
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

  async overview(user: User) {
    const txs = await this.prisma.connectTx.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return {
      balance: user.connectBalance,
      packages: CONNECT_PACKAGES,
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
    const payment = await this.prisma.payment.create({
      data: {
        userId: user.id,
        provider: 'TELEGRAM_STARS',
        packageId: pkg.id,
        connects: pkg.connects,
        amount: pkg.stars,
        currency: 'XTR',
      },
    });
    const link = await this.telegram.createStarsInvoiceLink({
      title: `Hitaba · ${connectsLabel(user.locale, pkg.connects)}`,
      description: connectsLabel(user.locale, pkg.connects),
      payload: payment.id,
      stars: pkg.stars,
    });
    if (!link) throw new ServiceUnavailableException({ error: 'invoice_failed' });
    return { paymentId: payment.id, invoiceLink: link };
  }

  async validatePreCheckout(paymentId: string, currency: string, amount: number): Promise<boolean> {
    const p = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    return Boolean(p && p.status === 'PENDING' && p.currency === currency && p.amount === amount);
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
