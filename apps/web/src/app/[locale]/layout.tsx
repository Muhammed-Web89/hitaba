import type { Metadata, Viewport } from 'next';
import { Fraunces, Manrope, Noto_Naskh_Arabic } from 'next/font/google';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LanguageGate } from '@/components/LanguageGate';
import { Providers } from '@/components/Providers';
import { routing, RTL_LOCALES, type Locale } from '@/i18n/routing';
import '../globals.css';

const fraunces = Fraunces({ subsets: ['latin', 'latin-ext'], variable: '--font-fraunces', display: 'swap' });
const manrope = Manrope({ subsets: ['latin', 'latin-ext', 'cyrillic'], variable: '--font-manrope', display: 'swap' });
const naskh = Noto_Naskh_Arabic({ subsets: ['arabic'], variable: '--font-naskh', display: 'swap' });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'common' });
  return { title: { default: 'Hitaba', template: '%s · Hitaba' }, description: t('tagline') };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FBFAF6' },
    { media: '(prefers-color-scheme: dark)', color: '#121410' },
  ],
};

/** Tema ilk boyamadan önce uygulanır (yanıp sönme olmaz). */
const themeScript = `try{var t=localStorage.getItem('hitaba.theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

/** Telegram Mini App içinde mi? Açılış adresindeki tgWebAppData oturum boyunca hatırlanır (sayfa geçişlerinde hash kaybolur). */
const tgScript = `try{if(location.hash.indexOf('tgWebAppData')>-1)sessionStorage.setItem('hitaba.tg','1');if(sessionStorage.getItem('hitaba.tg'))document.documentElement.dataset.tg='1'}catch(e){}`;

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} dir={RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr'} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript + tgScript }} />
      </head>
      <body className={`${fraunces.variable} ${manrope.variable} ${naskh.variable} antialiased`}>
        <NextIntlClientProvider>
          <Providers>
            <LanguageGate />
            {children}
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
