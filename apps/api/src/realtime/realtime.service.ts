import { Global, Injectable, Module } from '@nestjs/common';
import type { Namespace } from 'socket.io';
import type { ServerToClientEvents } from '@hitaba/shared';

type EventName = keyof ServerToClientEvents;
type EventArg<E extends EventName> = Parameters<ServerToClientEvents[E]>[0];

export const userRoom = (userId: string) => `user:${userId}`;
export const chatRoom = (chatId: string) => `chat:${chatId}`;
/** Moderatörler ve veli portalı salt-okunur dinleyiciler olarak bu odaya katılır. */
export const chatWatchRoom = (chatId: string) => `watch:${chatId}`;

/**
 * Socket sunucusuna servislerden erişim. Gateway başlatıldığında `attach` çağırır;
 * böylece servisler gateway'e (ve dolayısıyla birbirlerine) döngüsel bağımlı olmaz.
 */
@Injectable()
export class RealtimeService {
  private nsp?: Namespace;

  attach(nsp: Namespace) {
    this.nsp = nsp;
  }

  toUser<E extends EventName>(userId: string, event: E, payload: EventArg<E>) {
    this.nsp?.to(userRoom(userId)).emit(event, payload as never);
  }

  toChat<E extends EventName>(chatId: string, event: E, payload: EventArg<E>) {
    this.nsp?.to([chatRoom(chatId), chatWatchRoom(chatId)]).emit(event, payload as never);
  }

  /** Yalnızca gözlemcilere (ör. tutulmuş mesaj — taraflara gitmez). */
  toWatchers<E extends EventName>(chatId: string, event: E, payload: EventArg<E>) {
    this.nsp?.to(chatWatchRoom(chatId)).emit(event, payload as never);
  }
}

@Global()
@Module({ providers: [RealtimeService], exports: [RealtimeService] })
export class RealtimeModule {}
