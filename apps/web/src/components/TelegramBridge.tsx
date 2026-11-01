'use client';

import { useEffect } from 'react';
import { loadTelegramSdk, setupTelegramWebApp } from '@/lib/telegram';

/** Telegram Mini App ayarları her sayfada uygulanır (yalnızca /tg girişinde değil). */
export function TelegramBridge() {
  useEffect(() => {
    if (document.documentElement.dataset.tg !== '1') return;
    void loadTelegramSdk().then((wa) => wa && setupTelegramWebApp(wa));
  }, []);
  return null;
}

/** Sayfa gizlenince (ve Telegram içinde odak kaybolunca) içeriği bulanıklaştırır. */
export function PrivacyShield() {
  useEffect(() => {
    const root = document.documentElement;
    const on = () => (root.dataset.shield = '1');
    const off = () => delete root.dataset.shield;
    const onVisibility = () => (document.hidden ? on() : off());
    const inTelegram = root.dataset.tg === '1';
    document.addEventListener('visibilitychange', onVisibility);
    if (inTelegram) {
      window.addEventListener('blur', on);
      window.addEventListener('focus', off);
    }
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', on);
      window.removeEventListener('focus', off);
    };
  }, []);
  return null;
}
