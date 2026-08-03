// Foydalanish: node tools/find-word.js СЎЗ1 СЎЗ2 ...
// fordata JSON sahifalaridan title bo'yicha yozuvni topib chiqaradi.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targets = process.argv.slice(2).map((w) => w.toUpperCase());
if (!targets.length) {
  console.error('So\u2018z kiriting');
  process.exit(1);
}

function* jsonFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'tools') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* jsonFiles(full);
    else if (entry.name.endsWith('.json')) yield full;
  }
}

const norm = (s) => (s || '').toUpperCase().replace(/\s+/g, ' ').trim();

for (const file of jsonFiles(root)) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    continue;
  }
  const entries = Array.isArray(data) ? data : data.entries || data.data || [];
  if (!Array.isArray(entries)) continue;
  entries.forEach((e, i) => {
    const title = norm(e.title || e.soz || '');
    if (!title) return;
    for (const t of targets) {
      if (title === t || title.startsWith(t + ' ') || title.includes(t)) {
        console.log('\n=== ' + (e.title || e.soz) + '  [' + path.relative(root, file) + ' #' + i + ']');
        console.log(JSON.stringify(e, null, 1).slice(0, 1500));
      }
    }
  });
}
