'use client';

import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@hitaba/shared';
import { API_URL, tokens } from './api';

export type ChatSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: ChatSocket | null = null;

export function getSocket(): ChatSocket | null {
  if (typeof window === 'undefined' || !tokens.access) return null;
  if (!socket) {
    socket = io(`${API_URL}/chat`, {
      transports: ['websocket'],
      // Her yeniden bağlanmada güncel token kullanılır.
      auth: (cb) => cb({ token: tokens.access }),
    });
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
