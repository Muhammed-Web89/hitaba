import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import type { Chat, ChatCloseReason, Match, Message, MessageReaction, Prisma, User } from '@prisma/client';
import {
  ageFromBirthDate,
  RULES,
  scanForContactInfo,
  type ChatMessage,
  type ChatParticipantInfo,
  type ChatSummary,
  type MahramContactInput,
  type Reaction,
} from '@hitaba/shared';
import { decrypt, encrypt } from '../common/crypto';
import { ageRange, hours, minutes } from '../common/time';
import { ConnectsService } from '../connects/connects.service';
import { ModerationService } from '../moderation/moderation.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';

type ChatWithMatch = Chat & { match: Match };
type MessageWithReactions = Message & { reactions: MessageReaction[] };

/** Sistem mesajları anahtar olarak saklanır, istemci çevirir. */
export type SystemMessageKey =
  | 'chat_opened'
  | 'chat_reopened'
  | 'chat_paused_contact'
  | 'chat_resumed'
  | 'silence_reminder_1'
  | 'silence_reminder_2'
  | 'chat_closed_user'
  | 'chat_closed_silence'
  | 'chat_closed_moderator'
  | 'chat_closed_ban';

const OPEN_STATUSES = ['ACTIVE', 'PAUSED'] as const;

@Injectable()
export class ChatService implements OnModuleInit {
  private readonly log = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly connects: ConnectsService,
    private readonly moderation: ModerationService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
  ) {}

  onModuleInit() {
    this.moderation.register('MESSAGE', {
      apply: async ({ item, approved }) => {
        const msg = await this.prisma.message.update({
          where: { id: item.targetId },
          data: { state: approved ? 'DELIVERED' : 'REJECTED' },
          include: { reactions: true },
        });
        if (approved) this.realtime.toChat(msg.chatId, 'message:new', toChatMessage(msg));
        else this.realtime.toChat(msg.chatId, 'message:updated', toChatMessage(msg));
        await this.resumeIfClear(msg.chatId);
      },
      context: async (item, moderator) => {
        const msg = await this.prisma.message.findUnique({ where: { id: item.targetId } });
        if (!msg) return null;
        return { message: msg, transcript: await this.transcriptForModerator(moderator, msg.chatId) };
      },
    });

    this.moderation.register('MAHRAM_CONTACT', {
      apply: async ({ item, moderator, approved }) => {
        const mc = await this.prisma.mahramContact.update({
          where: { id: item.targetId },
          data: { status: approved ? 'APPROVED' : 'REJECTED', decidedById: moderator.id, decidedAt: new Date() },
        });
        if (!approved) {
          await this.notifications.notify(mc.submittedById, 'mahram_rejected', { chatId: mc.chatId });
          return;
        }
        const payload = { name: mc.name, relation: mc.relation, contact: decrypt(mc.contactEnc), note: mc.note };
        const msg = await this.prisma.message.create({
          data: { chatId: mc.chatId, senderId: mc.submittedById, kind: 'MAHRAM_CONTACT', text: JSON.stringify(payload) },
          include: { reactions: true },
        });
        const chat = await this.prisma.chat.update({
          where: { id: mc.chatId },
          data: { mahramSharedAt: new Date(), lastActivityAt: new Date() },
          include: { match: true },
        });
        this.realtime.toChat(chat.id, 'message:new', toChatMessage(msg));
        await Promise.all(
          [chat.match.maleId, chat.match.femaleId].map((u) => this.notifications.notify(u, 'mahram_approved', { chatId: chat.id })),
        );
      },
      context: async (item) => {
        const mc = await this.prisma.mahramContact.findUnique({ where: { id: item.targetId } });
        if (!mc) return null;
        const { contactEnc, ...rest } = mc;
        return { mahramContact: { ...rest, contact: decrypt(contactEnc) } };
      },
    });
  }

  // ── Açma / kapama ─────────────────────────────────────────────────────

  /** Erkek 1 connect harcayarak sohbeti açar (§5.5). Kadının aynı anda tek aktif sohbeti olabilir. */
  async open(viewer: User, matchId: string): Promise<ChatSummary> {
    if (viewer.gender !== 'MALE') throw new ForbiddenException({ error: 'only_brother_opens' });
    const match = await this.prisma.match.findUnique({ where: { id: matchId }, include: { chat: true, female: true } });
    if (!match || match.maleId !== viewer.id) throw new NotFoundException();
    if (match.stage !== 'PHOTO_APPROVED' || match.chat) throw new BadRequestException({ error: 'invalid_stage' });
    if (match.female.status !== 'APPROVED') throw new BadRequestException({ error: 'counterpart_unavailable' });

    const [maleModeratorId, femaleModeratorId] = await Promise.all([this.pickModerator('MALE'), this.pickModerator('FEMALE')]);

    const { chat, sys } = await this.prisma.$transaction(async (tx) => {
      await this.lockFemale(tx, match.femaleId);
      await this.assertFemaleFree(tx, match.femaleId);
      const chat = await tx.chat.create({
        data: { matchId, openedById: viewer.id, connectSpent: RULES.chatOpenCost, maleModeratorId, femaleModeratorId },
      });
      await this.connects.spend(tx, viewer.id, RULES.chatOpenCost, chat.id, 'chat_open');
      await tx.match.update({ where: { id: matchId }, data: { stage: 'CHAT_OPEN' } });
      return { chat, sys: await this.systemMessage(tx, chat.id, 'chat_opened') };
    });
    this.emitNew(sys);

    await this.notifications.notify(match.femaleId, 'chat_opened', { chatId: chat.id });
    return this.summary(viewer, chat.id);
  }

  /** Kapanan sohbet bir kez, 1 connect karşılığı yeniden açılabilir. */
  async reopen(viewer: User, chatId: string): Promise<ChatSummary> {
    const chat = await this.participantChat(viewer, chatId);
    if (!this.canReopen(viewer, chat)) throw new BadRequestException({ error: 'cannot_reopen' });

    const sys = await this.prisma.$transaction(async (tx) => {
      await this.lockFemale(tx, chat.match.femaleId);
      await this.assertFemaleFree(tx, chat.match.femaleId);
      await this.connects.spend(tx, viewer.id, RULES.chatReopenCost, chat.id, 'chat_reopen');
      await tx.chat.update({
        where: { id: chat.id },
        data: {
          status: 'ACTIVE',
          closeReason: null,
          closedAt: null,
          closedById: null,
          reopenCount: { increment: 1 },
          connectSpent: { increment: RULES.chatReopenCost },
          lastActivityAt: new Date(),
          reminder1SentAt: null,
          reminder2SentAt: null,
        },
      });
      return this.systemMessage(tx, chat.id, 'chat_reopened');
    });
    this.emitNew(sys);
    this.emitStatus(chat.id);
    await this.notifications.notify(chat.match.femaleId, 'chat_opened', { chatId: chat.id });
    return this.summary(viewer, chat.id);
  }

  async closeByUser(viewer: User, chatId: string) {
    const chat = await this.participantChat(viewer, chatId);
    if (chat.status === 'CLOSED') return this.summary(viewer, chatId);
    await this.close(chat, 'USER', viewer.id);
    return this.summary(viewer, chatId);
  }

  /**
   * Sohbeti kapatır. Moderatör kapatması ve karşı tarafın banlanmasında açan tarafa
   * harcadığı connect otomatik iade edilir (§5.7).
   */
  async close(chat: ChatWithMatch, reason: ChatCloseReason, closedById: string | null, refundOpener = false) {
    const key: SystemMessageKey =
      reason === 'USER' ? 'chat_closed_user' : reason === 'SILENCE' ? 'chat_closed_silence' : reason === 'BAN' ? 'chat_closed_ban' : 'chat_closed_moderator';
    const sys = await this.prisma.$transaction(async (tx) => {
      await tx.chat.update({
        where: { id: chat.id },
        data: { status: 'CLOSED', closeReason: reason, closedById, closedAt: new Date(), pausedReason: null },
      });
      if (refundOpener) await this.connects.refund(tx, chat.openedById, chat.connectSpent, chat.id, `refund_${reason.toLowerCase()}`);
      return this.systemMessage(tx, chat.id, key);
    });
    this.emitNew(sys);
    this.emitStatus(chat.id);
    await Promise.all(
      [chat.match.maleId, chat.match.femaleId]
        .filter((u) => u !== closedById)
        .map((u) => this.notifications.notify(u, 'chat_closed', { chatId: chat.id, reason })),
    );
  }

  /** Ban: kullanıcının tüm açık sohbetleri kapanır; karşı taraf açtıysa ona iade yapılır. */
  async closeAllForBan(userId: string, moderatorId: string) {
    const chats = await this.prisma.chat.findMany({
      where: { status: { in: [...OPEN_STATUSES] }, match: { OR: [{ maleId: userId }, { femaleId: userId }] } },
      include: { match: true },
    });
    for (const chat of chats) await this.close(chat, 'BAN', moderatorId, chat.openedById !== userId);
  }

  async extend(viewer: User, chatId: string) {
    const chat = await this.participantChat(viewer, chatId);
    if (chat.status !== 'ACTIVE') throw new BadRequestException({ error: 'chat_not_active' });
    await this.prisma.chat.update({
      where: { id: chatId },
      data: { lastActivityAt: new Date(), reminder1SentAt: null, reminder2SentAt: null },
    });
    return this.summary(viewer, chatId);
  }

  // ── Mesajlar ──────────────────────────────────────────────────────────

  async send(viewer: User, chatId: string, text: string, clientId?: string): Promise<ChatMessage> {
    const chat = await this.participantChat(viewer, chatId);
    if (chat.status === 'CLOSED') throw new BadRequestException({ error: 'chat_closed' });
    if (chat.status === 'PAUSED') throw new BadRequestException({ error: 'chat_paused' });
    const trimmed = text.trim().slice(0, RULES.messageMaxChars);
    if (!trimmed) throw new BadRequestException({ error: 'empty_message' });

    const scan = scanForContactInfo(trimmed);
    const msg = await this.prisma.message.create({
      data: {
        chatId,
        senderId: viewer.id,
        text: trimmed,
        clientId: clientId ?? null,
        state: scan.blocked ? 'HELD' : 'DELIVERED',
        contactSignals: scan.signals,
      },
      include: { reactions: true },
    });

    if (scan.blocked) {
      await this.holdForModeration(viewer, chat, msg, scan.signals);
    } else {
      await this.prisma.chat.update({
        where: { id: chatId },
        data: { lastActivityAt: new Date(), reminder1SentAt: null, reminder2SentAt: null },
      });
      this.realtime.toChat(chatId, 'message:new', toChatMessage(msg));
    }
    return toChatMessage(msg);
  }

  async edit(viewer: User, messageId: string, text: string): Promise<ChatMessage> {
    const msg = await this.ownMessage(viewer, messageId);
    if (msg.kind !== 'TEXT' || msg.state !== 'DELIVERED' || msg.deletedAt) throw new BadRequestException({ error: 'not_editable' });
    if (Date.now() - msg.createdAt.getTime() > minutes(RULES.messageEditWindowMinutes)) {
      throw new BadRequestException({ error: 'edit_window_passed' });
    }
    const chat = await this.participantChat(viewer, msg.chatId);
    if (chat.status !== 'ACTIVE') throw new BadRequestException({ error: 'chat_not_active' });

    const trimmed = text.trim().slice(0, RULES.messageMaxChars);
    const scan = scanForContactInfo(trimmed);
    const updated = await this.prisma.message.update({
      where: { id: msg.id },
      data: {
        text: trimmed,
        editedAt: new Date(),
        history: { push: msg.text },
        state: scan.blocked ? 'HELD' : 'DELIVERED',
        contactSignals: scan.signals,
      },
      include: { reactions: true },
    });
    if (scan.blocked) {
      // Karşı tarafta önceki sürüm de gizlenir (tutulmuş mesaj teslim edilmemiş sayılır).
      this.realtime.toChat(chat.id, 'message:updated', { ...toChatMessage(updated), text: '', deleted: true });
      await this.holdForModeration(viewer, chat, updated, scan.signals);
    } else {
      this.realtime.toChat(chat.id, 'message:updated', toChatMessage(updated));
    }
    return toChatMessage(updated);
  }

  async remove(viewer: User, messageId: string): Promise<ChatMessage> {
    const msg = await this.ownMessage(viewer, messageId);
    if (msg.kind !== 'TEXT') throw new BadRequestException({ error: 'not_deletable' });
    const updated = await this.prisma.message.update({
      where: { id: msg.id },
      data: { deletedAt: new Date() },
      include: { reactions: true },
    });
    this.realtime.toChat(msg.chatId, 'message:updated', toChatMessage(updated));
    return toChatMessage(updated);
  }

  async react(viewer: User, messageId: string, reaction: Reaction | null): Promise<ChatMessage> {
    const msg = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!msg || msg.state !== 'DELIVERED' || msg.deletedAt) throw new NotFoundException();
    await this.participantChat(viewer, msg.chatId);
    if (reaction) {
      await this.prisma.messageReaction.upsert({
        where: { messageId_userId: { messageId, userId: viewer.id } },
        create: { messageId, userId: viewer.id, reaction },
        update: { reaction },
      });
    } else {
      await this.prisma.messageReaction.deleteMany({ where: { messageId, userId: viewer.id } });
    }
    const updated = await this.prisma.message.findUniqueOrThrow({ where: { id: messageId }, include: { reactions: true } });
    this.realtime.toChat(msg.chatId, 'message:updated', toChatMessage(updated));
    return toChatMessage(updated);
  }

  /** Katılımcı görünümü: teslim edilmiş mesajlar + kendi tutulmuş mesajları; silinenler boş gösterilir. */
  async messages(viewer: User, chatId: string, before?: string): Promise<ChatMessage[]> {
    await this.participantChat(viewer, chatId);
    const rows = await this.prisma.message.findMany({
      where: {
        chatId,
        OR: [{ state: 'DELIVERED' }, { senderId: viewer.id, state: { in: ['HELD', 'REJECTED'] } }],
        ...(before && { createdAt: { lt: new Date(before) } }),
      },
      include: { reactions: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.reverse().map(toChatMessage);
  }

  /** Moderatör görünümü: her şey — silinen, düzenleme geçmişi, tutulmuş mesajlar. Erişim loglanır. */
  async transcriptForModerator(moderator: User, chatId: string) {
    await this.moderation.audit(moderator.id, 'chat.read', { targetType: 'CHAT', targetId: chatId });
    return this.prisma.message.findMany({
      where: { chatId },
      include: { reactions: true, sender: { select: { id: true, gender: true } } },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });
  }

  // ── Mahrem iletişim paylaşımı (§5.6) ─────────────────────────────────

  async submitMahramContact(viewer: User, chatId: string, input: MahramContactInput) {
    const chat = await this.participantChat(viewer, chatId);
    if (chat.status !== 'ACTIVE') throw new BadRequestException({ error: 'chat_not_active' });
    const pending = await this.prisma.mahramContact.count({ where: { chatId, submittedById: viewer.id, status: 'PENDING' } });
    if (pending) throw new BadRequestException({ error: 'mahram_pending' });
    const mc = await this.prisma.mahramContact.create({
      data: {
        chatId,
        submittedById: viewer.id,
        name: input.name,
        relation: input.relation,
        contactEnc: encrypt(input.contact),
        note: input.note ?? null,
      },
    });
    await this.moderation.enqueue({
      targetType: 'MAHRAM_CONTACT',
      targetId: mc.id,
      subjectUserId: viewer.id,
      subjectGender: viewer.gender,
    });
    return { id: mc.id, status: mc.status };
  }

  // ── Listeleme ─────────────────────────────────────────────────────────

  async list(viewer: User): Promise<ChatSummary[]> {
    const chats = await this.prisma.chat.findMany({
      where: { match: viewer.gender === 'MALE' ? { maleId: viewer.id } : { femaleId: viewer.id } },
      orderBy: { lastActivityAt: 'desc' },
      take: 50,
      select: { id: true },
    });
    return Promise.all(chats.map((c) => this.summary(viewer, c.id)));
  }

  async summary(viewer: User, chatId: string): Promise<ChatSummary> {
    const chat = await this.participantChat(viewer, chatId);
    const otherId = viewer.id === chat.match.maleId ? chat.match.femaleId : chat.match.maleId;
    const [other, last, witnesses, wali] = await Promise.all([
      this.prisma.profile.findUnique({ where: { userId: otherId } }),
      this.prisma.message.findFirst({
        where: { chatId, state: 'DELIVERED', deletedAt: null },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.witness.findMany({ where: { femaleId: chat.match.femaleId }, select: { relation: true } }),
      this.prisma.waliLink.findUnique({ where: { femaleId: chat.match.femaleId }, select: { id: true } }),
    ]);
    const watchers: ChatParticipantInfo = {
      maleModerator: Boolean(chat.maleModeratorId),
      femaleModerator: Boolean(chat.femaleModeratorId),
      aiModerator: true,
      witnesses,
      hasWali: Boolean(wali),
    };
    return {
      id: chat.id,
      matchId: chat.matchId,
      status: chat.status,
      pausedReason: chat.pausedReason,
      closeReason: chat.closeReason,
      other: {
        userId: otherId,
        displayName: other?.displayName ?? '',
        ageRange: other?.birthDate ? ageRange(ageFromBirthDate(other.birthDate)) : '',
        city: other?.city ?? '',
      },
      lastMessage: last
        ? { text: last.kind === 'TEXT' ? last.text : `#${last.kind === 'SYSTEM' ? last.text : 'mahram'}`, at: last.createdAt.toISOString(), mine: last.senderId === viewer.id }
        : null,
      lastActivityAt: chat.lastActivityAt.toISOString(),
      canReopen: this.canReopen(viewer, chat),
      watchers,
    };
  }

  // ── Sessizlik kuralı (§5.5): 24 sa hatırlatma, 48 sa ikinci hatırlatma, 72 sa kapanış ─────

  async runSilenceRules(now = new Date()) {
    const at = (h: number) => new Date(now.getTime() - hours(h));

    const toClose = await this.prisma.chat.findMany({
      where: { status: 'ACTIVE', lastActivityAt: { lt: at(RULES.silenceAutoCloseHours) } },
      include: { match: true },
    });
    for (const chat of toClose) await this.close(chat, 'SILENCE', null);

    for (const [field, h, key] of [
      ['reminder2SentAt', RULES.silenceSecondReminderHours, 'silence_reminder_2'],
      ['reminder1SentAt', RULES.silenceFirstReminderHours, 'silence_reminder_1'],
    ] as const) {
      const chats = await this.prisma.chat.findMany({
        where: { status: 'ACTIVE', lastActivityAt: { lt: at(h) }, [field]: null },
        include: { match: true },
      });
      for (const chat of chats) {
        const sys = await this.prisma.$transaction(async (tx) => {
          await tx.chat.update({
            where: { id: chat.id },
            // İkinci hatırlatma gönderildiyse birincisi de gönderilmiş sayılır.
            data: { [field]: now, ...(field === 'reminder2SentAt' && { reminder1SentAt: chat.reminder1SentAt ?? now }) },
          });
          return this.systemMessage(tx, chat.id, key);
        });
        this.emitNew(sys);
        await Promise.all(
          [chat.match.maleId, chat.match.femaleId].map((u) => this.notifications.notify(u, 'silence_reminder', { chatId: chat.id })),
        );
      }
    }
    if (toClose.length) this.log.log(`silence: closed ${toClose.length} chats`);
  }

  // ── Yardımcılar ───────────────────────────────────────────────────────

  async participantChat(viewer: User, chatId: string): Promise<ChatWithMatch> {
    const chat = await this.prisma.chat.findUnique({ where: { id: chatId }, include: { match: true } });
    if (!chat || (chat.match.maleId !== viewer.id && chat.match.femaleId !== viewer.id)) throw new NotFoundException();
    return chat;
  }

  private canReopen(viewer: User, chat: Chat & { match: Match }): boolean {
    return (
      viewer.id === chat.match.maleId &&
      chat.status === 'CLOSED' &&
      chat.reopenCount < 1 &&
      // Kız kardeş kapattıysa ya da moderatör kapattıysa yeniden açılamaz.
      (chat.closeReason === 'SILENCE' || (chat.closeReason === 'USER' && chat.closedById === viewer.id))
    );
  }

  private async holdForModeration(viewer: User, chat: Chat, msg: Message, signals: string[]) {
    const sys = await this.prisma.$transaction(async (tx) => {
      await tx.chat.update({ where: { id: chat.id }, data: { status: 'PAUSED', pausedReason: 'contact_info' } });
      return chat.status !== 'PAUSED' ? this.systemMessage(tx, chat.id, 'chat_paused_contact') : null;
    });
    if (sys) this.emitNew(sys);
    await this.moderation.enqueue({
      targetType: 'MESSAGE',
      targetId: msg.id,
      subjectUserId: viewer.id,
      subjectGender: viewer.gender,
      aiFlags: signals.map((s) => `contact:${s.toLowerCase()}`),
    });
    this.realtime.toUser(viewer.id, 'message:held', { chatId: chat.id, clientId: msg.clientId, signals });
    this.emitStatus(chat.id);
  }

  /** Tutulmuş mesaj kalmadıysa duraklatılmış sohbet yeniden açılır. */
  private async resumeIfClear(chatId: string) {
    const chat = await this.prisma.chat.findUnique({ where: { id: chatId }, include: { match: true } });
    if (!chat || chat.status !== 'PAUSED' || chat.pausedReason !== 'contact_info') return;
    const held = await this.prisma.message.count({ where: { chatId, state: 'HELD' } });
    if (held) return;
    const sys = await this.prisma.$transaction(async (tx) => {
      await tx.chat.update({
        where: { id: chatId },
        data: { status: 'ACTIVE', pausedReason: null, lastActivityAt: new Date(), reminder1SentAt: null, reminder2SentAt: null },
      });
      return this.systemMessage(tx, chatId, 'chat_resumed');
    });
    this.emitNew(sys);
    this.emitStatus(chatId);
  }

  /** İşlem içinde oluşturulur; çağıran, işlem tamamlandıktan sonra `emitNew` ile yayınlar. */
  private systemMessage(tx: Prisma.TransactionClient, chatId: string, key: SystemMessageKey) {
    return tx.message.create({ data: { chatId, kind: 'SYSTEM', text: key }, include: { reactions: true } });
  }

  private emitNew(msg: MessageWithReactions) {
    this.realtime.toChat(msg.chatId, 'message:new', toChatMessage(msg));
  }

  private emitStatus(chatId: string) {
    void this.prisma.chat.findUnique({ where: { id: chatId } }).then((c) => {
      if (c) this.realtime.toChat(chatId, 'chat:updated', { chatId, status: c.status, pausedReason: c.pausedReason });
    });
  }

  private async ownMessage(viewer: User, messageId: string) {
    const msg = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!msg || msg.senderId !== viewer.id) throw new NotFoundException();
    return msg;
  }

  /** Aynı kadın için eşzamanlı sohbet açılışlarını sıraya sokar. */
  private async lockFemale(tx: Prisma.TransactionClient, femaleId: string) {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${femaleId}))::text AS locked`;
  }

  private async assertFemaleFree(tx: Prisma.TransactionClient, femaleId: string) {
    const active = await tx.chat.count({ where: { status: { in: [...OPEN_STATUSES] }, match: { femaleId } } });
    if (active >= RULES.femaleMaxActiveChats) throw new BadRequestException({ error: 'sister_busy' });
  }

  /** En az açık sohbeti olan aktif moderatör. */
  private async pickModerator(gender: 'MALE' | 'FEMALE'): Promise<string | null> {
    const mods = await this.prisma.user.findMany({
      where: { role: { in: ['MODERATOR', 'ADMIN'] }, gender, status: { notIn: ['BANNED', 'DELETED', 'FROZEN'] } },
      select: { id: true },
    });
    if (!mods.length) return null;
    const field = gender === 'MALE' ? 'maleModeratorId' : 'femaleModeratorId';
    const loads = await this.prisma.chat.groupBy({
      by: [field],
      where: { status: { in: [...OPEN_STATUSES] }, [field]: { in: mods.map((m) => m.id) } },
      _count: true,
    });
    const load = new Map(loads.map((l) => [(l as Record<string, unknown>)[field] as string, l._count]));
    return mods.reduce((best, m) => ((load.get(m.id) ?? 0) < (load.get(best.id) ?? 0) ? m : best)).id;
  }
}

export function toChatMessage(m: MessageWithReactions): ChatMessage {
  const deleted = Boolean(m.deletedAt);
  return {
    id: m.id,
    chatId: m.chatId,
    senderId: m.senderId,
    kind: m.kind,
    state: m.state,
    text: deleted ? '' : m.text,
    editedAt: m.editedAt?.toISOString() ?? null,
    deleted,
    createdAt: m.createdAt.toISOString(),
    reactions: m.reactions.map((r) => ({ userId: r.userId, reaction: r.reaction })),
    clientId: m.clientId,
  };
}
