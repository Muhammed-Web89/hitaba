"use client";

import { useTranslations } from "next-intl";
import type { ChatMessage, Relation } from "@hitaba/shared";
import { useRelativeTime } from "@/lib/format";
import { Icon } from "./icons";
import { cx } from "./ui";

export interface MessageActions {
  onReact?: (m: ChatMessage, reaction: string | null) => void;
  onEdit?: (m: ChatMessage) => void;
  onDelete?: (m: ChatMessage) => void;
  canEdit?: (m: ChatMessage) => boolean;
}

/**
 * Mesaj listesi — katılımcı sohbeti ve salt-okunur veli portalı ortak kullanır.
 * `viewerId` yoksa (veli) "benim" hizalaması kadının mesajlarına göre yapılır.
 */
export function MessageList({
  messages,
  mineId,
  reactions = [],
  actions,
  labels,
}: {
  messages: ChatMessage[];
  mineId: string | null;
  reactions?: readonly string[];
  actions?: MessageActions;
  labels?: { mine?: string; theirs?: string };
}) {
  const t = useTranslations("chat");
  const te = useTranslations("enums.relation");
  const time = useRelativeTime();

  let lastDay = "";
  return (
    <ol className="select-none space-y-2" onCopy={(e) => e.preventDefault()}>
      {messages.map((m) => {
        const day = time.day(m.createdAt);
        const showDay = day !== lastDay;
        lastDay = day;
        const dayRow = showDay && (
          <li
            key={`day-${m.id}`}
            className="py-2 text-center text-xs font-semibold text-ink-3"
            aria-hidden="true"
          >
            {day}
          </li>
        );

        if (m.kind === "SYSTEM") {
          return [
            dayRow,
            <li key={m.id} className="flex justify-center">
              <span className="max-w-[85%] rounded-full bg-surface-alt px-3 py-1 text-center text-xs text-ink-2">
                {t.has(`system.${m.text}` as never)
                  ? t(`system.${m.text}` as never)
                  : m.text}
              </span>
            </li>,
          ];
        }

        if (m.kind === "MAHRAM_CONTACT") {
          let c: {
            name: string;
            relation: Relation;
            contact: string;
            note?: string | null;
          } | null = null;
          try {
            c = JSON.parse(m.text);
          } catch {
            /* yoksay */
          }
          return [
            dayRow,
            <li key={m.id} className="flex justify-center">
              <div className="w-full max-w-sm rounded-card border border-accent/40 bg-surface p-4">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent">
                  <Icon name="shield" size={14} /> {t("mahramCard")}
                </p>
                {c && (
                  <>
                    <p className="mt-2 font-semibold">
                      {c.name} · {te(c.relation)}
                    </p>
                    <p className="mt-1 font-mono text-[15px]" dir="ltr">
                      {c.contact}
                    </p>
                    {c.note && (
                      <p className="mt-1 text-sm text-ink-2">{c.note}</p>
                    )}
                  </>
                )}
              </div>
            </li>,
          ];
        }

        const mine = m.senderId === mineId;
        const held = m.state === "HELD";
        const rejected = m.state === "REJECTED";
        return [
          dayRow,
          <li
            key={m.id}
            className={cx(
              "group flex flex-col",
              mine ? "items-end" : "items-start",
            )}
          >
            {labels && (
              <span className="mb-0.5 px-1 text-[11px] font-semibold text-ink-3">
                {mine ? labels.mine : labels.theirs}
              </span>
            )}
            <div
              className={cx(
                "relative max-w-[82%] rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed",
                mine
                  ? "rounded-ee-sm bg-bubble"
                  : "rounded-es-sm bg-surface-alt",
                (held || rejected) &&
                  "border border-dashed border-warning bg-warning-bg",
              )}
            >
              {m.deleted ? (
                <span className="italic text-ink-3">{t("deleted")}</span>
              ) : (
                <span className="whitespace-pre-wrap break-words">
                  {m.text}
                </span>
              )}
              <span className="ms-2 inline-flex translate-y-0.5 items-center gap-1 text-[11px] text-ink-3">
                {m.editedAt && !m.deleted && t("edited")}
                {time.time(m.createdAt)}
              </span>
            </div>
            {held && (
              <span className="mt-1 text-xs text-warning">{t("heldNote")}</span>
            )}
            {rejected && (
              <span className="mt-1 text-xs text-danger">
                {t("rejectedNote")}
              </span>
            )}

            {m.reactions.length > 0 && (
              <div className="-mt-1.5 flex gap-0.5 rounded-full border border-line bg-surface px-1.5 text-sm">
                {m.reactions.map((r) => (
                  <span key={r.userId}>{r.reaction}</span>
                ))}
              </div>
            )}

            {actions && !m.deleted && m.state === "DELIVERED" && (
              <div className="mt-1 flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                {!mine &&
                  reactions.map((r) => {
                    const active = m.reactions.some(
                      (x) => x.userId === mineId && x.reaction === r,
                    );
                    return (
                      <button
                        key={r}
                        type="button"
                        aria-pressed={active}
                        onClick={() => actions.onReact?.(m, active ? null : r)}
                        className={cx(
                          "h-7 rounded-full px-2 text-sm",
                          active ? "bg-brand-100" : "hover:bg-surface-alt",
                        )}
                      >
                        {r}
                      </button>
                    );
                  })}
                {mine && actions.canEdit?.(m) && (
                  <button
                    type="button"
                    onClick={() => actions.onEdit?.(m)}
                    className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs font-semibold text-ink-3 hover:bg-surface-alt"
                  >
                    <Icon name="edit" size={14} /> {t("edit")}
                  </button>
                )}
                {mine && (
                  <button
                    type="button"
                    onClick={() => actions.onDelete?.(m)}
                    className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs font-semibold text-ink-3 hover:bg-surface-alt"
                  >
                    <Icon name="trash" size={14} /> {t("delete")}
                  </button>
                )}
              </div>
            )}
          </li>,
        ];
      })}
    </ol>
  );
}
