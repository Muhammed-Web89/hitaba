'use client';

/**
 * Kök düzen dahil her şey çökerse son çare. Çeviri sağlayıcısı burada yoktur; dil cihazdan seçilir.
 * Stiller satır içidir (uygulamanın CSS'i yüklenmemiş olabilir).
 */
const TEXT: Record<string, [string, string, string]> = {
  uz: ['Nimadir xato ketdi', 'Sahifani qayta yuklang. Muammo takrorlansa, birozdan keyin urinib koʻring.', 'Qayta yuklash'],
  ru: ['Что-то пошло не так', 'Перезагрузите страницу. Если ошибка повторится, попробуйте чуть позже.', 'Перезагрузить'],
  tr: ['Bir şeyler ters gitti', 'Sayfayı yeniden yükleyin. Sorun sürerse biraz sonra tekrar deneyin.', 'Yeniden yükle'],
  en: ['Something went wrong', 'Reload the page. If it happens again, try a little later.', 'Reload'],
  ar: ['حدث خطأ ما', 'أعد تحميل الصفحة. وإن تكرر الخطأ فحاول بعد قليل.', 'إعادة التحميل'],
};

export default function GlobalError() {
  const lang = typeof navigator === 'undefined' ? 'en' : (navigator.language || 'en').slice(0, 2);
  const [title, text, reload] = TEXT[lang] ?? TEXT.en;
  return (
    <html lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <body style={{ margin: 0, minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#060a0e', color: '#e7efef', fontFamily: 'system-ui, -apple-system, sans-serif', padding: 16 }}>
        <div style={{ maxWidth: 360, textAlign: 'center', border: '1px solid #24363a', borderRadius: 20, padding: 24, background: '#0d171b' }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>{title}</h1>
          <p style={{ color: '#a9babc', lineHeight: 1.5 }}>{text}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ marginTop: 8, width: '100%', height: 48, border: 0, borderRadius: 14, background: '#2ccdbd', color: '#04201d', fontSize: 16, fontWeight: 600 }}
          >
            {reload}
          </button>
        </div>
      </body>
    </html>
  );
}
