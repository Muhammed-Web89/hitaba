'use client';

import { useTranslations } from 'next-intl';
import { IconButton, PageLoader } from '@/components/ui';
import { WaliForm } from '@/components/WaliForm';
import { useRouter } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth';

export default function WaliPage() {
  const t = useTranslations('wali');
  const tc = useTranslations('common');
  const router = useRouter();
  const { me } = useAuth();
  if (!me) return <PageLoader />;
  if (me.gender !== 'FEMALE') {
    router.replace('/app/profile');
    return null;
  }
  return (
    <div>
      <IconButton icon="back" label={tc('back')} onClick={() => router.push('/app/profile')} className="flip-rtl" />
      <h1 className="mb-4 mt-2 text-2xl font-semibold">{t('title')}</h1>
      <WaliForm />
    </div>
  );
}
