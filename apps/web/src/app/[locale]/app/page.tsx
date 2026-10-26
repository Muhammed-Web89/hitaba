'use client';

import { useEffect } from 'react';
import { StatusGate } from '@/components/StatusGate';
import { useRouter } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth';

export default function AppHome() {
  const { me } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (me?.status === 'APPROVED') router.replace('/app/feed');
  }, [me, router]);
  return <StatusGate>{null}</StatusGate>;
}
