import type { Cache, State } from 'swr';

/**
 * Uygulama açılır açılmaz son görülen ekranı gösterebilmek için SWR önbelleğinin bir kısmı
 * cihazda saklanır; veriler arkadan tazelenir. Mesaj içerikleri ve başkalarının profilleri
 * burada tutulmaz — yalnızca kendi hesabın, sohbet listesi, bildirimler ve beğeni listeleri.
 */
const KEY = 'hitaba.cache.v1';
const PERSIST = /^\/(me|notifications|chats|connects|likes|matches)(\?.*)?$/;

function readStored(): Array<[string, State]> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return Object.entries(JSON.parse(raw) as Record<string, unknown>).map(([k, data]) => [k, { data }]);
  } catch {
    return [];
  }
}

// En son kurulan önbellek (cachedMe/flush bunu okur).
let map: Map<string, State> | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let listening = false;

function flush() {
  if (!map) return;
  const out: Record<string, unknown> = {};
  for (const [k, v] of map) if (PERSIST.test(k) && v?.data !== undefined) out[k] = v.data;
  try {
    localStorage.setItem(KEY, JSON.stringify(out));
  } catch {
    /* yoksay */
  }
}

/**
 * SWRConfig `provider` olarak verilir. Her çağrıda YENİ bir Map döner: dil değişince sağlayıcı
 * yeniden kurulur ve SWR eski sağlayıcıyı kapatırken onun önbelleğini kendi kaydından siler.
 * Aynı Map paylaşılırsa yeni sağlayıcının kaydı da silinir ve uygulama çöker
 * ("undefined is not iterable"). Veriler yeni Map'e kopyalanır, kaybolmaz.
 */
export function persistentCache(): Cache {
  const seed: Array<[string, State]> = map ? [...map] : typeof window === 'undefined' ? [] : readStored();
  const m = new Map(seed);
  map = m;
  const set = m.set.bind(m);
  m.set = (k, v) => {
    set(k, v);
    if (PERSIST.test(k)) {
      clearTimeout(timer);
      timer = setTimeout(flush, 400);
    }
    return m;
  };
  if (typeof window !== 'undefined' && !listening) {
    listening = true;
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
  }
  return m;
}

/** Oturum kapanınca (ya da başka hesaba geçilince) saklanan her şey silinir. */
export function clearPersistedCache() {
  clearTimeout(timer);
  map?.clear();
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(FEED_KEY);
  } catch {
    /* yoksay */
  }
}

/** Önbellekteki son kullanıcı (açılışta yönlendirme için). */
export function cachedMe<T>(): T | undefined {
  if (map) return map.get('/me')?.data as T | undefined;
  return (typeof window === 'undefined' ? undefined : new Map(readStored()).get('/me')?.data) as T | undefined;
}

// Akışta en son gösterilen kart: açılışta hemen gösterilir, sonra sunucudan tazelenir.
const FEED_KEY = 'hitaba.feedCard.v1';
export function readFeedCard<T>(scope: string): T | undefined {
  try {
    const v = JSON.parse(localStorage.getItem(FEED_KEY) ?? 'null') as { scope: string; card: T } | null;
    return v?.scope === scope ? v.card : undefined;
  } catch {
    return undefined;
  }
}
export function writeFeedCard(scope: string, card: unknown) {
  try {
    if (card) localStorage.setItem(FEED_KEY, JSON.stringify({ scope, card }));
    else localStorage.removeItem(FEED_KEY);
  } catch {
    /* yoksay */
  }
}
