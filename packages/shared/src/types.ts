/** API yanıt şekilleri — web istemcisi bunlarla tiplenir. */
import type {
  ChatCloseReason,
  ChatStatus,
  Gender,
  MaritalStatus,
  MatchStage,
  MessageKind,
  MessageState,
  ModerationStatus,
  PolygamyAnswer,
  Relation,
  Role,
  UserStatus,
} from './enums';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface Me {
  id: string;
  role: Role;
  gender: Gender;
  status: UserStatus;
  statusReason: string | null;
  email: string | null;
  telegramUsername: string | null;
  locale: string;
  timezone: string;
  connectBalance: number;
  displayName: string | null;
  completedSteps: string[];
  likesLeftToday: number | null;
}

export interface OwnProfile {
  displayName: string | null;
  birthDate: string | null;
  country: string | null;
  city: string | null;
  nationality: string | null;
  languages: string[];
  willingToRelocate: boolean;
  heightCm: number | null;
  weightKg: number | null;
  maritalStatus: MaritalStatus | null;
  nikahCount: number;
  childrenCount: number;
  polygamyAnswer: PolygamyAnswer | null;
  aboutMe: string | null;
  aboutSpouse: string | null;
  beliefsManhaj: string | null;
  hasScreening: boolean;
  acceptedRules: boolean;
  completedSteps: string[];
  showPhotoInFeed: boolean;
  hideBusyBadge: boolean;
  moderationStatus: ModerationStatus;
  photos: OwnPhoto[];
}

export interface OwnPhoto {
  id: string;
  kind: 'MAIN' | 'EXTRA';
  status: ModerationStatus;
  rejectionReason: string | null;
  url: string;
}

/** Başka bir kullanıcının profili — kimlik bilgisi içermez, yaş yerine yaş aralığı. */
export interface PublicProfile {
  userId: string;
  gender: Gender;
  displayName: string;
  ageRange: string;
  country: string;
  city: string;
  nationality: string;
  languages: string[];
  willingToRelocate: boolean;
  heightCm: number | null;
  weightKg: number | null;
  maritalStatus: MaritalStatus;
  nikahCount: number;
  childrenCount: number;
  polygamyAnswer: PolygamyAnswer | null;
  aboutMe: string;
  aboutSpouse: string;
  beliefsManhaj: string;
  /** Görüntüleyenin erişimi olan fotoğrafların URL'leri (yoksa boş). */
  photoUrls: string[];
  hasPhoto: boolean;
  busy: boolean;
  witnessCount: number;
  hasWali: boolean;
}

export interface FeedCard {
  profile: PublicProfile;
  remaining: number;
}

export interface MatchSummary {
  id: string;
  stage: MatchStage;
  other: PublicProfile;
  /** Kadın için: erkeğin fotoğrafı hakkında karar vermesi gerekiyor. */
  awaitingMyPhotoDecision: boolean;
  /** Erkek için: kadının fotoğrafını görme penceresi. */
  photoAccessUntil: string | null;
  chatRequested: boolean;
  chatId: string | null;
  chatStatus: ChatStatus | null;
  canOpenChat: boolean;
  createdAt: string;
}

export interface ChatParticipantInfo {
  maleModerator: boolean;
  femaleModerator: boolean;
  aiModerator: true;
  witnesses: { relation: Relation }[];
  hasWali: boolean;
}

export interface ChatSummary {
  id: string;
  matchId: string;
  status: ChatStatus;
  pausedReason: string | null;
  closeReason: ChatCloseReason | null;
  other: { userId: string; displayName: string; ageRange: string; city: string };
  lastMessage: { text: string; at: string; mine: boolean } | null;
  lastActivityAt: string;
  canReopen: boolean;
  watchers: ChatParticipantInfo;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string | null;
  kind: MessageKind;
  state: MessageState;
  text: string;
  editedAt: string | null;
  deleted: boolean;
  createdAt: string;
  reactions: { userId: string; reaction: string }[];
  clientId?: string | null;
}

export interface NotificationItem {
  id: string;
  type: string;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface WaliPortalView {
  femaleId: string;
  femaleDisplayName: string;
  waliName: string | null;
  witnesses: { name: string; relation: Relation }[];
  chat: {
    id: string;
    status: ChatStatus;
    other: { displayName: string; ageRange: string; city: string; country: string };
    messages: ChatMessage[];
  } | null;
}

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}

/** Socket.io olayları (namespace: /chat) */
export interface ServerToClientEvents {
  'message:new': (m: ChatMessage) => void;
  'message:updated': (m: ChatMessage) => void;
  'chat:updated': (c: { chatId: string; status: ChatStatus; pausedReason: string | null }) => void;
  'notification:new': (n: NotificationItem) => void;
  'message:held': (p: { chatId: string; clientId: string | null; signals: string[] }) => void;
}

export interface ClientToServerEvents {
  'chat:join': (chatId: string, ack: (res: { ok: boolean; error?: string }) => void) => void;
  'chat:leave': (chatId: string) => void;
  'message:send': (
    payload: { chatId: string; text: string; clientId?: string },
    ack: (res: { ok: boolean; message?: ChatMessage; error?: string }) => void,
  ) => void;
}
