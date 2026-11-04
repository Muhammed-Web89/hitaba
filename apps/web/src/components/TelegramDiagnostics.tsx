'use client';

import { useEffect, useState } from 'react';

/** Destek için tek satır: Telegram'ın uygulamaya bildirdiği platform, sürüm ve ekran modu. */
export function TelegramDiagnostics() {
  const [line, setLine] = useState<string | null>(null);
  useEffect(() => {
    const wa = window.Telegram?.WebApp;
    if (!wa) return;
    const flags = [wa.isFullscreen ? 'fullscreen' : wa.isExpanded ? 'expanded' : 'compact', document.documentElement.dataset.tg === '1' ? 'tg' : 'no-tg'];
    setLine(`Telegram · ${wa.platform ?? '?'} ${wa.version ?? '?'} · ${flags.join(' · ')}`);
  }, []);
  if (!line) return null;
  return <p className="mt-6 text-center font-mono text-[11px] text-ink-3">{line}</p>;
}
