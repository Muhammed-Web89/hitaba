import type { AuthTokens } from '@hitaba/shared';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const ACCESS = 'hitaba.access';
const REFRESH = 'hitaba.refresh';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public details?: unknown,
  ) {
    super(code);
  }
}

// Depolama erişimi gizli modda/engelli sitede hata fırlatabilir.
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* yoksay */
  }
}

let memoryAccess: string | null = null;
const listeners = new Set<() => void>();

export const tokens = {
  get access() {
    return memoryAccess ?? read(ACCESS);
  },
  get refresh() {
    return read(REFRESH);
  },
  set(t: AuthTokens) {
    memoryAccess = t.accessToken;
    write(ACCESS, t.accessToken);
    write(REFRESH, t.refreshToken);
    listeners.forEach((l) => l());
  },
  clear() {
    memoryAccess = null;
    write(ACCESS, null);
    write(REFRESH, null);
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

let refreshing: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  const refreshToken = tokens.refresh;
  if (!refreshToken) return false;
  refreshing ??= fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
    .then(async (res) => {
      if (!res.ok) {
        tokens.clear();
        return false;
      }
      tokens.set(await res.json());
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = init;
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;

  const doFetch = () =>
    fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(auth && tokens.access && { authorization: `Bearer ${tokens.access}` }),
        ...(body !== undefined && !isForm && { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });

  let res = await doFetch();
  if (res.status === 401 && auth && (await refreshTokens())) res = await doFetch();

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const code = json?.error ?? json?.message?.error ?? (typeof json?.message === 'string' ? json.message : 'request_failed');
    throw new ApiError(res.status, code, json?.missing ?? json?.issues ?? json?.message?.missing);
  }
  return json as T;
}

export const fetcher = <T,>(path: string) => api<T>(path);

/** API'nin döndürdüğü göreli fotoğraf yolunu tam URL'ye çevirir. */
export const mediaUrl = (path: string) => (path.startsWith('http') ? path : `${API_URL}${path}`);
