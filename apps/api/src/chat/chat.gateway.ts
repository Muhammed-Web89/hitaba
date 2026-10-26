import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { User } from '@prisma/client';
import type { Namespace, Socket } from 'socket.io';
import { sendMessageSchema } from '@hitaba/shared';
import { AuthGuard } from '../auth/guards';
import { env } from '../config/env';
import { chatRoom, chatWatchRoom, RealtimeService, userRoom } from '../realtime/realtime.service';
import { ChatService } from './chat.service';

type AuthedSocket = Socket & { data: { user: User } };

@WebSocketGateway({ namespace: '/chat', cors: { origin: env.WEB_ORIGIN.split(','), credentials: true } })
export class ChatGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly log = new Logger(ChatGateway.name);

  constructor(
    private readonly auth: AuthGuard,
    private readonly chats: ChatService,
    private readonly realtime: RealtimeService,
  ) {}

  afterInit(nsp: Namespace) {
    this.realtime.attach(nsp);
    nsp.use(async (socket, next) => {
      try {
        const token = (socket.handshake.auth as { token?: string })?.token;
        if (!token) throw new Error('no token');
        socket.data.user = await this.auth.userFromToken(token);
        next();
      } catch {
        next(new Error('unauthorized'));
      }
    });
  }

  handleConnection(socket: AuthedSocket) {
    void socket.join(userRoom(socket.data.user.id));
  }

  @SubscribeMessage('chat:join')
  async join(@ConnectedSocket() socket: AuthedSocket, @MessageBody() chatId: string) {
    const user = socket.data.user;
    try {
      if (user.role === 'USER') {
        await this.chats.participantChat(user, String(chatId));
        await socket.join(chatRoom(chatId));
      } else {
        await this.chats.transcriptForModerator(user, String(chatId));
        await socket.join(chatWatchRoom(chatId));
      }
      return { ok: true };
    } catch {
      return { ok: false, error: 'forbidden' };
    }
  }

  @SubscribeMessage('chat:leave')
  async leave(@ConnectedSocket() socket: AuthedSocket, @MessageBody() chatId: string) {
    await socket.leave(chatRoom(String(chatId)));
    await socket.leave(chatWatchRoom(String(chatId)));
  }

  @SubscribeMessage('message:send')
  async send(@ConnectedSocket() socket: AuthedSocket, @MessageBody() body: unknown) {
    const parsed = sendMessageSchema.safeParse(body);
    if (!parsed.success) return { ok: false, error: 'validation_failed' };
    try {
      // Kullanıcı durumu (ban vb.) her mesajda tazelenir.
      const user = await this.auth.userFromToken((socket.handshake.auth as { token: string }).token).catch(() => null);
      if (!user || user.role !== 'USER') return { ok: false, error: 'unauthorized' };
      const message = await this.chats.send(user, parsed.data.chatId, parsed.data.text, parsed.data.clientId);
      return { ok: true, message };
    } catch (e) {
      const err = (e as { response?: { error?: string } }).response?.error ?? 'failed';
      if (err === 'failed') this.log.warn((e as Error).message);
      return { ok: false, error: err };
    }
  }
}
