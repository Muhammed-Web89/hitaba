'use client';

import { useEffect, useRef } from 'react';
import { useLocale } from 'next-intl';

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? 'HitabaBot';

/**
 * Telegram Login Widget (yönlendirme modu). Onaydan sonra Telegram kullanıcıyı imzalı alanlarla /tg sayfasına
 * döndürür; orada sunucu doğrular. Botun alan adı BotFather'da (/setdomain) bu siteye ayarlı olmalı.
 */
export function TelegramLoginButton() {
  const ref = useRef<HTMLDivElement>(null);
  const locale = useLocale();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const s = document.createElement('script');
    s.src = 'https://telegram.org/js/telegram-widget.js?22';
    s.async = true;
    s.setAttribute('data-telegram-login', BOT_USERNAME);
    s.setAttribute('data-size', 'large');
    s.setAttribute('data-radius', '12');
    s.setAttribute('data-request-access', 'write');
    s.setAttribute('data-lang', locale);
    s.setAttribute('data-auth-url', `${window.location.origin}/${locale}/tg`);
    el.replaceChildren(s);
    return () => el.replaceChildren();
  }, [locale]);
  return <div ref={ref} className="flex min-h-[44px] justify-center" />;
}
