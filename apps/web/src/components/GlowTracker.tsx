'use client';

import { useEffect } from 'react';

/** `.glow` öğelerinin ışığını imlecin (dokunmada parmağın) konumuna taşır; tek bir belge dinleyicisi. */
export function GlowTracker() {
  useEffect(() => {
    let frame = 0;
    const move = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.<HTMLElement>('.glow');
      if (!el) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${e.clientX - r.left}px`);
        el.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    };
    document.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerdown', move, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerdown', move);
    };
  }, []);
  return null;
}
