# Hitaba — Yayın (üretim) rehberi

Mimari: **Web → Vercel** · **API → Railway / Fly.io / Render** (Docker) · **Veritabanı → Neon** · **Fotoğraflar → Cloudflare R2 (özel bucket)** · **E-posta → Resend**.

```
Tarayıcı / Telegram Mini App
   │  https
   ├──► Vercel (Next.js, apps/web)
   └──► API (NestJS + Socket.io, apps/api/Dockerfile) ──► Neon Postgres (havuzlu bağlantı)
                                     ├──► R2 özel bucket (fotoğraflar, yalnızca API okur)
                                     └──► Resend (doğrulama e-postaları)
```

## Neon planı

- **Free**: geliştirme ve staging için yeterli.
- **Launch**: 200–400 üyeyle canlıya çıkarken geçin. Free plandaki işlem süresi ve depolama kotası yetmez; kota dolunca veritabanı durur.
- Üretim ve staging için **ayrı Neon projeleri** (ya da en azından ayrı branch'ler) kullanın; yük testi asla üretim veritabanında yapılmaz.

## 1. Neon

Proje: `plain-grass-41703862` (org `org-bold-bonus-99421134`, bölge `aws-us-east-2`). Depo `neon init` ile bağlı (`neon.ts`, git'e girmeyen `.neon`).

| Dal | Kullanım |
|---|---|
| `production` (varsayılan) | Canlı. Şema uygulandı, **demo/test verisi yok**. Seed bu dalda çalışmaz. |
| `dev-*` (`neon checkout dev --create`) | Yerel geliştirme; `neon.ts` politikasıyla 7 gün sonra kendiliğinden silinir. |
| geçici test dalı | `neon branches create --name e2e-… --parent production --expires-at …`; testten sonra silinir. |

Bağlantı adları `neon env pull` çıktısıyla aynıdır (Prisma `url`/`directUrl` bunlara bağlı):

- `DATABASE_URL` — **havuzlu** (`-pooler`, PgBouncer transaction modu): uygulama trafiği.
- `DATABASE_URL_UNPOOLED` — **doğrudan**: migration'lar (`prisma migrate`).

Yerelde `neon deploy` / `neon checkout` / `neon env pull` bu değerleri depo kökündeki `.env.local`'a yazar; API (`src/config/load-env.ts`) ve Prisma CLI sarmalayıcısı (`scripts/prisma.mjs`) önce bu dosyayı, sonra `apps/api/.env`'i okur. Üretimde değişkenler platformdan gelir.

**Sürücü:** Prisma + `@prisma/adapter-pg` (node-postgres) — uzun ömürlü sunucu için Neon önerisi. Prisma'nın yerleşik motoru Neon'un `channel_binding=require` parametresini desteklemiyor (yanıltıcı `P1001` hatası) ve macOS'ta sıkı sertifika doğrulaması yapamıyor. node-postgres ise TLS 1.3 + sertifika/host doğrulaması (`sslmode=verify-full`'a sabitlenir) ve kanal bağlamalı SCRAM kullanır. Migration'larda (Prisma CLI) yalnızca `channel_binding` parametresi kaldırılır; bağlantı yine TLS'lidir.

Migration: API açılışında `node scripts/prisma.mjs migrate deploy` otomatik çalışır. Elle: `npm run db:migrate -w @hitaba/api` · durum: `npm run db:status -w @hitaba/api`.

## 2. Cloudflare R2 (fotoğraflar)

1. Bucket: `hitaba-photos`. **Public access: kapalı** (varsayılan). Özel alan adı bağlamayın.
2. R2 API token: yalnızca bu bucket'a *Object Read & Write*.
3. `STORAGE_DRIVER=s3`, `S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com`, `S3_REGION=auto`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.
4. API açılışta bucket'a erişimi kontrol eder; erişemezse başlamaz.

Fotoğraflar hiçbir zaman doğrudan R2 adresinden servis edilmez: API yetkiyi kontrol eder, kadın fotoğrafına filigran basar ve görüntülemeyi kaydeder.

## 3. Resend (e-posta)

1. Gönderim alan adınızı doğrulayın (SPF/DKIM DNS kayıtları).
2. `MAIL_DRIVER=resend`, `RESEND_API_KEY`, `MAIL_FROM="Hitaba <no-reply@alanadiniz>"`.

## 4. API (Railway / Fly.io / Render)

- Derleme: depo kökü bağlam, `apps/api/Dockerfile`.
- Sağlık kontrolü: `GET /health`.
- Tek instance ile başlayın (istek sınırı ve Socket.io bellek içi). İkinci instance gerekirse önce Redis (throttler + socket.io adapter) eklenmeli.
- Ortam değişkenleri: `apps/api/.env.example` — üretimde ayrıca:

| Değişken | Değer |
|---|---|
| `NODE_ENV` | `production` |
| `TRUST_PROXY` | `1` (platformun tek proxy hop'u) |
| `WEB_ORIGIN` | `https://<vercel alan adı>` |
| `PUBLIC_WEB_URL` | `https://<vercel alan adı>` |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | ayrı, ≥32 karakter rastgele |
| `ENCRYPTION_KEY` | 32 bayt base64 — **yedekleyin**, kaybolursa şifreli veriler okunamaz |
| `DEV_PAYMENTS` | boş / `false` |

**Üretim korumaları:** API, şu durumlarda başlamayı reddeder: zayıf/aynı JWT anahtarları, `DEV_PAYMENTS` açık, yerel disk depolama, e-posta sağlayıcısı yok, https olmayan adresler, veritabanında `@hitaba.dev` demo hesabı bulunması.

## 5. Web (Vercel)

- Root directory: `apps/web` (kurulum/derleme komutları `apps/web/vercel.json`'da).
- Ortam değişkeni: `NEXT_PUBLIC_API_URL=https://<api alan adı>`.

## 6. İlk yönetici

Demo seed üretimde **çalışmaz**: yalnızca yerel veritabanında ya da `SEED_ALLOW_HOST` ile açıkça adlandırılmış geçici bir test dalında çalışır; `NEON_BRANCH=production` iken her durumda reddedilir. Yöneticiler ve moderatörler şu komutla oluşturulur (moderasyon cinsiyete bölünmüş olduğu için en az bir erkek ve bir kadın moderatör gerekir):

```bash
DATABASE_URL=... ADMIN_EMAIL=... ADMIN_PASSWORD='en-az-14-karakter' ADMIN_GENDER=MALE ADMIN_ROLE=ADMIN \
  npm run create-admin -w @hitaba/api
```

## 7. Yayın öncesi kontrol listesi

- [ ] Gizlilik politikası ve kullanım koşulları hukukçu tarafından incelendi; şirket unvanı ve iletişim adresi dolduruldu (`legal.*` çevirileri), `POLICY_VERSION` güncellendi
- [ ] Neon **Launch** planında; otomatik yedekleme/PITR açık
- [ ] R2 bucket public erişime kapalı
- [ ] Resend alan adı doğrulandı; doğrulama e-postası gerçek bir adrese ulaştı
- [ ] `ENCRYPTION_KEY` güvenli bir yerde yedeklendi
- [ ] En az 1 erkek + 1 kadın moderatör oluşturuldu
- [ ] Staging'de: `npm run smoke`, `npm run ratelimit`, `npm run loadtest` geçti (aşağıya bakın)

## Testler (staging'e karşı)

```bash
API_URL=https://staging-api... npm run smoke -w @hitaba/api        # uçtan uca akış (dev posta kutusu gerekir → yerel/staging log sürücüsü)
API_URL=https://staging-api... npm run ratelimit -w @hitaba/api    # 429 ve X-Forwarded-For sahteciliği
API_URL=https://staging-api... LT_USERS=100 LT_SECONDS=60 LT_EMAILS=... LT_PASSWORD=... npm run loadtest -w @hitaba/api
```

### Yük testi — yerel temel ölçüm (2026-10-29)

Yerel PGlite (tek bağlantı), okuma + yazma karışımı, sanal kullanıcılar beklemesiz art arda istek atıyor:

| Eşzamanlı | istek/sn | p50 | p97.5 | p99 | hata |
|---|---|---|---|---|---|
| 50 | 263 | 183 ms | 263 ms | 274 ms | 0 |
| 100 | 255 | 374 ms | 522 ms | 545 ms | 0 |

Verim ~255 istek/sn'de sabitlendi: darboğaz yerel veritabanının tek bağlantısı. Gerçek kullanımda 100 aktif kullanıcı ≈ 20–40 istek/sn üretir.

### Yük testi — Neon geçici test dalı, API Türkiye'de (2026-10-29)

Yalnızca okuma; API bu Mac'te (Türkiye), veritabanı Neon `us-east-2`. Tek sorgu gidiş-dönüşü **~148 ms** (min 143, max 245).

| Eşzamanlı | istek/sn | p50 | p97.5 | hata |
|---|---|---|---|---|
| 5 | 8 | 521 ms | 1156 ms | 0 |
| 100 | 9 | 5332 ms | 8063 ms | %77 (zaman aşımı) |

Bu ölçüm **kıtalararası gecikmeyi** ölçer, kapasiteyi değil: bir istek art arda 3–10 sorgu yapar (her biri ~148 ms) ve 10 bağlantılık havuz 100 kullanıcıda kuyruğa girer. Üretimde API Neon ile aynı bölgede (Render Ohio ↔ `us-east-2`, gidiş-dönüş ~1–2 ms) çalışmalı; **geçerli kapasite ölçümü yayından sonra aynı bölgeden** (`API_URL=https://hitaba-api… npm run loadtest`) yapılmalıdır. İyileştirme fırsatı: istek başına sıralı sorgu sayısını azaltmak (ör. `toPublic` içindeki sorguları birleştirmek).
