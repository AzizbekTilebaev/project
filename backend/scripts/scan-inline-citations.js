import dotenv from 'dotenv';
dotenv.config();
import db from '../src/config/dictionary.db.js';

// Ta'rif ichida qolib ketgan "(Avtor)" sitatalarini qidirish.
// Ikki shakl: "matn (Avtor)." va "matn. (Avtor)." (nuqtadan keyin alohida sitata)
const CITE = /\(([^()]{2,60})\)/g;

// Avtorga o'xshamaydigan qavs ichidagi matnlar (izoh, tarjima va h.k.)
function looksLikeAuthor(s) {
  const t = s.trim();
  if (!t) return false;
  if (t.length > 60) return false;
  // raqam/foizli izohlar emas
  if (/\d{3,}/.test(t)) return false;
  // kichik harf bilan boshlangan uzun izoh emas — avtorlar bosh harf bilan
  if (!/^[А-ЯЁӘҒҚҢӨҮЎҲІA-Z«]/.test(t)) return false;
  return true;
}

const [rows] = await db.query(
  `SELECT d.id, d.titles_id, d.description, t.soz
   FROM description d JOIN titles t ON d.titles_id = t.id
   WHERE d.description LIKE '%(%'`
);

const hits = [];
for (const r of rows) {
  const matches = [...r.description.matchAll(CITE)].filter((m) => looksLikeAuthor(m[1]));
  if (!matches.length) continue;
  hits.push({
    soz: r.soz,
    desc_id: r.id,
    citations: matches.map((m) => m[1]),
    description: r.description,
  });
}

console.log('Jami tekshirilgan:', rows.length, '| sitatali ta\u2019riflar:', hits.length);
for (const h of hits) {
  console.log('\n===', h.soz, '| sitatalar:', JSON.stringify(h.citations));
  console.log(h.description.slice(0, 300));
}
await db.end();
