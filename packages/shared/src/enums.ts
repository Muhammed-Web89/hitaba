/** Prisma enum'larıyla birebir aynı tutulmalı (apps/api/prisma/schema.prisma). */

export const Gender = { MALE: 'MALE', FEMALE: 'FEMALE' } as const;
export type Gender = (typeof Gender)[keyof typeof Gender];

export const Role = {
  USER: 'USER',
  MODERATOR: 'MODERATOR',
  ADMIN: 'ADMIN',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const UserStatus = {
  ONBOARDING: 'ONBOARDING',
  PENDING_MODERATION: 'PENDING_MODERATION',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  FROZEN: 'FROZEN',
  BANNED: 'BANNED',
  DELETED: 'DELETED',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const MaritalStatus = {
  NEVER_MARRIED: 'NEVER_MARRIED',
  DIVORCED: 'DIVORCED',
  WIDOWED: 'WIDOWED',
  MARRIED: 'MARRIED',
} as const;
export type MaritalStatus = (typeof MaritalStatus)[keyof typeof MaritalStatus];

export const PolygamyAnswer = { YES: 'YES', NO: 'NO', PREFER_NOT_TO_SAY: 'PREFER_NOT_TO_SAY' } as const;
export type PolygamyAnswer = (typeof PolygamyAnswer)[keyof typeof PolygamyAnswer];

export const ModerationStatus = { PENDING: 'PENDING', APPROVED: 'APPROVED', REJECTED: 'REJECTED' } as const;
export type ModerationStatus = (typeof ModerationStatus)[keyof typeof ModerationStatus];

/**
 * Eşleşme aşamaları (§5.4):
 * MUTUAL — iki taraf da beğendi; kadın erkeğin fotoğrafını görür ve karar verir
 * PHOTO_APPROVED — kadın onayladı; erkek 24 saat boyunca kadının fotoğrafını görür, sohbet açabilir
 * CHAT_OPEN — erkek connect harcayarak sohbeti açtı
 * CLOSED — taraflardan biri reddetti ya da sohbet kapandı
 */
export const MatchStage = {
  MUTUAL: 'MUTUAL',
  PHOTO_APPROVED: 'PHOTO_APPROVED',
  CHAT_OPEN: 'CHAT_OPEN',
  CLOSED: 'CLOSED',
} as const;
export type MatchStage = (typeof MatchStage)[keyof typeof MatchStage];

export const ChatStatus = {
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  CLOSED: 'CLOSED',
} as const;
export type ChatStatus = (typeof ChatStatus)[keyof typeof ChatStatus];

export const ChatCloseReason = {
  USER: 'USER',
  SILENCE: 'SILENCE',
  MODERATOR: 'MODERATOR',
  BAN: 'BAN',
} as const;
export type ChatCloseReason = (typeof ChatCloseReason)[keyof typeof ChatCloseReason];

export const MessageKind = {
  TEXT: 'TEXT',
  SYSTEM: 'SYSTEM',
  MAHRAM_CONTACT: 'MAHRAM_CONTACT',
} as const;
export type MessageKind = (typeof MessageKind)[keyof typeof MessageKind];

export const MessageState = {
  DELIVERED: 'DELIVERED',
  HELD: 'HELD',
  REJECTED: 'REJECTED',
} as const;
export type MessageState = (typeof MessageState)[keyof typeof MessageState];

export const ModerationTarget = {
  PROFILE: 'PROFILE',
  PHOTO: 'PHOTO',
  MESSAGE: 'MESSAGE',
  MAHRAM_CONTACT: 'MAHRAM_CONTACT',
} as const;
export type ModerationTarget = (typeof ModerationTarget)[keyof typeof ModerationTarget];

export const ReportCategory = {
  FAKE_PROFILE: 'FAKE_PROFILE',
  INAPPROPRIATE: 'INAPPROPRIATE',
  CONTACT_SHARING: 'CONTACT_SHARING',
  NOT_SERIOUS: 'NOT_SERIOUS',
  MINOR: 'MINOR',
  OTHER: 'OTHER',
} as const;
export type ReportCategory = (typeof ReportCategory)[keyof typeof ReportCategory];

export const ConnectTxType = {
  PURCHASE: 'PURCHASE',
  SPEND: 'SPEND',
  REFUND: 'REFUND',
  BONUS: 'BONUS',
  PENALTY: 'PENALTY',
} as const;
export type ConnectTxType = (typeof ConnectTxType)[keyof typeof ConnectTxType];

export const Relation = {
  FATHER: 'FATHER',
  BROTHER: 'BROTHER',
  UNCLE: 'UNCLE',
  GRANDFATHER: 'GRANDFATHER',
  SON: 'SON',
  MOTHER: 'MOTHER',
  SISTER: 'SISTER',
  AUNT: 'AUNT',
  FRIEND: 'FRIEND',
  OTHER: 'OTHER',
} as const;
export type Relation = (typeof Relation)[keyof typeof Relation];

export const ReportStatus = { OPEN: 'OPEN', RESOLVED: 'RESOLVED', DISMISSED: 'DISMISSED' } as const;
export type ReportStatus = (typeof ReportStatus)[keyof typeof ReportStatus];

export const PaymentStatus = { PENDING: 'PENDING', PAID: 'PAID', FAILED: 'FAILED' } as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const PhotoKind = { MAIN: 'MAIN', EXTRA: 'EXTRA' } as const;
export type PhotoKind = (typeof PhotoKind)[keyof typeof PhotoKind];
