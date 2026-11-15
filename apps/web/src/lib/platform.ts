const KEY = "hitaba.android";

/**
 * Play Store sürümü (Trusted Web Activity) mi? Uygulama /app?twa=1 ile açılır; işaret oturum boyunca
 * sessionStorage'da tutulur (TWA, Chrome ile depolamayı paylaştığı için localStorage tarayıcıya sızardı).
 * Play kuralları gereği bu sürümde ücretli jeton satışı gösterilmez.
 */
export function isAndroidApp(): boolean {
  try {
    if (
      new URLSearchParams(window.location.search).has("twa") ||
      document.referrer.startsWith("android-app://me.hitaba.app")
    ) {
      sessionStorage.setItem(KEY, "1");
    }
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
