// Foydalanish: node tools/dump-source.js БАҒ ОБА ...
// Aniq sarlavha (yoki "BASE <rim>") bo'yicha manba full_text ni chiqaradi.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bases = process.argv.slice(2).map((w) => w.toUpperCase());

function* jsonFiles(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'tools') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* jsonFiles(full);
    else if (e.name.endsWith('.json')) yield full;
  }
}

const ROMAN = /^(?:[IVXІ]{1,4})$/i;
function matches(title, base) {
  const t = title.toUpperCase().trim();
  if (t === base) return true;
  if (t.startsWith(base + ' ')) {
    const rest = t.slice(base.length + 1).trim();
    return ROMAN.test(rest);
  }
  return false;
}

const found = {};
for (const file of jsonFiles(root)) {
  let data;
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { continue; }
  const entries = Array.isArray(data) ? data : [];
  entries.forEach((e) => {
    const title = (e.title || '').toUpperCase().trim();
    for (const base of bases) {
      if (matches(title, base)) {
        (found[base] ||= []).push({ title: e.title, file: path.relative(root, file), full_text: e.full_text });
      }
    }
  });
}

for (const base of bases) {
  console.log('\n######## ' + base);
  const arr = found[base] || [];
  if (!arr.length) { console.log('  (manbada topilmadi)'); continue; }
  for (const r of arr) {
    console.log(`  --- ${r.title}  [${r.file}]`);
    console.log('  ' + r.full_text);
  }
}
