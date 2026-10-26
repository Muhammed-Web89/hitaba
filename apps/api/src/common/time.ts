/** Verilen saat dilimindeki bugünün gece yarısını UTC Date olarak döndürür. */
export function startOfLocalDay(timezone: string, now = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: safeZone(timezone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const localAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  const offsetMs = localAsUtc - Math.floor(now.getTime() / 1000) * 1000;
  return new Date(Date.UTC(get('year'), get('month') - 1, get('day')) - offsetMs);
}

export function safeZone(tz: string): string {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

export const hours = (n: number) => n * 60 * 60 * 1000;
export const minutes = (n: number) => n * 60 * 1000;

/** Kullanıcıya kesin yaş yerine gösterilen aralık (§8.4). */
export function ageRange(age: number): string {
  const lo = Math.floor(age / 3) * 3;
  return `${Math.max(18, lo)}–${lo + 2}`;
}
