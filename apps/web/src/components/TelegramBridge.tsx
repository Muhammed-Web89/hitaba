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

/**
 * Uygulama arka plana geçince içeriği bulanıklaştırır (uygulama değiştirici önizlemesi, ekran kaydı).
 * Telegram'da pencere odağı (blur/focus) kullanılmaz: ödeme penceresi gibi Telegram'ın kendi ekranları
 * odağı alır ve kapanınca "focus" her zaman gelmez, ekran bulanık kalırdı. Onun yerine Telegram'ın
 * activated/deactivated olayları ve sayfa görünürlüğü kullanılır.
 */
export function PrivacyShield() {
  useEffect(() => {
    const root = document.documentElement;
    const on = () => (root.dataset.shield = '1');
    const off = () => delete root.dataset.shield;
    const onVisibility = () => (document.hidden ? on() : off());
    document.addEventListener('visibilitychange', onVisibility);
    if (root.dataset.tg === '1') {
      void loadTelegramSdk().then((wa) => {
        wa?.onEvent?.('deactivated', on);
        wa?.onEvent?.('activated', off);
        wa?.onEvent?.('invoiceClosed', off);
      });
    }
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      off();
    };
  }, []);
  return null;
}
