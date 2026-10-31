'use client';

import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { fetcher } from '@/lib/api';
import { AuthProvider } from '@/lib/auth';
import { PrivacyShield, TelegramBridge } from './TelegramBridge';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ fetcher, revalidateOnFocus: false, shouldRetryOnError: false }}>
      <AuthProvider>{children}</AuthProvider>
      <TelegramBridge />
      <PrivacyShield />
    </SWRConfig>
  );
}
