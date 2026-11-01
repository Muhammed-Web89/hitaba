'use client';

import { useState } from 'react';

/** Kural numarası: tıklayınca bu kurala doğrudan bağlantıyı panoya kopyalar. */
export function RuleAnchor({ id, number, label, copiedLabel }: { id: string; number: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <a
      href={`#${id}`}
      aria-label={copied ? copiedLabel : label}
      title={copied ? copiedLabel : label}
      onClick={() => {
        const url = `${location.origin}${location.pathname}#${id}`;
        void navigator.clipboard?.writeText(url).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        });
      }}
      className="glow inline-flex h-7 min-w-11 shrink-0 items-center justify-center rounded-full border border-line px-2 font-mono text-xs font-semibold text-brand-500 tabular-nums"
    >
      {copied ? '✓' : number}
    </a>
  );
}
