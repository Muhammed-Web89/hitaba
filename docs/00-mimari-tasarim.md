# Halal Nikah Platformu — Ürün Mimarisi & Tasarım Dokümanı

**Durum:** Konsept / Mimari Taslak
**Kapsam:** Zawji App'in tüm temel özellikleri + yeni önerilen geliştirmeler
**Amaç:** Bu dosyayı okuyan biri, uygulamanın uçtan uca nasıl çalıştığını, hangi ekranların olduğunu, verinin nasıl aktığını ve nasıl göründüğünü zihninde canlandırabilmeli.

---

## 1. Vizyon ve Konumlandırma

İslami şeriat kurallarına (uzlet/halvet yasağı, şahitli iletişim, mahrem sınırları, veli onayı) sıkı sıkıya bağlı, nikah niyetiyle eşleşme sağlayan; aynı zamanda Zawji App'in bıraktığı boşlukları (güven, şeffaflık, mahr müzakeresi, aile süreci, hesap güvenliği) kapatan bir platform.

**Temel ilkeler:**
- Hiçbir zaman iki yabancı kişi arasında gözetimsiz, şahitsiz birebir iletişim kurulmaz.
- Kadın kullanıcının fotoğrafı, konumu, çevrimiçi durumu varsayılan olarak kapalıdır; her açılma onun kararıyla ve kayıtla gerçekleşir.
- Her adımda "neden bu adım var" dini/işlevsel gerekçesi kullanıcıya gösterilir (güven inşası).
- Moderasyon insan + yapay zekâ hibrit, ama nihai karar her zaman insan.
- Gelir modeli kaliteyi finanse eder (moderatör, güvenlik, şahitlik), ama erişimi engellemez (temel akış kadınlara her zaman ücretsiz).

---

## 2. Kullanıcı Rolleri

| Rol | Yetki | Kayıt Gerekir mi |
|---|---|---|
| Kardeş (Erkek) | Profil, arama, beğeni, sohbet başlatma (ücretli) | Evet |
| Abla (Kadın) | Profil, arama, beğeni (ücretsiz/limitsiz), fotoğraf kontrolü | Evet |
| Veli | Sohbeti salt-okunur izleme, onay verme, OTP ile kimlik doğrulama | Hayır (OTP ile geçici oturum) |
| Şahit (max 2) | Sohbeti salt-okunur izleme | Hayır (link + opsiyonel OTP) |
| Mahrem (iletişim bilgisi alıcısı) | Kendi kimliğini doğrulayıp iletişim bilgisini teyit etme | Hayır (SMS/ses kaydı ile) |
| Moderatör (Erkek/Kadın ayrı) | Profil, fotoğraf, sohbet denetimi — cinsiyete göre bölünmüş erişim | İç ekip hesabı |
| İçerik/Fıkıh Moderatörü | Öğrencilere Sor bölümü, itikad/menhec denetimi | İç ekip hesabı |
| Admin / Güven & Güvenlik Ekibi | Tüm sistem, ban, iade, güvenlik olayları | İç ekip hesabı, 2FA zorunlu |
| Destek | Kullanıcı talepleri, ödeme sorunları | İç ekip hesabı |

---

## 3. Platform Erişim Noktaları

1. **Telegram Mini App** — birincil giriş kanalı, Telegram Stars ödeme desteği, HMAC-SHA256 ile kimlik doğrulama.
2. **Web App (PWA)** — e-posta/şifre veya Telegram ile giriş, kart/PayPal/kripto ödeme.
3. **iOS / Android (native veya React Native/Flutter)** — push bildirim, biyometrik kilit, kamera entegrasyonu.
4. **Veli/Şahit Erişim Sayfası** — kayıtsız, token tabanlı, salt-okunur web sayfası (OTP katmanlı — bkz. Bölüm 8).

Tüm istemciler aynı backend API'sini kullanır; bakiye (connect), profil, sohbet durumu tüm platformlarda senkron.

---

## 4. Genel Sistem Mimarisi

```
┌─────────────────────────────────────────────────────────────────┐
│                         İSTEMCİLER                               │
│  Telegram Mini App | Web PWA | iOS | Android | Veli Web Portalı  │
└───────────────────────────┬────────────────────────────────────┘
                             │ HTTPS / WSS (gerçek zamanlı sohbet)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API GATEWAY / BFF                            │
│  Kimlik doğrulama · Rate limiting · İstek doğrulama · Loglama     │
└───────────────────────────┬────────────────────────────────────┘
                             ▼
        ┌────────────────────────────────────────────┐
        │              MİKROSERVİSLER                  │
        ├────────────────────────────────────────────┤
        │ Auth & Identity Service                       │
        │ Profile Service                               │
        │ Matching Service (feed, filtreler, algoritma)│
        │ Chat Service (WebSocket, mesaj, moderasyon)   │
        │ Moderation Service (AI + insan kuyruğu)       │
        │ Wali/Mahram Service                           │
        │ Payment & Connects Service                    │
        │ Mahr Negotiation Service                      │
        │ Family Meeting Scheduler Service               │
        │ Video Call Service (gözetimli)                │
        │ Notification Service (push/email/Telegram)    │
        │ Trust & Safety Service (ban, rapor, log)       │
        │ Post-Nikah Support Service                     │
        └────────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                         VERİ KATMANI                               │
│ PostgreSQL (ana veri) · Redis (oturum/cache/rate-limit)            │
│ S3 uyumlu obje depolama (fotoğraf/video, şifreli)                  │
│ Elasticsearch (arama/filtre) · ClickHouse (analitik, anonim)        │
└─────────────────────────────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DIŞ SERVİSLER (izole, kapsam sınırlı erişim)    │
│ AI Moderasyon (metin/görsel) · Makine Çevirisi · SMS/OTP sağlayıcı │
│ Ödeme sağlayıcıları (Telegram Stars, kart PSP, kripto gateway)     │
│ Push (FCM/APNs) · E-posta · Hata izleme (Sentry benzeri)           │
└─────────────────────────────────────────────────────────────────┘
```

**Önerilen teknoloji yığını (örnek, değiştirilebilir):**
- Backend: Node.js (NestJS) veya Go — mikroservisler arası iletişim gRPC/REST
- Gerçek zamanlı sohbet: WebSocket (Socket.io / native ws) + mesaj kuyruğu (Kafka/RabbitMQ) moderasyon işleme için
- Mobil: Flutter (tek kod tabanıyla iOS/Android, adaptif tema desteği native)
- Web: Next.js (SSR, SEO için blog/landing), PWA desteği
- Veritabanı: PostgreSQL (ana), Redis (oturum, feed cache, rate limit, OTP kodları)
- Dosya depolama: S3 uyumlu + sunucu taraflı şifreleme (SSE-KMS), fotoğraflar için ayrı "private bucket"
- Mesajlaşma/kuyruk: Kafka (moderasyon event pipeline) veya RabbitMQ (daha hafif başlangıç için)
- Arama/filtre: Elasticsearch veya PostgreSQL full-text + GIN index (başlangıç için yeterli)
- Konteynerizasyon: Docker + Kubernetes (otomatik ölçekleme, bölgesel dağıtım)
- CI/CD: GitHub Actions / GitLab CI, otomatik güvenlik taraması (SAST/DAST) pipeline'a entegre

---

## 5. Özellik Haritası (Zawji App Temel Özellikleri + Yeni Eklemeler)

### 5.1 Kayıt ve Profil
- Adım adım sihirbaz: kadın 11, erkek 10 + yeni adımlar (kimlik doğrulama rozeti isteğe bağlı)
- Alanlar: ad/takma ad, yaş (18+), ülke/şehir, milliyet (baba esaslı), boy/kilo (yaklaşık), medeni durum, nikah sayısı (20'ye kadar), çocuk sayısı, "Hakkımda" (min. 100 karakter), "İtikad, menhec ve âlimler" bölümü
- Tarama soruları (namaz, alkol, madde, nikah dışı ilişki, bulaşıcı hastalık; kadında ayrıca hicap) — **yalnızca moderatöre görünür**
- Kadın ek adımı: Veli ve Şahitler
- Otomatik taslak kaydı (yarıda bırakılsa geri dönülür)
- Profil düzenleme: serbest metin alanları yeniden moderasyona girer, sayısal/toggle alanlar anında kaydedilir
- İsim değişikliği ücretli (kötüye kullanımı önlemek için)
- **Yeni:** Opsiyonel kimlik doğrulama rozeti — pasaport/kimlik yükleme + yüz eşleştirme, "Doğrulanmış Profil" rozeti (zorunlu değil, güven sinyali)
- **Yeni:** İtikad/menhec metninden kullanıcı onaylı anahtar kelime etiketleme (katı filtre değil, arama kolaylığı)

### 5.2 Moderasyon
- İlk tarama: AI (metin + görsel)
- İkinci tarama: insan moderatör — kadın fotoğrafları yalnızca kadın moderatöre, erkek fotoğrafları yalnızca erkek moderatöre
- Reddedilen profile açık gerekçe (çoğu durumda); şüpheli dublaj gerekçesi gizli tutulur (istismarı önlemek için)
- Fotoğraf/ana profil moderasyonu ayrı ayrı yürür — biri beklerken diğeri yayında kalır
- "Yine de gönder" butonu — AI yanlış pozitif durumunda insan incelemesine yönlendirir
- Toplu zayıf profil taraması ve yeniden düzenlemeye zorlama

### 5.3 Eşleşme Akışı
- Tek kart feed (❤️ / ✕), bir seferde bir profil
- Filtreler: ülke/şehir (bölge grupları dahil), milliyet, dil, yaş, boy/kilo, taşınmaya açıklık, fotoğraflı/fotoğrafsız, çocuksuz, hiç evlenmemiş, çok eşliliğe açık
- Favoriler (⭐), Beğenilerim, Karşılıklılar sekmeleri
- Günlük limit: erkek 10 ücretsiz beğeni (gece yarısı bölgesel saatte sıfırlanır), kadın sınırsız ve ücretsiz
- Kaçırılan profili geri getirme (son kaçırma ücretsiz, geçmişe dönük ücretli)
- Filtre aboneliği (yeni uygun profil/müsait olan kadın bildirimi, ücretli)
- "Şu an sohbette" rozetiyle meşgul kadın profili gösterimi, gizlenebilir

### 5.4 Fotoğraf Değişimi
- Kadın fotoğrafı asla toplu listede görünmez
- Sıra: kadın önce erkek fotoğrafını görür → beğenirse erkek kadının fotoğrafını görür
- Erkek isteğe bağlı "Akışta fotoğrafımı göster" ayarı açabilir (varsayılan kapalı)
- Maks. 3 fotoğraf (1 ana + 2 ek) + 5 saniyelik sessiz video
- Kadın fotoğrafında filigran (izleyen adı + ID), 24 saat görüntüleme süresi, karar kalıcı
- Her görüntüleme loglanır, moderatör erişebilir
- Tekrar görüntüleme talebi (moderatör onayına tabi, çift başına 1 kez)
- **Yeni:** Fotoğraf için "algısal bulanıklaştırma kademeleri" — ilk bakışta hafif bulanık, karşı taraf "ilgileniyorum" dedikten sonra netleşir (ekstra bir güven katmanı, opsiyonel ayar)

### 5.5 Sohbet (Şahitli İletişim)
- Chat yalnızca karşılıklı beğeni + fotoğraf onayından sonra açılır (1 connect)
- Her sohbette: erkek moderatör + kadın moderatör + AI moderatör (7/24) + kadının eklediği şahitler (max 2) + bağlıysa veli
- İletişim bilgisi (telefon, @kullanıcı adı, link, e-posta) otomatik engellenir, mesaj karşıya ulaşmaz, sohbet moderatör onayına kadar duraklar
- Maskeleme/parçalama denemeleri tespit edilir
- Yerleşik çeviri (iki yönlü, otomatik veya buton ile)
- Mesaj düzenleme (15 dk içinde, yeniden moderasyona girer), silme (karşı tarafta gizlenir, moderatörde kalır)
- Tepkiler sadece 3 emoji (👍 ✅ ❤️)
- Sessizlik kuralı: 24 saat → hatırlatma, 48 saat → ikinci hatırlatma, ~72 saat → otomatik kapanma
- "Sohbeti uzat" butonu (mesaj sayılmaz, ücretsiz)
- Bir kez kapatılan sohbet 1 connect karşılığı yeniden açılabilir (1 kez)
- Kadının aynı anda yalnızca 1 aktif sohbeti olabilir; erkek sınırsız sohbet yürütebilir
- "Sohbeti başlatmasını iste" (kadın için ücretsiz, erkek öder)

### 5.6 Veli ve Mahrem Sistemi (geliştirilmiş)
- Her kadın profili için benzersiz token tabanlı link (`app.example/wali/{token}`)
- **Yeni — güvenlik katmanı:** Link açıldığında veli/şahit, kayıtlı telefon numarasına gönderilen **tek kullanımlık OTP kodu** ile kimliğini doğrular (ilk erişimde zorunlu, sonraki erişimlerde cihaz hatırlama + periyodik yeniden doğrulama)
- Salt-okunur erişim: en son sohbeti görür, yazamaz
- Erişimi iptal et / yeni link oluştur (eskisini geçersiz kılar)
- Şahit ekleme: isim + yakınlık derecesi zorunlu (en fazla 2)
- Karşı taraf şahit sayısını ve yakınlık derecesini görür, isim/iletişim bilgisi görünmez
- Mahrem iletişim bilgisi paylaşımı: "Mahrem iletişim bilgisi paylaş" formu → moderatör onayı → sohbete otomatik mesaj olarak yayınlanır
- **Yeni:** Mahrem kendi kimliğini link + kısa sesli kayıt ("Ben [isim], [yakınlık derecesi]yim ve bu görüşmeden haberdarım") ile doğrulayabilir — moderatöre ek güven sinyali
- **Yeni:** Veli paneli genişletilmiş görünüm — aday özetleri, anket, şahit listesi, görüşme zaman çizelgesi tek ekranda; veli yalnızca kendi tarafına özel notlar ekleyebilir (karşı tarafa görünmez)

### 5.7 Connect (Sanal Para) ve Ödeme
- 1 connect = 1 sohbet başlatma; connect süresiz, devredilemez
- Paket indirimi (çok alana ucuz), 30 günlük sınırsız abonelik
- Ödeme yöntemleri: Telegram Stars, kart (PSP üzerinden, kart bilgisi uygulamaya hiç gelmez), PayPal, kripto (USDT/BTC/TON), destek üzerinden banka havalesi
- Ücretsiz connect kazanma: kanal aboneliği, ihlal bildirme, kadınlar için arkadaş davet programı
- **İade modeli — geliştirilmiş (Zawji'nin katı "10 mesaj" kuralına alternatif):**
  - 0–5 mesaj: %100 iade
  - 6–10 mesaj: %50 iade
  - 11+ mesaj veya mahrem bilgisi paylaşıldıysa: iade yok
  - Tek taraflı erken çıkış butonu ("Bu sohbeti ciddiye almıyorum") — karşı taraf hiç yazmadıysa başlatan için tam iade
- Moderatör tarafından kapatılan/banlanan hesap sohbetlerinde otomatik iade
- Ban durumunda bakiye sıfırlanır (ceza), para iadesi yok

### 5.8 Mahr Müzakere Aracı (Yeni)
- Sohbet içinde ayrı, yapılandırılmış bir "Mahr" sekmesi
- Her iki taraf bağımsız olarak doldurur: mahr türü (nakit/altın/eşya/karma), miktar aralığı (açık uçlu, "tartışmaya açık" seçeneği), ödeme zamanlaması (peşin/vadeli/karma)
- Doldurulduktan sonra her iki taraf da "Paylaş" dediğinde karşılıklı görünür hale gelir (tek taraflı erken paylaşım yok — baskı oluşturmaz)
- Uyuşmazlık durumunda "ailelerle görüşülecek" notu otomatik eklenir
- Bu araç sohbetin bir parçası olduğu için aynı moderasyon/şahitlik kapsamındadır

### 5.9 İstihare Takip (Yeni)
- Sohbet 5–7 gün sürdüğünde nazik, baskı yapmayan bir hatırlatma: "İstihare yaptınız mı?"
- Kullanıcı isterse kısa bir dua/istihare rehberi içerik kartı açılır
- Zorunlu değil, kapatılabilir; amaç farkındalık, takip değil

### 5.10 Aile Görüşmesi Planlayıcı (Yeni)
- Mahrem iletişim bilgisi paylaşıldıktan ve her iki aile de hazır olduğunda etkinleşir
- Takvim entegrasyonu: her iki tarafın müsait zaman aralıklarını işaretlemesi, kesişen saatleri önerme
- Görüşme hatırlatıcı bildirimleri (push/e-posta)
- Bu adım uygulama dışına (gerçek görüşmeye) köprü kurar, uygulama içinde veri tutmaya devam etmez — gizlilik gereği

### 5.11 Gözetimli Video Görüşme (Yeni)
- Metin sohbeti belirli bir aşamaya (ör. mahrem bilgisi paylaşımı) ulaştığında açılır
- Görüşme sırasında moderatör gözetimi veya kayıt (kullanıcı onayıyla, KVKK/GDPR uyumlu saklama süresiyle) — "yalnız kalma" ilkesini bozmaz
- Görüşme süresi sınırlı (ör. 15–20 dk), kayıt yalnızca ihlal şikâyeti durumunda incelenir, aksi halde otomatik silinir

### 5.12 Bildirimler
- Yeni beğeni/karşılıklılık, fotoğraf sırası, sohbet daveti, sessizlik hatırlatıcıları
- Filtre aboneliği eşleşme bildirimi (toplu, günlük tavanlı)
- Kanallar: push (FCM/APNs), Telegram botu, e-posta (sınırlı, spam önleme amaçlı tavanlı)

### 5.13 Güven & Güvenlik
- Hesap başına tekil kimlik (dublaj = her iki hesabın da banı)
- Ekran görüntüsü yasağı (teknik olarak tam engellenemez ama kural + filigran + loglama caydırıcı)
- Şikâyet butonu her ekranda (profil, sohbet, fotoğraf)
- Çocuk güvenliği: 18 yaş altı otomatik red, şüpheli durumlarda yayına alınmama, öncelikli 24 saat içinde inceleme kanalı
- **Yeni:** 2FA (SMS/authenticator app) — özellikle yüksek bakiyeli/sınırsız abonelik hesapları için teşvik edilir
- **Yeni:** Kimlik doğrulama rozeti (opsiyonel)
- **Yeni:** Şeffaf güvenlik sayfası — pentest özet raporları, responsible disclosure programı, bug bounty

### 5.14 Nikah Sonrası Destek (Yeni)
- Nikah kıyıldığını bildiren çiftler için opsiyonel "İlk Yıl" kaynak kütüphanesi (makale, video, podcast önerileri)
- Anlaşmalı aile danışmanlığı yönlendirme ağı
- Anonim, isteğe bağlı "başarı hikâyesi" paylaşım formu (pazarlama + topluluk güveni için)

### 5.15 Blog, SSS, Şeffaflık Sayfaları
- Çok dilli blog (fıkhi sorular, kullanım rehberleri)
- 250+ maddelik SSS, aranabilir, bölümlere ayrılmış
- Kurallar sayfası (kısa özet) + Kullanıcı Sözleşmesi (hukuki tam metin)
- Gizlilik Politikası, İade Politikası, Çocuk Güvenliği Standartları, Hesap Silme sayfası — ayrı ayrı, güncel tarihli

---

## 6. Veri Modeli (Özet Varlıklar)

```
User
 ├─ id, role (male/female), email/telegram_id, phone (hash + plain for OTP only)
 ├─ auth: password_hash, 2fa_enabled, verified_id_badge
 ├─ status: pending_moderation / approved / rejected / banned / frozen / deleted
 └─ created_at, last_login (dahili, kullanıcıya gösterilmez)

Profile
 ├─ user_id (FK)
 ├─ name/pseudonym, age, country, city, nationality
 ├─ height, weight, marital_status, nikah_count, children_count
 ├─ about_me (text, min 100 char), about_spouse (text)
 ├─ beliefs_manhaj (text), beliefs_tags[] (opsiyonel, kullanıcı onaylı)
 ├─ screening_answers (encrypted, moderator-only)
 └─ polygamy_answer (yes/no/prefer_not_to_say — yalnızca kadın)

Photo
 ├─ id, user_id, type (main/extra/video)
 ├─ storage_key (şifreli bucket), status (pending/approved/rejected)
 ├─ moderator_id, moderated_at
 └─ watermark_log[] (kim, ne zaman görüntüledi)

WaliLink
 ├─ id, profile_id (kadın), token (random, yüksek entropi)
 ├─ otp_required (bool), verified_sessions[]
 ├─ witnesses[] (name, relation — token ile ilişkili, kayıt gerektirmez)
 └─ revoked_at

Match
 ├─ id, user_a_id, user_b_id, status (liked/mutual/photo_exchange/chat_open/closed)
 └─ timestamps her aşama için

Chat
 ├─ id, match_id, opened_by, connect_spent
 ├─ status (active/paused/closed/reopened)
 ├─ witness_moderator_male_id, witness_moderator_female_id
 ├─ mahram_contact_shared (bool, timestamp)
 └─ messages[] (text, sender, sent_at, edited_at, deleted flag, moderation_flag)

MahrProposal (Yeni)
 ├─ chat_id, user_id, type, amount_range, timing
 └─ shared (bool) — her iki taraf da paylaşana kadar karşı tarafa gizli

FamilyMeeting (Yeni)
 ├─ chat_id, proposed_slots[], confirmed_slot, status

VideoCallSession (Yeni)
 ├─ chat_id, started_at, ended_at, recording_key (opsiyonel, süreli saklama), moderator_present

ConnectTransaction
 ├─ user_id, amount, type (purchase/spend/refund/bonus), related_chat_id, created_at

ModerationQueueItem
 ├─ target_type (profile/photo/chat_message), target_id
 ├─ ai_flag, assigned_moderator_id, decision, decided_at

Report
 ├─ reporter_id, target_user_id, category, status, resolved_at
```

---

## 7. Güvenlik Mimarisi (Önceki Analize Dayalı İyileştirmeler)

| Risk Alanı | Önlem |
|---|---|
| Veli linki sızıntısı | Token yüksek entropili + OTP doğrulama + "erişimi iptal et" her zaman açık + cihaz bazlı oturum süresi (ör. 7 gün sonra yeniden OTP) |
| Hesap ele geçirme | 2FA (opsiyonel → yüksek bakiyede zorunlu), şüpheli giriş bildirimleri, cihaz listesi ve "tüm oturumları kapat" |
| Sohbet verisi sızıntısı | Veritabanında at-rest şifreleme, moderatör erişim logları (kim, ne zaman, hangi sohbeti okudu — denetlenebilir) |
| AI moderasyon dış servis riski | Yalnızca gerekli içerik gönderilir (isim/iletişim verisi hariç), sözleşmeyle veri işleme sınırlanır, mümkünse bölgesel/kendi barındırılan model tercih edilir |
| Ödeme verisi | Kart bilgisi hiçbir zaman kendi sunucularına dokunmaz, PCI-DSS uyumlu PSP kullanılır |
| Kaba kuvvet / otomasyon | Rate limiting (API Gateway), CAPTCHA kayıt ve şüpheli giriş denemelerinde, bot tespiti (davranışsal) |
| İçerik/veri kötüye kullanımı | Ekran görüntüsü filigranı + loglama, "tekrar görüntüleme" moderatör onayına bağlı |
| Şeffaflık | Yayınlanmış güvenlik sayfası, responsible disclosure e-postası, periyodik bağımsız pentest özeti |
| Çocuk güvenliği | Yaş doğrulama + AI şüphe tespiti + öncelikli 24 saat inceleme kanalı + yetkililere bildirim süreci |

---

## 8. Adaptif Tasarım Sistemi (Açık / Koyu Tema)

### 8.1 Tasarım Felsefesi

Zawji App'in sıcak, kağıt tonlu ("manuscript") estetiğinden ilham alınır ama daha modern bir bileşen dili ve daha güçlü bir koyu tema ile geliştirilir. Diğer İslami eşleştirme uygulamalarının (genelde aşırı pembe/mor, "dating app" hissi veren) aksine, **sakin, saygılı, cami/kütüphane hissi veren ama modern ve hızlı** bir arayüz hedeflenir. Sistem, cihazın `prefers-color-scheme` ayarını otomatik algılar; kullanıcı isterse manuel geçersiz kılabilir.

### 8.2 Renk Tokenleri

```css
:root {
  /* Marka rengi — zümrüt yeşili, İslami estetikle örtüşür ama aşırı klişe olmayan bir ton */
  --color-brand-50:  #EEF7F1;
  --color-brand-100: #D3EBDB;
  --color-brand-300: #8FCBA3;
  --color-brand-500: #2F8F5B;   /* ana marka rengi */
  --color-brand-600: #24734A;
  --color-brand-700: #1B5938;

  /* Nötr / kağıt tonu — Zawji'nin EDE7DA tonundan ilham, biraz daha modernize */
  --color-paper-50:  #FBFAF6;
  --color-paper-100: #F3F0E7;
  --color-paper-200: #E8E3D4;

  /* Vurgu — altın/mahr temasına gönderme, aşırı kullanılmaz */
  --color-accent-500: #C79A4B;

  /* Anlamsal renkler */
  --color-success: #2F8F5B;
  --color-warning: #C77F2E;
  --color-danger:  #B6412E;
  --color-info:    #3B6E91;

  /* Yüzeyler — Açık tema */
  --bg-base:        var(--color-paper-50);
  --bg-surface:     #FFFFFF;
  --bg-surface-alt: var(--color-paper-100);
  --border-subtle:  var(--color-paper-200);
  --text-primary:   #1C1B17;
  --text-secondary: #5A574C;
  --text-muted:     #8C887A;
}

/* Koyu tema — otomatik (cihaz ayarı) */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg-base:        #121410;
    --bg-surface:     #1B1E18;
    --bg-surface-alt: #242821;
    --border-subtle:  #333830;
    --text-primary:   #F2F0E8;
    --text-secondary: #B8B5A8;
    --text-muted:     #7D7A6E;

    --color-brand-500: #4FB37A;   /* koyu zeminde biraz daha parlak */
    --color-accent-500: #D9B06A;
  }
}

/* Manuel geçersiz kılma (kullanıcı ayarı) */
:root[data-theme="dark"] {
  --bg-base:        #121410;
  --bg-surface:     #1B1E18;
  --bg-surface-alt: #242821;
  --border-subtle:  #333830;
  --text-primary:   #F2F0E8;
  --text-secondary: #B8B5A8;
  --text-muted:     #7D7A6E;
  --color-brand-500: #4FB37A;
  --color-accent-500: #D9B06A;
}

body {
  background: var(--bg-base);
  color: var(--text-primary);
}
```

### 8.3 Tipografi

- **Başlıklar:** Yeni serif tabanlı bir font (ör. "Fraunces" veya "Lora") — sıcak, güvenilir, "kitap" hissi
- **Gövde metni:** Yüksek okunabilirlik sans-serif (ör. "Inter" veya "Manrope")
- **Arapça/RTL destek:** "Noto Naskh Arabic" (dini metinler, dua, ayet alıntıları için), tam RTL layout desteği
- Tip ölçeği: 12 / 14 / 16 / 18 / 22 / 28 / 36 px, satır yüksekliği 1.4–1.6

### 8.4 Bileşen Dili

- **Köşe yarıçapı:** 12px (kartlar), 8px (butonlar/input) — çok keskin değil, çok yuvarlak değil, "sakin" his
- **Gölgeler:** Çok hafif, diffüz (`box-shadow: 0 2px 12px rgba(0,0,0,0.06)` açık temada; koyu temada gölge yerine ince border kullanılır)
- **Kartlar:** Profil kartı — üstte fotoğraf alanı (varsayılan olarak bulanık/silüet ikon kadın profillerinde), altta isim yaşı yerine "yaş aralığı + şehir", itikad/menhec özet rozeti
- **Butonlar:**
  - Birincil: dolu `--color-brand-500`, beyaz metin
  - İkincil: çerçeveli, şeffaf zemin
  - Tehlikeli aksiyon (ban, sil): `--color-danger`, her zaman onay modalı ile
- **İkonografi:** Çizgi tabanlı (outline), dolu değil — daha modern ve hafif bir his; cami kubbesi/hilal gibi klişe dini ikonlardan kaçınılır, bunun yerine soyut geometrik desenler (İslami geometrik motiflerden ilham alan ince çizgi desenler, arka plan dokusu olarak çok düşük opaklıkla kullanılır)
- **Arka plan dokusu:** Çok düşük opaklıkta (%2–4) geometrik İslami desen (girih deseni) — hem açık hem koyu temada, aşırıya kaçmadan kimlik hissi verir

### 8.5 Ana Ekranlar — Tasarım Notları

1. **Feed (Anketler) Ekranı**
   - Tam ekran kart, üstte ince ilerleme çubuğu (kaç profil kaldığını hissettirir)
   - Alt kısımda büyük ❤️ ve ✕ butonları + yan tarafta küçük "⭐ Favorile" ikonu
   - Kart üst köşede "Doğrulanmış" rozeti (varsa), itikad/menhec etiketleri küçük chip'ler halinde

2. **Karşılıklılar Sekmesi**
   - Liste görünümü, her satırda durum ikonu (kum saati / kamera / yeşil sohbet butonu / gri "sohbette")
   - Durum renkleri anlamsal tokenlerle eşleşir (info/warning/success)

3. **Sohbet Ekranı**
   - Üstte "Şahitler: 3" satırı, tıklanınca açılır liste (moderatörler + şahitler + veli rozetleri)
   - Mesaj balonları: gönderen sağda `--color-brand-100` zemin, alıcı solda `--bg-surface-alt`
   - Engellenen mesaj denemesi kullanıcıya görünür uyarı kartıyla gösterilir (kırmızı değil, `--color-warning` tonunda — cezalandırıcı değil bilgilendirici his)
   - Alt sabit bar: metin girişi + çeviri toggle + "⋮" menü (mahrem paylaş, mahr aracı, şikâyet)

4. **Mahr Aracı (Yeni)**
   - Sohbetin üstünde ayrı sekme/panel, iki sütun (siz / karşı taraf), karşı taraf dolana kadar bulanık
   - "Paylaş" butonu basılana kadar hiçbir veri karşıya gitmez

5. **Veli Portalı (Web, kayıtsız)**
   - Sade, tek sütun, mobil öncelikli
   - Üstte OTP doğrulama ekranı, sonra salt-okunur sohbet görünümü — yazma alanı yok, sadece "Yenile" butonu
   - Köşede "Bu bir salt-okunur görünümdür" açıklaması her zaman sabit

6. **Profil Düzenleme**
   - Form alanları bölüm bölüm (akordiyon), her bölüm kaydedildiğinde yeşil tik animasyonu
   - "Hakkımda" alanı canlı karakter sayacı (100 karakter altı kırmızı uyarı)

### 8.6 Erişilebilirlik
- Kontrast oranı WCAG AA (metin/arkaplan min 4.5:1) — hem açık hem koyu temada test edilir
- Tüm ikon butonlarında `aria-label`
- Dinamik tip ölçekleme (sistem yazı boyutu ayarına uyum)
- RTL dillerde (Arapça) tüm layout aynalanır, ikon yönleri (ileri/geri ok) tersine döner

---

## 9. Yol Haritası (Öneri)

**Faz 1 — MVP (Zawji parite + temel güvenlik)**
Kayıt/profil, moderasyon, feed/eşleşme, fotoğraf değişimi, şahitli sohbet, veli linki (OTP'siz), connect/ödeme, temel bildirimler.

**Faz 2 — Güven ve Fark Yaratma**
Veli linki OTP katmanı, kademeli iade modeli, kimlik doğrulama rozeti, 2FA, güvenlik sayfası, mahr müzakere aracı.

**Faz 3 — Derinleştirme**
İstihare hatırlatıcı, aile görüşmesi planlayıcı, gözetimli video görüşme, nikah sonrası destek, bölgesel fiyatlandırma (PPP).

**Faz 4 — Ölçekleme**
Çok bölgeli altyapı, gelişmiş AI moderasyon (kendi barındırılan model), bağımsız pentest + bug bounty programı, topluluk/başarı hikâyeleri modülü.

---

*Bu doküman bir ürün/mimari taslağıdır; hukuki (KVKK/GDPR), fıkhi (âlim onayı) ve güvenlik (bağımsız denetim) doğrulamaları olmadan üretime alınmamalıdır.*
