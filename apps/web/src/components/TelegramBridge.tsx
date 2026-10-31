"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import "@/lib/telegram";

/**
 * Telegram Mini App ayarları her sayfada uygulanır (yalnızca /tg girişinde değil): tam ekran açılır,
 * aşağı kaydırma uygulamayı kapatmaz/küçültmez, başlık rengi temaya uyar.
 */
export function TelegramBridge() {
  const [inTelegram, setInTelegram] = useState(false);
  useEffect(
    () => setInTelegram(document.documentElement.dataset.tg === "1"),
    [],
  );
  if (!inTelegram) return null;

  const setup = () => {
    const wa = window.Telegram?.WebApp;
    if (!wa) return;
    wa.ready();
    wa.expand();
    if (wa.isVersionAtLeast?.("7.7")) wa.disableVerticalSwipes?.();
    const bg = getComputedStyle(document.body).backgroundColor;
    if (wa.isVersionAtLeast?.("6.1")) {
      wa.setHeaderColor?.(bg);
      wa.setBackgroundColor?.(bg);
    }
    // Kullanıcı yine de küçültürse geri tam ekrana al.
    wa.onEvent?.("viewportChanged", () => {
      if (!wa.isExpanded) wa.expand();
    });
  };

  return (
    <Script
      src="https://telegram.org/js/telegram-web-app.js"
      strategy="afterInteractive"
      onReady={setup}
    />
  );
}

/** Sayfa gizlenince (ve Telegram içinde odak kaybolunca) içeriği bulanıklaştırır. */
export function PrivacyShield() {
  useEffect(() => {
    const root = document.documentElement;
    const on = () => (root.dataset.shield = "1");
    const off = () => delete root.dataset.shield;
    const onVisibility = () => (document.hidden ? on() : off());
    const inTelegram = root.dataset.tg === "1";
    document.addEventListener("visibilitychange", onVisibility);
    if (inTelegram) {
      window.addEventListener("blur", on);
      window.addEventListener("focus", off);
    }
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", on);
      window.removeEventListener("focus", off);
    };
  }, []);
  return null;
}
