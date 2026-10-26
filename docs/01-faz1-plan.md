# Hitaba — Faz 1 (MVP) Uygulama Planı

Kaynak: `00-mimari-tasarim.md`. Bu dosya, mimari dokümanın Faz 1 kapsamının **nasıl** kodlandığını anlatır.

## Kararlar

| Konu | Karar | Gerekçe |
|---|---|---|
| İstemci | Next.js 15 (App Router) — tek kod tabanı: Web PWA + Telegram Mini App + Veli portalı + Moderatör paneli | Tek deploy, ortak tasarım sistemi |
| Backend | NestJS 11 modüler monolit | Mimari dokümandaki servis sınırları = Nest modülleri; ileride mikroservise ayrılabilir |
| Veritabanı | PostgreSQL + Prisma 6 | Geliştirmede PGlite (WASM Postgres, kurulum gerektirmez), üretimde gerçek Postgres |
| Gerçek zamanlı | Socket.io (`/chat` namespace) | Tek instance'ta adaptörsüz; ölçeklemede Redis adapter |
| Cache / rate-limit | Redis (opsiyonel) → yoksa bellek içi yedek | Geliştirme sürtünmesiz |
| Dosya | Yerel disk (`apps/api/storage`), `StorageService` arayüzü ile S3'e geçiş | Fotoğraflar asla public URL ile servis edilmez, API üzerinden filigranlı akar |
| Diller | uz (varsayılan), ru, tr, en — ar (RTL) altyapısı hazır | |
| Ödeme | Telegram Stars (Faz 1); kart/PSP Faz 2 | |
| Monorepo | npm workspaces: `apps/api`, `apps/web`, `packages/shared` | |

## Faz 1 modülleri (API)

| Modül | Sorumluluk |
|---|---|
| `auth` | E-posta/şifre kayıt-giriş, Telegram initData HMAC-SHA256 doğrulama, JWT access + refresh, rol guard'ları |
| `profiles` | Sihirbaz adımları (taslak otomatik kayıt), tarama soruları (AES-256-GCM şifreli, yalnızca moderatör), profil düzenleme → serbest metin yeniden moderasyon |
| `photos` | Yükleme (maks 3), filigranlı servis (izleyen adı + ID), görüntüleme logu, 24 saat penceresi |
| `moderation` | AI ön tarama (arayüz + kural tabanlı ilk sürüm), insan kuyruğu — **cinsiyete bölünmüş erişim** |
| `matching` | Tek kart feed, filtreler, beğeni/geç, favori, karşılıklılar, erkek günlük 10 beğeni limiti (kullanıcının saat diliminde gece yarısı) |
| `photo-exchange` | Kadın önce erkeğin fotoğrafını görür → onaylarsa erkek kadının fotoğrafını görür |
| `chat` | Connect harcayarak açılış, şahit listesi, iletişim bilgisi engelleme (mesaj tutulur + sohbet durur), 15 dk düzenleme, yumuşak silme, 3 tepki, sessizlik kuralı (24/48/72 saat), uzatma, kadın için tek aktif sohbet |
| `wali` | Token linki, şahitler (maks 2, isim + yakınlık), salt-okunur görünüm, iptal/yeniden oluşturma, mahrem iletişim paylaşımı (moderatör onaylı) |
| `connects` | Bakiye, işlem defteri, Telegram Stars faturası + webhook, moderatör kapatmasında otomatik iade |
| `notifications` | Uygulama içi + Telegram bot mesajı |
| `reports` | Her ekrandan şikâyet |
| `admin` | Kullanıcı arama, ban/dondurma, sohbet denetimi, erişim logu |

## Faz 1 ekranları (Web)

- `/` tanıtım · `/login` · `/register` · `/tg` (Telegram Mini App girişi)
- `/onboarding` — adım adım sihirbaz
- `/app/feed` · `/app/likes` (Favoriler / Beğenilerim / Karşılıklılar) · `/app/chats` · `/app/chats/[id]`
- `/app/profile` · `/app/wallet` · `/app/wali` (veli & şahitler — kadın) · `/app/settings`
- `/wali/[token]` — kayıtsız, salt-okunur
- `/admin` — moderasyon kuyruğu, şikâyetler, sohbetler, kullanıcılar

## Faz 1'de bilinçli olarak YOK

Veli OTP, kademeli iade, 2FA, kimlik rozeti, mahr aracı (Faz 2) · istihare, aile görüşmesi, video (Faz 3).
Gerçek AI moderasyon sağlayıcısı: arayüz hazır, ilk sürüm kural tabanlı.
