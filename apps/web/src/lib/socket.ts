'use client';

import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@hitaba/shared';
import { API_URL, tokens } from './api';

export type ChatSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: ChatSocket | null = null;

export function getSocket(): ChatSocket | null {
  if (typeof window === 'undefined' || !tokens.access) return null;
  if (!socket) {
    // API_URL göreli ("/api") ise aynı origin'e, socket.io yolu proxy altından bağlanılır.
    const relative = API_URL.startsWith('/');
    socket = io(relative ? '/chat' : `${API_URL}/chat`, {
      ...(relative && { path: `${API_URL}/socket.io/` }),
      // WebSocket kurulamazsa polling'e düşer (bazı proxy/tünellerde gerekli).
      transports: ['websocket', 'polling'],
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
