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

1. Proje oluşturun (bölge: kullanıcılara ve API'ye en yakın; ör. `aws-eu-central-1`).
2. İki bağlantı adresi alın:
   - **Havuzlu** (`-pooler` içeren) → `DATABASE_URL`, sonuna `&pgbouncer=true&connection_limit=10` ekleyin.
   - **Doğrudan** → `DIRECT_URL` (migration'lar bununla çalışır).
3. Şema, API açılırken `prisma migrate deploy` ile otomatik uygulanır. Elle: `DIRECT_URL=... npm run db:migrate -w @hitaba/api`.

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

Demo seed üretimde **çalışmaz** (yalnızca yerel veritabanına izin verir). Yöneticiler ve moderatörler şu komutla oluşturulur (moderasyon cinsiyete bölünmüş olduğu için en az bir erkek ve bir kadın moderatör gerekir):

```bash
DATABASE_URL=... DIRECT_URL=... ADMIN_EMAIL=... ADMIN_PASSWORD='en-az-14-karakter' ADMIN_GENDER=MALE ADMIN_ROLE=ADMIN \
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

Verim ~255 istek/sn'de sabitlendi: darboğaz yerel veritabanının tek bağlantısı. Gerçek kullanımda 100 aktif kullanıcı ≈ 20–40 istek/sn üretir. Neon (havuzlu bağlantı) üzerindeki staging ölçümü yayından önce tekrarlanmalı.
