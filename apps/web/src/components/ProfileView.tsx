"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { PublicProfile } from "@hitaba/shared";
import { mediaUrl } from "@/lib/api";
import { useDisplayNames } from "@/lib/format";
import { Icon, type IconName } from "./icons";
import { Chip, cx, Modal } from "./ui";

/**
 * Profil görünümü. Fotoğraf çoğu zaman gizli olduğundan (kadın onaylamadan erkek göremez, erkekler
 * varsayılan olarak akışta göstermez) büyük bir fotoğraf alanı yerine küçük, girih çerçeveli bir
 * avatar kullanılır; fotoğraf erişimi varsa dokununca büyür.
 */

/** Sekiz köşeli yıldız (girih) çerçeve — Hitaba logosundaki iç içe iki karenin halkası. */
function GirihRing({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={cx("pointer-events-none absolute inset-0", className)}
      aria-hidden="true"
    >
      <rect
        x="15"
        y="15"
        width="70"
        height="70"
        rx="10"
        fill="none"
        stroke="var(--brand-500)"
        strokeWidth="2.5"
      />
      <rect
        x="15"
        y="15"
        width="70"
        height="70"
        rx="10"
        fill="none"
        stroke="var(--accent-500)"
        strokeWidth="2.5"
        transform="rotate(45 50 50)"
      />
    </svg>
  );
}

export function ProfileAvatar({
  profile,
  size = 88,
  onOpen,
}: {
  profile: PublicProfile;
  size?: number;
  onOpen?: () => void;
}) {
  const t = useTranslations("profile");
  const photo = profile.photoUrls[0];
  const label = photo
    ? t("openPhoto")
    : profile.hasPhoto
      ? t(profile.gender === "FEMALE" ? "photoHiddenFemale" : "photoHiddenMale")
      : t("noPhoto");
  const inner = Math.round(size * 0.62);
  return (
    <button
      type="button"
      onClick={photo ? onOpen : undefined}
      disabled={!photo}
      aria-label={label}
      title={label}
      className="relative shrink-0 disabled:cursor-default"
      style={{ width: size, height: size }}
    >
      <GirihRing />
      <span
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full bg-brand-50"
        style={{ width: inner, height: inner }}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaUrl(photo)}
            alt=""
            className="h-full w-full select-none object-cover"
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
          />
        ) : (
          <span className="font-serif text-2xl font-semibold text-brand-600">
            {profile.displayName.slice(0, 1)}
          </span>
        )}
      </span>
      {(photo || profile.hasPhoto) && (
        <span className="absolute bottom-0 end-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-brand-500 text-brand-ink">
          <Icon name={photo ? "camera" : "lock"} size={14} />
        </span>
      )}
    </button>
  );
}

/** Büyük fotoğraf görünümü (yalnızca erişim izni olan fotoğraflar; kadın fotoğrafları filigranlı gelir). */
export function PhotoFrame({
  profile,
  className,
}: {
  profile: PublicProfile;
  className?: string;
}) {
  const [i, setI] = useState(0);
  const urls = profile.photoUrls;
  if (!urls.length) return null;
  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-card bg-surface-alt",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={mediaUrl(urls[i % urls.length])}
        alt={profile.displayName}
        className="h-full w-full select-none object-cover"
        draggable={false}
        onContextMenu={(e) => e.preventDefault()}
      />
      {urls.length > 1 && (
        <div className="absolute inset-x-3 top-2 flex gap-1">
          {urls.map((_, j) => (
            <button
              key={j}
              type="button"
              aria-label={`${j + 1}`}
              onClick={() => setI(j)}
              className={cx(
                "h-1 flex-1 rounded-full",
                j === i ? "bg-white" : "bg-white/40",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SectionCard({
  icon,
  title,
  children,
  accent,
}: {
  icon: IconName;
  title: string;
  children: ReactNode;
  accent?: boolean;
}) {
  return (
    <section
      className={cx(
        "rounded-card border bg-surface p-4",
        accent ? "border-accent/40" : "border-line",
      )}
    >
      <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-3">
        <Icon name={icon} size={15} className="text-brand-500" />
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Çocuk figürleri: dolu = birlikte yaşıyor, çizgili = ayrı yaşıyor. */
function ChildFigures({ total, living }: { total: number; living: number }) {
  const shown = Math.min(total, 6);
  return (
    <span className="flex shrink-0 items-end gap-1" aria-hidden="true">
      {Array.from({ length: shown }, (_, i) => (
        <svg
          key={i}
          viewBox="0 0 16 20"
          className={cx(
            "h-5 w-4",
            i < living ? "text-brand-500" : "text-ink-3",
          )}
        >
          <circle
            cx="8"
            cy="5"
            r="3.5"
            fill={i < living ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <path
            d="M2 19c.5-5 3-7.5 6-7.5s5.5 2.5 6 7.5Z"
            fill={i < living ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.4"
          />
        </svg>
      ))}
      {total > shown && (
        <span className="text-xs font-semibold text-ink-3">
          +{total - shown}
        </span>
      )}
    </span>
  );
}

export function ProfileCard({
  profile,
  actions,
}: {
  profile: PublicProfile;
  actions?: ReactNode;
}) {
  const t = useTranslations("profile");
  const te = useTranslations("enums");
  const names = useDisplayNames();
  const [photoOpen, setPhotoOpen] = useState(false);
  const facts = [
    profile.nationality,
    profile.heightCm && `${profile.heightCm} cm`,
    profile.weightKg && `~${profile.weightKg} kg`,
  ].filter(Boolean);
  const living =
    profile.childrenLivingWith === profile.childrenCount
      ? t("childrenLivingAll")
      : profile.childrenLivingWith === 0
        ? t("childrenLivingNone")
        : t("childrenLivingSome", { n: profile.childrenLivingWith });

  return (
    <div className="space-y-3">
      {/* Başlık: kimlik bilgisi yok, yaş yerine aralık (§8.4) */}
      <div className="relative overflow-hidden rounded-card border border-line bg-surface p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-[26px] font-semibold leading-tight">
              {profile.displayName}
              <span className="ms-2 font-sans text-lg font-normal text-ink-2">
                {t("ageRange", { range: profile.ageRange })}
              </span>
            </h2>
            <p className="mt-1 flex items-center gap-1 text-[15px] text-ink-2">
              <Icon name="globe" size={15} className="shrink-0 text-ink-3" />
              {profile.city}, {names.country(profile.country)}
            </p>
            {facts.length > 0 && (
              <p className="mt-0.5 text-[15px] text-ink-2">
                {facts.join(" · ")}
              </p>
            )}
          </div>
          <ProfileAvatar profile={profile} onOpen={() => setPhotoOpen(true)} />
        </div>
        <div className="mt-3 flex items-end gap-2">
          <div className="flex flex-1 flex-wrap gap-1.5">
            {profile.busy && (
              <Chip tone="warning">
                <Icon name="chat" size={12} /> {t("busy")}
              </Chip>
            )}
            {profile.willingToRelocate && (
              <Chip tone="info">
                <Icon name="globe" size={12} /> {t("relocate")}
              </Chip>
            )}
            {profile.gender === "FEMALE" && profile.witnessCount > 0 && (
              <Chip tone="accent">
                <Icon name="users" size={12} />{" "}
                {t("witnesses", { n: profile.witnessCount })}
              </Chip>
            )}
            {profile.hasWali && (
              <Chip tone="accent">
                <Icon name="shield" size={12} /> {t("wali")}
              </Chip>
            )}
          </div>
          {actions && (
            <div className="-mb-2 -me-2 flex shrink-0">{actions}</div>
          )}
        </div>
      </div>

      <SectionCard icon="users" title={t("family")}>
        <div className="divide-y divide-line">
          <p className="pb-2 text-[15px] font-semibold">
            {te(`marital.${profile.maritalStatus}`, { gender: profile.gender })}
            {profile.currentWives > 0 && (
              <span className="font-normal text-warning">
                {" "}
                · {t("currentWivesChip", { n: profile.currentWives })}
              </span>
            )}
          </p>
          <div className="flex items-center justify-between gap-3 py-2">
            {profile.childrenCount === 0 ? (
              <p className="text-[15px]">{t("noChildren")}</p>
            ) : (
              <>
                <div>
                  <p className="text-[15px] font-semibold">
                    {t("children", { n: profile.childrenCount })}
                  </p>
                  <p className="text-sm text-ink-3">{living}</p>
                </div>
                <ChildFigures
                  total={profile.childrenCount}
                  living={profile.childrenLivingWith}
                />
              </>
            )}
          </div>
          {(profile.nikahCount > 0 || profile.polygamyAnswer) && (
            <div className="space-y-1 pt-2 text-sm text-ink-3">
              {profile.nikahCount > 0 && (
                <p className="flex items-center gap-1.5">
                  <Icon name="clock" size={14} />{" "}
                  {t("previousNikahs", { n: profile.nikahCount })}
                </p>
              )}
              {profile.polygamyAnswer && (
                <p className="flex items-center gap-1.5">
                  <Icon name="users" size={14} /> {t("polygamy")}:{" "}
                  {te(`polygamy.${profile.polygamyAnswer}`)}
                </p>
              )}
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard icon="shield" title={t("beliefs")} accent>
        <p className="whitespace-pre-line text-[15px] leading-relaxed">
          {profile.beliefsManhaj}
        </p>
      </SectionCard>
      <SectionCard icon="user" title={t("aboutMe")}>
        <p className="whitespace-pre-line text-[15px] leading-relaxed">
          {profile.aboutMe}
        </p>
      </SectionCard>
      <SectionCard icon="heart" title={t("aboutSpouse")}>
        <p className="whitespace-pre-line text-[15px] leading-relaxed">
          {profile.aboutSpouse}
        </p>
      </SectionCard>
      <SectionCard icon="translate" title={t("languages")}>
        <div className="flex flex-wrap gap-1.5">
          {profile.languages.map((l) => (
            <Chip key={l}>{names.language(l)}</Chip>
          ))}
        </div>
      </SectionCard>

      <Modal
        open={photoOpen}
        onClose={() => setPhotoOpen(false)}
        title={profile.displayName}
      >
        <PhotoFrame profile={profile} className="aspect-[3/4] w-full" />
      </Modal>
    </div>
  );
}
