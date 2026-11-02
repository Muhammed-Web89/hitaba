'use client';

import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { fetcher } from '@/lib/api';
import { persistentCache } from '@/lib/cache';
import { AuthProvider } from '@/lib/auth';
import { GlowTracker } from './GlowTracker';
import { PrivacyShield, TelegramBridge } from './TelegramBridge';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ fetcher, revalidateOnFocus: false, shouldRetryOnError: false, provider: persistentCache }}>
      <AuthProvider>{children}</AuthProvider>
      <TelegramBridge />
      <PrivacyShield />
      <GlowTracker />
    </SWRConfig>
  );
}
