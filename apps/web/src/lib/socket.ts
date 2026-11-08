'use client';

import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@hitaba/shared/client';
import { api, API_URL, tokens } from './api';

export type ChatSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: ChatSocket | null = null;
let retry: ReturnType<typeof setTimeout> | undefined;
let attempts = 0;

/**
 * Sunucu bağlantıyı reddederse (çoğunlukla süresi dolmuş erişim anahtarı: telefon uyuyup uyanınca)
 * socket.io kendiliğinden yeniden denemez. Anahtar REST üzerinden tazelenir ve yeniden bağlanılır.
 */
function revive() {
  const s = socket;
  if (!s || s.connected || s.active || retry) return;
  retry = setTimeout(() => {
    retry = undefined;
    void api('/me').then(
      () => socket === s && !s.connected && s.connect(),
      () => {},
    );
  }, Math.min(30_000, 1000 * 2 ** attempts++));
}

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
    socket.on('connect', () => (attempts = 0));
    socket.on('connect_error', revive);
    socket.on('disconnect', revive);
  } else revive();
  return socket;
}

// Uygulamaya geri dönülünce ya da ağ gelince kopuk bağlantı hemen toparlanır.
if (typeof window !== 'undefined') {
  const wake = () => {
    if (document.visibilityState === 'visible') revive();
  };
  document.addEventListener('visibilitychange', wake);
  window.addEventListener('online', wake);
}

export function disconnectSocket() {
  clearTimeout(retry);
  retry = undefined;
  const s = socket;
  socket = null;
  s?.disconnect();
}
