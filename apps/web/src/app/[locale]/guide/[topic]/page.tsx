import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { GuideTopicView } from '@/components/guide/GuideView';
import { getGuide, GUIDE_TOPICS, type GuideTopic } from '@/content/guide';
import type { Locale } from '@/i18n/routing';

export function generateStaticParams() {
  return GUIDE_TOPICS.map((topic) => ({ topic }));
}

const isTopic = (t: string): t is GuideTopic => (GUIDE_TOPICS as readonly string[]).includes(t);

export async function generateMetadata({ params }: { params: Promise<{ locale: string; topic: string }> }): Promise<Metadata> {
  const { locale, topic } = await params;
  const g = getGuide(locale);
  const name = topic === 'man' ? g.ui.man : topic === 'woman' ? g.ui.woman : g.ui.payment;
  return { title: `${g.ui.title} · ${name}`, description: g.ui.description };
}

export default async function GuideTopicPage({ params }: { params: Promise<{ locale: string; topic: string }> }) {
  const { locale, topic } = await params;
  if (!isTopic(topic)) notFound();
  setRequestLocale(locale as Locale);
  return <GuideTopicView topic={topic} />;
}
