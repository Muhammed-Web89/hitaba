import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Gender, ModerationItem, ModerationTarget, User } from '@prisma/client';
import type { ModerationDecisionInput } from '@hitaba/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface DecisionContext {
  item: ModerationItem;
  /** Otomatik kararda null. */
  moderator: User | null;
  approved: boolean;
  reason: string | null;
}

/** Her hedef türünün sahibi olan modül kararın etkisini ve inceleme bağlamını sağlar. */
export interface ModerationHandler {
  apply(ctx: DecisionContext): Promise<void>;
  context(item: ModerationItem, moderator: User): Promise<unknown>;
}

/** Fotoğraflar katı biçimde cinsiyete bölünür: kadın fotoğrafını yalnızca kadın moderatör görür. */
const GENDER_STRICT: ModerationTarget[] = ['PHOTO'];

/** Kadın moderatörler erkek profillerinin onayını da görmez; yalnızca kadın profillerine ve sohbet denetimine katılır. */
function segregated(moderator: User): ModerationTarget[] {
  return moderator.role === 'MODERATOR' && moderator.gender === 'FEMALE' ? [...GENDER_STRICT, 'PROFILE'] : GENDER_STRICT;
}

@Injectable()
export class ModerationService {
  private readonly handlers = new Map<ModerationTarget, ModerationHandler>();

  constructor(private readonly prisma: PrismaService) {}

  register(target: ModerationTarget, handler: ModerationHandler) {
    this.handlers.set(target, handler);
  }

  /** Aynı hedef için bekleyen kayıt varsa yenisini açmaz, bayrakları günceller. */
  async enqueue(p: {
    targetType: ModerationTarget;
    targetId: string;
    subjectUserId: string;
    subjectGender: Gender;
    aiFlags?: string[];
  }) {
    const pending = await this.prisma.moderationItem.findFirst({
      where: { targetType: p.targetType, targetId: p.targetId, status: 'PENDING' },
    });
    if (pending) {
      return this.prisma.moderationItem.update({ where: { id: pending.id }, data: { aiFlags: p.aiFlags ?? [] } });
    }
    return this.prisma.moderationItem.create({ data: { ...p, aiFlags: p.aiFlags ?? [] } });
  }

  async queue(moderator: User, targetType?: ModerationTarget) {
    const items = await this.prisma.moderationItem.findMany({
      where: { status: 'PENDING', ...(targetType && { targetType }), OR: this.visibilityFilter(moderator) },
      // Mesaj ve mahrem bilgisi sohbeti durdurduğu için önce gelir.
      orderBy: [{ createdAt: 'asc' }],
      take: 100,
    });
    const priority: Record<ModerationTarget, number> = { MESSAGE: 0, MAHRAM_CONTACT: 1, CHAT_EXTENSION: 2, PROFILE: 3, PHOTO: 4 };
    return items.sort((a, b) => priority[a.targetType] - priority[b.targetType]);
  }

  async counts(moderator: User) {
    const rows = await this.prisma.moderationItem.groupBy({
      by: ['targetType'],
      where: { status: 'PENDING', OR: this.visibilityFilter(moderator) },
      _count: true,
    });
    return Object.fromEntries(rows.map((r) => [r.targetType, r._count]));
  }

  async detail(moderator: User, id: string) {
    const item = await this.getVisible(moderator, id);
    const handler = this.handlers.get(item.targetType);
    await this.audit(moderator.id, 'moderation.view', item);
    return { item, context: handler ? await handler.context(item, moderator) : null };
  }

  async decide(moderator: User, id: string, input: ModerationDecisionInput) {
    const item = await this.getVisible(moderator, id);
    if (item.status !== 'PENDING') throw new ForbiddenException({ error: 'already_decided' });
    const approved = input.decision === 'APPROVE';
    const reason = input.reason?.trim() || null;

    const updated = await this.prisma.moderationItem.update({
      where: { id },
      data: {
        status: approved ? 'APPROVED' : 'REJECTED',
        decidedById: moderator.id,
        decidedAt: new Date(),
        reason,
      },
    });
    await this.handlers.get(item.targetType)?.apply({ item: updated, moderator, approved, reason });
    await this.audit(moderator.id, approved ? 'moderation.approve' : 'moderation.reject', item, { reason });
    return updated;
  }

  /** Kural tabanlı kesin ret (ör. anlamsız profil metni): moderatör beklemeden karar verilir. */
  async autoReject(item: ModerationItem, reason: string) {
    const updated = await this.prisma.moderationItem.update({
      where: { id: item.id },
      data: { status: 'REJECTED', decidedAt: new Date(), reason },
    });
    await this.handlers.get(item.targetType)?.apply({ item: updated, moderator: null, approved: false, reason });
    await this.audit(null, 'moderation.auto_reject', item, { reason });
    return updated;
  }

  audit(actorId: string | null, action: string, target: { targetType: string; targetId: string }, meta: object = {}) {
    return this.prisma.auditLog.create({
      data: { actorId, action, targetType: target.targetType, targetId: target.targetId, meta },
    });
  }

  private visibilityFilter(moderator: User) {
    const strict = segregated(moderator);
    return [
      { targetType: { notIn: strict } },
      { targetType: { in: strict }, subjectGender: moderator.gender },
    ];
  }

  private async getVisible(moderator: User, id: string) {
    const item = await this.prisma.moderationItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException();
    if (segregated(moderator).includes(item.targetType) && item.subjectGender !== moderator.gender) {
      throw new ForbiddenException({ error: 'gender_segregated' });
    }
    return item;
  }
}
