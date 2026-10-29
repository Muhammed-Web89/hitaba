# Hitaba

Şahitli, veli onaylı, nikah niyetli eşleşme platformu. Web PWA + Telegram Mini App, 5 dil (uz · ru · tr · en · ar).

- Ürün/mimari: [`docs/00-mimari-tasarim.md`](docs/00-mimari-tasarim.md)
- Faz 1 uygulama planı: [`docs/01-faz1-plan.md`](docs/01-faz1-plan.md)
- **Üretim yayını (Vercel + API + Neon + R2 + Resend): [`docs/02-yayin.md`](docs/02-yayin.md)**

## Yapı

```
apps/api         NestJS 11 + Prisma 6 (PostgreSQL) + Socket.io — modüler monolit
apps/web         Next.js 15 + next-intl + Tailwind 4 — kullanıcı uygulaması, veli portalı, moderatör paneli
packages/shared  Ortak enum'lar, kurallar, zod şemaları, iletişim bilgisi dedektörü
```

## Çalıştırma (geliştirme)

```bash
npm install
npm run build:shared
npm run db                 # PGlite (kurulum gerektirmeyen Postgres) → 127.0.0.1:54329
npm run db:push            # şema (ayrı terminalde)
npm run db:seed            # demo hesapları
npm run dev:api            # http://localhost:4000
npm run dev:web            # http://localhost:3737
```

Hepsi birden: `npm run dev` (db + api + web).

`apps/api/.env` dosyası `.env.example`'dan oluşturulur (gizli anahtarlar için açıklamalara bakın). Docker varsa `docker compose up -d` ile gerçek Postgres + Redis kullanılabilir; `DATABASE_URL`'i ona göre değiştirin.

## Çevrimiçi paylaşma (geçici)

```bash
npm run share
```

Uygulamayı üretim modunda derler, başlatır ve Cloudflare tüneliyle `https://….trycloudflare.com` adresinde herkese açar (adres terminalde yazar). Hesap gerekmez; adres her seferinde değişir ve yalnızca bu bilgisayar açık ve komut çalışırken erişilebilir. API, aynı adresin `/api` yolundan sunulur.

> Demo hesapları ve `hitaba123` şifresi herkese açık adreste de geçerlidir — adresi yalnızca güvendiğiniz kişilerle paylaşın.

## Demo hesapları

Tüm şifreler: `hitaba123` — **yalnızca yerel geliştirme.** Seed yalnızca yerel veritabanında çalışır; API üretimde bu hesapları görürse açılmaz. Üretim yöneticisi: `npm run create-admin -w @hitaba/api` (bkz. docs/02-yayin.md).

| E-posta | Rol |
|---|---|
| `admin@hitaba.dev` | Admin (erkek) |
| `mod.m@hitaba.dev` / `mod.f@hitaba.dev` | Moderatör (erkek / kadın) |
| `ali@` · `umar@` · `yusuf@hitaba.dev` | Erkek |
| `aisha@` · `maryam@` · `fatima@hitaba.dev` | Kadın |

## Testler

```bash
npm test                                  # birim testleri (shared + api)
npm run smoke -w @hitaba/api              # çalışan API'ye karşı uçtan uca akış (11 adım)
npm run ratelimit -w @hitaba/api          # istek sınırı (429) ve sahte X-Forwarded-For
npm run loadtest -w @hitaba/api           # yük testi (LT_USERS, LT_SECONDS, LT_WRITES=1)
npm run check:i18n -w @hitaba/web         # 5 dil dosyasının anahtar eşitliği
npm run typecheck
```

## Dil davranışı

Varsayılan dil cihazdan (`Accept-Language`) algılanır; desteklenmeyen bir dilse İngilizce açılır. İlk ziyarette dil seçim ekranı her zaman gösterilir (algılanan dil önceden seçili). Arapça sağdan sola (RTL) düzenle gelir.

## Telegram

`apps/api/.env` içinde `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` doldurulduğunda:
- Mini App girişi `/tg` sayfasından (initData HMAC-SHA256 doğrulaması),
- Telegram Stars ile connect satın alma,
- Bot bildirimleri etkinleşir. Webhook: `POST /telegram/webhook` (`setWebhook` ile `secret_token` verin).
