'use client';

import { use, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { Relation, RULES, scanForContactInfo, type ChatMessage, type ChatSummary } from '@hitaba/shared';
import { Icon } from '@/components/icons';
import { MessageList } from '@/components/MessageList';
import { ReportDialog } from '@/components/ReportDialog';
import { Button, Field, IconButton, Input, Modal, Notice, PageLoader, Select, Textarea } from '@/components/ui';
import { Link, useRouter } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useErrorText } from '@/lib/format';
import { getSocket } from '@/lib/socket';

function upsert(list: ChatMessage[], m: ChatMessage): ChatMessage[] {
  const i = list.findIndex((x) => x.id === m.id || (m.clientId && x.clientId === m.clientId));
  if (i === -1) return [...list, m];
  const copy = list.slice();
  copy[i] = m;
  return copy;
}

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations('chat');
  const tc = useTranslations('common');
  const te = useTranslations('enums.relation');
  const errorText = useErrorText();
  const router = useRouter();
  const { me, refreshMe } = useAuth();
  const { data: chat, mutate: mutateChat, error: chatError } = useSWR<ChatSummary>(`/chats/${id}`);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [text, setText] = useState('');
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [warn, setWarn] = useState(false);
  const [menu, setMenu] = useState(false);
  const [watchersOpen, setWatchersOpen] = useState(false);
  const [dialog, setDialog] = useState<'mahram' | 'close' | 'report' | 'reopen' | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => setMessages(await api<ChatMessage[]>(`/chats/${id}/messages`)), [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Gerçek zamanlı: odaya katıl, olayları dinle.
  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const join = () => s.emit('chat:join', id, () => {});
    const onNew = (m: ChatMessage) => m.chatId === id && setMessages((l) => (l ? upsert(l, m) : l));
    const onStatus = (c: { chatId: string }) => c.chatId === id && void mutateChat();
    const onHeld = (p: { chatId: string }) => p.chatId === id && void load();
    const onConnectError = () => void api('/me').then(() => s.connect()).catch(() => {});
    s.on('connect', join);
    s.on('connect_error', onConnectError);
    s.on('message:new', onNew);
    s.on('message:updated', onNew);
    s.on('chat:updated', onStatus);
    s.on('message:held', onHeld);
    if (s.connected) join();
    return () => {
      s.emit('chat:leave', id);
      s.off('connect', join);
      s.off('connect_error', onConnectError);
      s.off('message:new', onNew);
      s.off('message:updated', onNew);
      s.off('chat:updated', onStatus);
      s.off('message:held', onHeld);
    };
  }, [id, load, mutateChat]);

  useLayoutEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [messages?.length]);

  if (chatError) {
    return (
      <div className="p-4">
        <Notice tone="danger">{errorText(chatError)}</Notice>
      </div>
    );
  }
  if (!chat || !messages || !me) return <PageLoader />;

  const active = chat.status === 'ACTIVE';
  const watcherCount =
    Number(chat.watchers.maleModerator) + Number(chat.watchers.femaleModerator) + 1 + chat.watchers.witnesses.length + Number(chat.watchers.hasWali);

  async function send(force = false) {
    const body = text.trim();
    if (!body) return;
    // İstemci tarafı ön uyarı; sunucu yine de otoritedir (§5.5 "Yine de gönder").
    if (!force && scanForContactInfo(body).blocked) return setWarn(true);
    setWarn(false);
    setSending(true);
    setError(null);
    try {
      if (editing) {
        const m = await api<ChatMessage>(`/messages/${editing.id}`, { method: 'PATCH', body: { text: body } });
        setMessages((l) => (l ? upsert(l, m) : l));
        setEditing(null);
      } else {
        const clientId = crypto.randomUUID();
        const viaRest = () => api<ChatMessage>(`/chats/${id}/messages`, { method: 'POST', body: { text: body, clientId } });
        const s = getSocket();
        // Önce socket; bağlantı yoksa ya da zaman aşımında REST'e düşer. Sunucu hatası olduğu gibi gösterilir.
        const m = s?.connected
          ? await new Promise<ChatMessage>((resolve, reject) =>
              s.timeout(10_000).emit('message:send', { chatId: id, text: body, clientId }, (err, res) => {
                if (err) return viaRest().then(resolve, reject);
                if (res.ok && res.message) return resolve(res.message);
                reject(new ApiError(400, res.error ?? 'failed'));
              }),
            )
          : await viaRest();
        setMessages((l) => (l ? upsert(l, m) : l));
        if (m.state === 'HELD') void mutateChat();
      }
      setText('');
    } catch (e) {
      setError(errorText(e));
      void mutateChat();
    } finally {
      setSending(false);
    }
  }

  const canEdit = (m: ChatMessage) => Date.now() - new Date(m.createdAt).getTime() < RULES.messageEditWindowMinutes * 60_000;

  return (
    <div className="flex h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-base/95 backdrop-blur">
        <div className="flex h-14 items-center gap-1 px-2">
          <IconButton icon="back" label={tc('back')} onClick={() => router.push('/app/chats')} className="flip-rtl" />
          <Link href={`/app/matches/${chat.matchId}`} className="min-w-0 flex-1">
            <p className="truncate font-semibold">{chat.other.displayName}</p>
            <p className="truncate text-xs text-ink-3">
              {chat.other.ageRange} · {chat.other.city}
            </p>
          </Link>
          <div className="relative">
            <IconButton icon="more" label={t('menu')} onClick={() => setMenu(!menu)} aria-expanded={menu} />
            {menu && (
              <div className="absolute end-0 top-11 z-30 w-60 overflow-hidden rounded-card border border-line bg-surface shadow-card" onClick={() => setMenu(false)}>
                {active && <MenuItem icon="shield" label={t('shareMahram')} onClick={() => setDialog('mahram')} />}
                {active && (
                  <MenuItem
                    icon="clock"
                    label={t('extend')}
                    onClick={() => api<ChatSummary>(`/chats/${id}/extend`, { method: 'POST' }).then((c) => mutateChat(c, { revalidate: false }))}
                  />
                )}
                <MenuItem icon="flag" label={t('report')} onClick={() => setDialog('report')} />
                {chat.status !== 'CLOSED' && <MenuItem icon="x" label={t('close')} danger onClick={() => setDialog('close')} />}
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setWatchersOpen(!watchersOpen)}
          aria-expanded={watchersOpen}
          className="flex w-full items-center justify-between bg-brand-50 px-4 py-2 text-xs font-semibold text-brand-600"
        >
          <span className="inline-flex items-center gap-1.5">
            <Icon name="users" size={14} /> {t('watchers', { n: watcherCount })}
          </span>
          <Icon name="forward" size={14} className={watchersOpen ? 'rotate-90' : 'flip-rtl'} />
        </button>
        {watchersOpen && (
          <ul className="space-y-1 bg-brand-50 px-4 pb-3 text-sm text-ink-2">
            {chat.watchers.maleModerator && <WatcherRow icon="eye" label={t('watcher.maleModerator')} />}
            {chat.watchers.femaleModerator && <WatcherRow icon="eye" label={t('watcher.femaleModerator')} />}
            <WatcherRow icon="shield" label={t('watcher.ai')} />
            {chat.watchers.witnesses.map((w, i) => (
              <WatcherRow key={i} icon="user" label={t('watcher.witness', { relation: te(w.relation) })} />
            ))}
            {chat.watchers.hasWali && <WatcherRow icon="shield" label={t('watcher.wali')} />}
          </ul>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <Notice icon="info">{t('etiquette')}</Notice>
        <div className="mt-4">
          <MessageList
            messages={messages}
            mineId={me.id}
            reactions={RULES.reactions}
            actions={{
              canEdit,
              onReact: (m, r) => api<ChatMessage>(`/messages/${m.id}/reaction`, { method: 'PUT', body: { reaction: r } }).then((x) => setMessages((l) => (l ? upsert(l, x) : l))),
              onEdit: (m) => {
                setEditing(m);
                setText(m.text);
              },
              onDelete: (m) => api<ChatMessage>(`/messages/${m.id}`, { method: 'DELETE' }).then((x) => setMessages((l) => (l ? upsert(l, x) : l))),
            }}
          />
        </div>
        <div ref={bottom} />
      </div>

      <footer className="border-t border-line bg-surface px-3 py-2" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
        {chat.status === 'PAUSED' && (
          <div className="mb-2">
            <Notice tone="warning" icon="pause">
              {t('pausedBanner')}
            </Notice>
          </div>
        )}
        {chat.status === 'CLOSED' && (
          <div className="mb-2 space-y-2">
            <Notice icon="info">{t(`closedBanner.${chat.closeReason ?? 'USER'}`)}</Notice>
            {chat.canReopen && (
              <Button className="w-full" variant="secondary" onClick={() => setDialog('reopen')}>
                {t('reopen', { cost: RULES.chatReopenCost })}
              </Button>
            )}
          </div>
        )}
        {warn && (
          <div className="mb-2 space-y-2">
            <Notice tone="warning" icon="lock">
              {t('contactWarning')}
            </Notice>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setWarn(false)}>
                {t('editMessage')}
              </Button>
              <Button size="sm" onClick={() => send(true)}>
                {t('sendAnyway')}
              </Button>
            </div>
          </div>
        )}
        {error && (
          <div className="mb-2">
            <Notice tone="danger">{error}</Notice>
          </div>
        )}
        {editing && (
          <div className="mb-1 flex items-center justify-between px-1 text-xs text-ink-3">
            <span>{t('editing')}</span>
            <button
              type="button"
              className="font-semibold"
              onClick={() => {
                setEditing(null);
                setText('');
              }}
            >
              {tc('cancel')}
            </button>
          </div>
        )}
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setWarn(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send();
              }
            }}
            disabled={!active}
            rows={1}
            maxLength={RULES.messageMaxChars}
            placeholder={active ? t('placeholder') : t('placeholderDisabled')}
            aria-label={t('placeholder')}
            className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-base px-4 py-2.5 text-[15px] focus:border-brand-500 focus:outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!active || sending || !text.trim()}
            aria-label={t('send')}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-500 text-brand-ink disabled:opacity-40"
          >
            <Icon name="send" size={20} className="flip-rtl" />
          </button>
        </form>
      </footer>

      <MahramDialog open={dialog === 'mahram'} onClose={() => setDialog(null)} chatId={id} />
      <ReportDialog open={dialog === 'report'} onClose={() => setDialog(null)} targetUserId={chat.other.userId} chatId={id} />
      <Modal
        open={dialog === 'close' || dialog === 'reopen'}
        onClose={() => setDialog(null)}
        title={dialog === 'reopen' ? t('reopenTitle') : t('closeTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              {tc('cancel')}
            </Button>
            <Button
              variant={dialog === 'close' ? 'danger' : 'primary'}
              onClick={async () => {
                try {
                  const c = await api<ChatSummary>(`/chats/${id}/${dialog === 'reopen' ? 'reopen' : 'close'}`, { method: 'POST' });
                  await mutateChat(c, { revalidate: false });
                  if (dialog === 'reopen') void refreshMe();
                } catch (e) {
                  setError(errorText(e));
                }
                setDialog(null);
              }}
            >
              {tc('confirm')}
            </Button>
          </>
        }
      >
        {dialog === 'reopen' ? t('reopenText', { cost: RULES.chatReopenCost }) : t('closeText')}
      </Modal>
    </div>
  );
}

function MenuItem({ icon, label, onClick, danger }: { icon: Parameters<typeof Icon>[0]['name']; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center gap-3 px-4 py-3 text-start text-sm font-semibold hover:bg-surface-alt ${danger ? 'text-danger' : ''}`}>
      <Icon name={icon} size={18} /> {label}
    </button>
  );
}

function WatcherRow({ icon, label }: { icon: Parameters<typeof Icon>[0]['name']; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <Icon name={icon} size={14} className="text-brand-500" /> {label}
    </li>
  );
}

function MahramDialog({ open, onClose, chatId }: { open: boolean; onClose: () => void; chatId: string }) {
  const t = useTranslations('chat.mahram');
  const te = useTranslations('enums.relation');
  const tc = useTranslations('common');
  const errorText = useErrorText();
  const [form, setForm] = useState({ name: '', relation: 'FATHER' as Relation, contact: '', note: '' });
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setState('busy');
    setError(null);
    try {
      await api(`/chats/${chatId}/mahram-contact`, { method: 'POST', body: { ...form, note: form.note.trim() || undefined } });
      setState('done');
    } catch (e) {
      setError(errorText(e));
      setState('idle');
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={t('title')}
        footer={
          state === 'done' ? (
            <Button onClick={onClose}>{tc('close')}</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={onClose}>
                {tc('cancel')}
              </Button>
              <Button loading={state === 'busy'} onClick={submit} disabled={form.name.trim().length < 2 || form.contact.trim().length < 5}>
                {t('submit')}
              </Button>
            </>
          )
        }
      >
        {state === 'done' ? (
          <Notice tone="success" icon="check">
            {t('submitted')}
          </Notice>
        ) : (
          <div className="space-y-4">
            <p>{t('intro')}</p>
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <Field label={t('name')}>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={60} />
              </Field>
              <Field label={t('relation')}>
                <Select value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value as Relation })}>
                  {Object.values(Relation).map((r) => (
                    <option key={r} value={r}>
                      {te(r)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label={t('contact')}>
              <Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} maxLength={120} dir="ltr" />
            </Field>
            <Field label={t('note')}>
              <Textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={300} />
            </Field>
            {error && <Notice tone="danger">{error}</Notice>}
          </div>
        )}
      </Modal>
    </>
  );
}
