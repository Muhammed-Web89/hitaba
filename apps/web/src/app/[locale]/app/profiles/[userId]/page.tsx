'use client';

import { use, useState } from 'react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import type { PublicProfile } from '@hitaba/shared';
import { ProfileCard } from '@/components/ProfileView';
import { ReportDialog } from '@/components/ReportDialog';
import { StatusGate } from '@/components/StatusGate';
import { EmptyState, IconButton, PageLoader } from '@/components/ui';
import { useRouter } from '@/i18n/navigation';

export default function ProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  return (
    <StatusGate>
      <Profile userId={userId} />
    </StatusGate>
  );
}

function Profile({ userId }: { userId: string }) {
  const t = useTranslations('common');
  const tf = useTranslations('feed');
  const router = useRouter();
  const { data, error } = useSWR<PublicProfile>(`/profiles/${userId}`);
  const [report, setReport] = useState(false);
  if (error) return <EmptyState icon="user" title={t('notFound')} />;
  if (!data) return <PageLoader />;
  return (
    <div>
      <div className="mb-2 flex justify-between">
        <IconButton icon="back" label={t('back')} onClick={() => router.back()} className="flip-rtl" />
        <IconButton icon="flag" label={tf('report')} onClick={() => setReport(true)} />
      </div>
      <ProfileCard profile={data} />
      <ReportDialog open={report} onClose={() => setReport(false)} targetUserId={data.userId} />
    </div>
  );
}
