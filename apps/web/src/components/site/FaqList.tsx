import { Icon } from '@/components/icons';
import { fill } from '@/content/site';

/** Açılır-kapanır soru listesi (JS gerektirmez; yerel <details>). */
export function FaqList({ items }: { items: Array<{ q: string; a: string }> }) {
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <details key={it.q} className="glass group rounded-card border">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold [&::-webkit-details-marker]:hidden">
            {fill(it.q)}
            <Icon name="chevronDown" size={18} className="shrink-0 text-ink-3 transition-transform group-open:rotate-180" />
          </summary>
          <p className="px-5 pb-5 text-[15px] leading-relaxed text-ink-2">{fill(it.a)}</p>
        </details>
      ))}
    </div>
  );
}
