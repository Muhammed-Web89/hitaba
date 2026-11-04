'use client';

import { use, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import useSWR from 'swr';
import { Relation, RULES, scanForContactInfo, type ChatMessage, type ChatSummary } from '@hitaba/shared/client';
import { Icon } from '@/components/icons';
import { ChatRulesSheet } from '@/components/ChatRulesSheet';
import { MessageList, type ListMessage } from '@/components/MessageList';
import { ReportDialog } from '@/components/ReportDialog';
import { Button, Field, IconButton, Input, Modal, Notice, PageLoader, Select, Textarea } from '@/components/ui';
import { Link, useRouter } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useErrorText } from '@/lib/format';
import { getSocket } from '@/lib/socket';

// Sohbete geri dönünce mesajlar sunucuyu beklemeden hemen görünsün (yalnızca bellekte, oturum boyunca).
const messageCache = new Map<string, ListMessage[]>();

function upsert(list: ListMessage[], m: ListMessage): ListMessage[] {
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
  const [messages, setMessages] = useState<ListMessage[] | null>(() => messageCache.get(id) ?? null);
  useEffect(() => {
    if (messages) messageCache.set(id, messages);
  }, [id, messages]);
  const [text, setText] = useState('');
  const [rulesOpen, setRulesOpen] = useState(false);
  // Kurallar her sohbette ilk açılışta bir kez gösterilir.
  useEffect(() => {
    try {
      const key = `hitaba.chatRules.${id}`;
      if (!localStorage.getItem(key)) {
        setRulesOpen(true);
        localStorage.setItem(key, '1');
      }
    } catch {
      /* yoksay */
    }
  }, [id]);
  const box = useRef<HTMLTextAreaElement>(null);
  // Gönderince ya da düzenleme iptal edilince kutu tek satıra döner.
  useEffect(() => {
    if (!text && box.current) box.current.style.height = '';
  }, [text]);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warn, setWarn] = useState(false);
  const [menu, setMenu] = useState(false);
  const [watchersOpen, setWatchersOpen] = useState(false);
  const [dialog, setDialog] = useState<'mahram' | 'close' | 'report' | 'reopen' | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  // Sohbet çevirisi: açıkken karşı tarafın mesajları uygulamada seçilen dile çevrilir (tercih sohbet başına hatırlanır).
  const locale = useLocale();
  const tt = useTranslations('translate');
  const translateKey = `hitaba.chatTranslate.${id}`;
  const [translateOn, setTranslateOn] = useState(false);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const requested = useRef(new Set<string>());
  useEffect(() => {
    try {
      setTranslateOn(localStorage.getItem(translateKey) === '1');
    } catch {
      /* yoksay */
    }
  }, [translateKey]);
  function toggleTranslate() {
    const next = !translateOn;
    setTranslateOn(next);
    try {
      localStorage.setItem(translateKey, next ? '1' : '0');
    } catch {
      /* yoksay */
    }
  }
  useEffect(() => {
    // Dil değişirse eski çeviriler geçersiz.
    requested.current = new Set();
    setTranslations({});
  }, [locale]);
  useEffect(() => {
    if (!translateOn || !me?.translation || !messages) return;
    const ids = messages
      .filter((m) => m.senderId !== me.id && m.kind === 'TEXT' && m.state === 'DELIVERED' && !m.deleted && !m.pending && !requested.current.has(m.id))
      .map((m) => m.id);
    if (!ids.length) return;
    ids.forEach((x) => requested.current.add(x));
    for (let i = 0; i < ids.length; i += 60) {
      api<Record<string, string>>('/translate/messages', { method: 'POST', body: { chatId: id, ids: ids.slice(i, i + 60), lang: locale } }).then(
        (res) => setTranslations((cur) => ({ ...cur, ...res })),
        () => ids.slice(i, i + 60).forEach((x) => requested.current.delete(x)),
      );
    }
  }, [translateOn, messages, me, id, locale]);

  const load = useCallback(async () => {
    const fresh = await api<ChatMessage[]>(`/chats/${id}/messages`);
    // Yolda olan ya da gönderilemeyen yerel mesajlar kaybolmasın.
    setMessages((l) => (l ?? []).filter((m) => (m.pending || m.failed) && !fresh.some((f) => f.clientId === m.clientId)).reduce(upsert, fresh));
  }, [id]);

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
    // Hata kutusu açılınca alt çubuk büyür; son mesaj görünür kalsın.
  }, [messages?.length, error]);

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

  /** Mesaj hemen ekrana konur; sunucu onayı arkadan gelir (iyimser gönderim). */
  function send(force = false, retryOf?: ListMessage) {
    const body = (retryOf?.text ?? text).trim();
    if (!body) return;
    // İstemci tarafı ön uyarı; sunucu yine de otoritedir (§5.5 "Yine de gönder").
    if (!force && !retryOf && scanForContactInfo(body).blocked) return setWarn(true);
    setWarn(false);
    setError(null);
    if (!retryOf) setText('');

    if (editing && !retryOf) {
      const before = editing;
      setEditing(null);
      setMessages((l) => (l ? upsert(l, { ...before, text: body, editedAt: new Date().toISOString() }) : l));
      api<ChatMessage>(`/messages/${before.id}`, { method: 'PATCH', body: { text: body } }).then(
        (m) => setMessages((l) => (l ? upsert(l, m) : l)),
        (e) => {
          setMessages((l) => (l ? upsert(l, before) : l));
          setError(errorText(e));
        },
      );
      return;
    }

    const clientId = retryOf?.clientId ?? crypto.randomUUID();
    const local: ListMessage = {
      id: retryOf?.id ?? `local-${clientId}`,
      chatId: id,
      senderId: me!.id,
      kind: 'TEXT',
      state: 'DELIVERED',
      text: body,
      editedAt: null,
      deleted: false,
      createdAt: retryOf?.createdAt ?? new Date().toISOString(),
      reactions: [],
      clientId,
      pending: true,
    };
    setMessages((l) => (l ? upsert(l, local) : [local]));

    const viaRest = () => api<ChatMessage>(`/chats/${id}/messages`, { method: 'POST', body: { text: body, clientId } });
    const s = getSocket();
    // Önce socket; bağlantı yoksa ya da zaman aşımında REST'e düşer. Sunucu hatası olduğu gibi gösterilir.
    const sent = s?.connected
      ? new Promise<ChatMessage>((resolve, reject) =>
          s.timeout(10_000).emit('message:send', { chatId: id, text: body, clientId }, (err, res) => {
            if (err) return viaRest().then(resolve, reject);
            if (res.ok && res.message) return resolve(res.message);
            reject(new ApiError(400, res.error ?? 'failed'));
          }),
        )
      : viaRest();
    sent.then(
      (m) => {
        setMessages((l) => (l ? upsert(l, m) : l));
        if (m.state === 'HELD') void mutateChat();
      },
      (e) => {
        setMessages((l) => (l ? upsert(l, { ...local, pending: false, failed: true }) : l));
        setError(errorText(e));
        void mutateChat();
      },
    );
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
          {me.translation && (
            <IconButton
              icon="translate"
              label={translateOn ? tt('chatOff') : tt('chatOn')}
              aria-pressed={translateOn}
              onClick={toggleTranslate}
              className={translateOn ? '!text-brand-500 bg-brand-50 shadow-[0_0_18px_-6px_var(--brand-500)]' : ''}
            />
          )}
          <div className="relative">
            <IconButton icon="more" label={t('menu')} onClick={() => setMenu(!menu)} aria-expanded={menu} />
            {menu && (
              <div className="absolute end-0 top-11 z-30 w-60 overflow-hidden glass rounded-card border" onClick={() => setMenu(false)}>
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
        <div className="flex items-center bg-brand-50 text-xs font-semibold text-brand-600">
          <button type="button" onClick={() => setWatchersOpen(!watchersOpen)} aria-expanded={watchersOpen} className="flex flex-1 items-center gap-1.5 px-4 py-2">
            <Icon name="users" size={14} /> {t('watchers', { n: watcherCount })}
            <Icon name="chevronDown" size={14} className={watchersOpen ? 'rotate-180' : ''} />
          </button>
          <button type="button" onClick={() => setRulesOpen(true)} className="inline-flex items-center gap-1 px-4 py-2 text-brand-500">
            <Icon name="shield" size={14} /> {t('rulesSheet.button')}
          </button>
        </div>
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
              translations: translateOn ? translations : undefined,
              onReact: (m, r) => api<ChatMessage>(`/messages/${m.id}/reaction`, { method: 'PUT', body: { reaction: r } }).then((x) => setMessages((l) => (l ? upsert(l, x) : l))),
              onEdit: (m) => {
                setEditing(m);
                setText(m.text);
              },
              onRetry: (m) => send(true, m),
              onDelete: (m) => api<ChatMessage>(`/messages/${m.id}`, { method: 'DELETE' }).then((x) => setMessages((l) => (l ? upsert(l, x) : l))),
            }}
          />
        </div>
        <div ref={bottom} />
      </div>

      <footer className="glass border-t px-3 py-2" style={{ paddingBottom: 'max(8px, var(--app-safe-bottom))' }}>
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
            send();
          }}
        >
          <textarea
            ref={box}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setWarn(false);
              // Yazdıkça büyür (en fazla ~6 satır), sonra kendi içinde kaydırılır.
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 168)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            disabled={!active}
            rows={1}
            maxLength={RULES.messageMaxChars}
            placeholder={active ? t('placeholder') : t('placeholderDisabled')}
            aria-label={t('placeholder')}
            className="max-h-[168px] min-h-12 flex-1 resize-none rounded-2xl border border-line bg-base px-4 py-3 text-base leading-snug text-ink placeholder:text-ink-3 focus:border-brand-500 focus:outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!active || !text.trim()}
            aria-label={t('send')}
            // Dokununca yazı kutusu odağını kaybetmesin: klavye kapanıp açılmaz, ekran zıplamaz.
            onPointerDown={(e) => e.preventDefault()}
            onMouseDown={(e) => e.preventDefault()}
            className="glow flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-500 text-brand-ink disabled:opacity-40"
          >
            <Icon name="send" size={20} className="flip-rtl" />
          </button>
        </form>
      </footer>

      <ChatRulesSheet open={rulesOpen} onClose={() => setRulesOpen(false)} />
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
