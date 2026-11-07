import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { GuideIndex } from '@/components/guide/GuideView';
import { getGuide } from '@/content/guide';
import type { Locale } from '@/i18n/routing';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const g = getGuide((await params).locale);
  return { title: g.ui.title, description: g.ui.description };
}

export default async function GuidePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <GuideIndex />;
}
