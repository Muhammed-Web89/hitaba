'use client';

import { useTranslations } from 'next-intl';
import { Card, Chip } from './ui';

/** Moderatör sohbet dökümü: silinen, düzenlenen ve tutulan mesajlar dahil. */
export function Transcript({ messages }: { messages: any[] }) {
  const t = useTranslations('admin');
  return (
    <Card className="max-h-[60vh] space-y-2 overflow-y-auto p-4">
      <h3 className="font-semibold">{t('transcript')}</h3>
      {messages.map((m) => (
        <div key={m.id} className="text-sm">
          <span className="me-2 text-xs text-ink-3">{new Date(m.createdAt).toLocaleString()}</span>
          <span className="me-2 font-semibold">{m.kind === 'SYSTEM' ? 'SYSTEM' : m.sender?.gender === 'FEMALE' ? '♀' : '♂'}</span>
          <span className={m.deletedAt ? 'text-ink-3 line-through' : ''}>{m.text}</span>
          {m.state !== 'DELIVERED' && (
            <Chip tone="warning">
              {m.state}
            </Chip>
          )}
          {m.history?.length > 0 && <span className="ms-2 text-xs text-ink-3">({t('editedFrom')}: {m.history.join(' → ')})</span>}
        </div>
      ))}
    </Card>
  );
}
