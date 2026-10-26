// Tüm dil dosyalarının en.json ile aynı anahtarlara sahip olduğunu doğrular.
import { readFileSync } from 'node:fs';

const flat = (o, p = '') =>
  Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [`${p}${k}`]));
const load = (l) => new Set(flat(JSON.parse(readFileSync(new URL(`../src/messages/${l}.json`, import.meta.url)))));

const base = load('en');
let failed = false;
for (const l of ['uz', 'ru', 'tr', 'ar']) {
  const keys = load(l);
  const missing = [...base].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !base.has(k));
  if (missing.length || extra.length) {
    failed = true;
    console.log(`${l}: missing ${missing.length}`, missing, `extra ${extra.length}`, extra);
  } else console.log(`${l}: ok (${keys.size} keys)`);
}
process.exit(failed ? 1 : 0);
