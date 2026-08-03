/**
 * Seed curated (premium-50) so‘zlar ro‘yxatini MySQL `curated_words` jadvaliga.
 *
 * Manba (bir martalik): fordata/curated/premium-50.meta.json.
 * fordata o‘chirilgach ma’lumot bazada qoladi va bu skriptni qayta
 * ishga tushirish shart emas.
 *
 *   node scripts/seed-curated-words.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../src/config/dictionary.db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const META = path.join(ROOT, 'fordata', 'curated', 'premium-50.meta.json');
const IMPORT = path.join(ROOT, 'fordata', 'curated', 'premium-50.import.json');

// Servisdagi cleanTitle bilan bir xil: title oxiridagi POS belgisini olib tashlash
function cleanTitle(title) {
  return String(title || '')
    .trim()
    .replace(/\s+(ат|ф|кел|б)\.?$/i, '');
}

function readWords() {
  if (fs.existsSync(META)) {
    const meta = JSON.parse(fs.readFileSync(META, 'utf8'));
    return (meta.words || []).map((w) => ({
      soz: cleanTitle(w.title),
      score: Number.isFinite(w.score) ? w.score : null,
      category: w.category || null,
      source: w.source || null,
    }));
  }
  if (fs.existsSync(IMPORT)) {
    const items = JSON.parse(fs.readFileSync(IMPORT, 'utf8'));
    return items.map((i) => ({ soz: cleanTitle(i.soz), score: null, category: null, source: null }));
  }
  return null;
}

async function main() {
  const words = readWords();
  if (!words) {
    console.error('❌ Manba topilmadi: fordata/curated/premium-50.(meta|import).json');
    console.error('   curated_words allaqachon seed qilingan bo‘lishi mumkin — tekshiring.');
    process.exit(1);
  }

  const seen = new Set();
  const rows = [];
  words.forEach((w, i) => {
    if (!w.soz || seen.has(w.soz)) return;
    seen.add(w.soz);
    rows.push([w.soz, rows.length, w.score, w.category, w.source]);
  });

  await db.query('DELETE FROM curated_words');
  if (rows.length) {
    await db.query(
      'INSERT INTO curated_words (soz, sort_order, score, category, source) VALUES ?',
      [rows]
    );
  }
  console.log(`✅ curated_words seed qilindi: ${rows.length} ta so‘z`);
  await db.end();
}

main().catch((e) => {
  console.error('❌ Seed xatosi:', e);
  process.exit(1);
});
