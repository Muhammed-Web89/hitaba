import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { DocPage } from '@/components/site/DocPage';
import { getSite } from '@/content/site';
import type { Locale } from '@/i18n/routing';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const doc = getSite((await params).locale).docs.refund;
  return { title: doc.title, description: doc.description };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <DocPage doc={getSite(locale).docs.refund} />;
}
