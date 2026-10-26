'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import useSWR from 'swr';
import type { AuthTokens, Me } from '@hitaba/shared';
import { api, ApiError, tokens } from './api';
import { disconnectSocket } from './socket';

interface AuthContextValue {
  me: Me | undefined;
  loading: boolean;
  signedIn: boolean;
  signIn: (t: AuthTokens) => Promise<void>;
  signOut: () => void;
  refreshMe: () => Promise<Me | undefined>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const access = useSyncExternalStore(
    tokens.subscribe,
    () => tokens.access,
    () => null,
  );
  const hasRefresh = useSyncExternalStore(
    tokens.subscribe,
    () => Boolean(tokens.refresh),
    () => false,
  );
  const signedIn = Boolean(access || hasRefresh);
  // Hidrasyon sırasında token'lar henüz okunmamıştır (sunucu görüntüsü boş);
  // bu arada guard'lar "oturum yok" sanıp yönlendirmemeli.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const { data: me, isLoading, mutate } = useSWR<Me>(signedIn ? '/me' : null, (p: string) => api<Me>(p), {
    revalidateOnFocus: true,
    shouldRetryOnError: false,
    // Yalnızca kimlik hatasında oturum kapanır; ağ hatası oturumu silmez.
    onError: (e) => e instanceof ApiError && e.status === 401 && tokens.clear(),
  });

  const signIn = useCallback(
    async (t: AuthTokens) => {
      tokens.set(t);
      await mutate();
    },
    [mutate],
  );

  const signOut = useCallback(() => {
    tokens.clear();
    disconnectSocket();
    void mutate(undefined, { revalidate: false });
  }, [mutate]);

  // Kullanıcının kaydettiği dil tercihini API'ye bildir (bildirim dili için).
  useEffect(() => {
    if (!me) return;
    const lang = document.documentElement.lang;
    if (lang && lang !== me.locale) void api('/profile/settings', { method: 'PATCH', body: { locale: lang } }).catch(() => {});
  }, [me]);

  const value = useMemo<AuthContextValue>(
    () => ({ me, loading: !hydrated || (signedIn && isLoading), signedIn, signIn, signOut, refreshMe: () => mutate() }),
    [me, hydrated, isLoading, signedIn, signIn, signOut, mutate],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
