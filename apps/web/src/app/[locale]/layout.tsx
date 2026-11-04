import type { Metadata, Viewport } from 'next';
import { Fraunces, Manrope, Noto_Naskh_Arabic } from 'next/font/google';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LanguageGate } from '@/components/LanguageGate';
import { Providers } from '@/components/Providers';
import { routing, RTL_LOCALES, type Locale } from '@/i18n/routing';
import { TELEGRAM_SDK_URL } from '@/lib/telegram-sdk';
import '../globals.css';

const fraunces = Fraunces({ subsets: ['latin', 'latin-ext'], variable: '--font-fraunces', display: 'swap' });
const manrope = Manrope({ subsets: ['latin', 'latin-ext', 'cyrillic'], variable: '--font-manrope', display: 'swap' });
const naskh = Noto_Naskh_Arabic({ subsets: ['arabic'], variable: '--font-naskh', display: 'swap' });

/** API bağlantısı sayfa yüklenirken açılır (DNS + TLS beklemesi kısalır). */
const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL?.startsWith('http') ? new URL(process.env.NEXT_PUBLIC_API_URL).origin : null;

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
  themeColor: '#060a0e',
};

/** Tema ilk boyamadan önce uygulanır (yanıp sönme olmaz). Varsayılan koyu; kullanıcı açığı seçebilir. */
const themeScript = `var d=document.documentElement;d.dataset.theme='dark';try{if(localStorage.getItem('hitaba.theme')==='light')d.dataset.theme='light'}catch(e){}`;

/**
 * Telegram Mini App içinde mi? Açılış adresindeki tgWebAppData ya da Telegram'ın mobil köprüsü (TelegramWebviewProxy)
 * oturum boyunca hatırlanır (sayfa geçişlerinde ve yönlendirmelerde hash kaybolabilir). Telefonda, React ve SDK
 * yüklenmeyi beklemeden uygulama tam boya açılır ve aşağı çekince küçülme/kapanma kapatılır (yarım açılış görünmesin). Telegram'daysa SDK, React yüklenmeyi beklemeden hemen indirilmeye başlar.
 */
const tgScript = `try{if(location.hash.indexOf('tgWebAppData')>-1||window.TelegramWebviewProxy)sessionStorage.setItem('hitaba.tg','1');if(window.TelegramWebviewProxy){var P=window.TelegramWebviewProxy;P.postEvent('web_app_expand');P.postEvent('web_app_setup_swipe_behavior','{"allow_vertical_swipe":false}')}if(sessionStorage.getItem('hitaba.tg')){d.dataset.tg='1';var s=document.createElement('script');s.src='${TELEGRAM_SDK_URL}';s.id='tg-sdk';document.head.appendChild(s)}}catch(e){}`;

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} dir={RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr'} suppressHydrationWarning>
      <head>
        {API_ORIGIN && <link rel="preconnect" href={API_ORIGIN} crossOrigin="anonymous" />}
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
