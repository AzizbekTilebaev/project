import dotenv from 'dotenv';
import db from '../src/config/dictionary.db.js';

dotenv.config();

const WRITE = process.argv.includes('--write');

// ---------- 1. Turkum maydoniga qo'shilib ketgan ta'riflar ----------
// cat "ф. Сөйле." -> turkum "ф.", ta'rif boshiga "Сөйле." qo'shiladi.
// Eski ta'rif sitata bilan tugasa — misolga aylantiriladi.
const CAT_FIXES = [
  { catName: 'ф. Сөйле.', newCat: 'ф.', defPrefix: 'Сөйлеў.' },
  { catName: 'ат. Бет.', newCat: 'ат.', defPrefix: 'Бет.' },
  { catName: 'ат. Қаскыр.', newCat: 'ат.', defPrefix: 'Қасқыр.' },
  { catName: 'Белбеў.', newCat: 'ат.', defPrefix: 'Белбеў.' },
];

// Turkum nomlarini birlashtirish/tuzatish: eski -> mavjud to'g'ri nom
const CAT_RENAMES = [
  { from: 'техн.', to: 'тех.' },
  { from: 'геог.', to: 'геогр.' },
  { from: 'линг.', to: 'лингв.' },
  { from: 'ат.әс.', to: 'ат.әск.' },
  { from: 'т. с.', to: 'т.с.' },
  { from: 'с.', to: 'сан.' },
  { from: 'ГӨН.с.', to: 'гөн.с.' },
  { from: 'ат. Гөн. с.', to: 'ат. гөн. с.' },
  { from: 'Пед.', to: 'пед.' },
  { from: 'Мм.с.', to: 'м.с.' },
  { from: 'Ққ.', to: 'қ.' },
  { from: 'Пат.', to: 'ат.' },
];

// ---------- 2. Sarlavha oxiriga yopishgan OCR harfi ----------
// "АРЗНАМА Ө" + ta'rif "Өтинишнама..." -> "АРЗНАМА"
const ROMAN_LETTERS = new Set(['І', 'Х', 'I', 'X', 'V']);
const TRAIL_RE = /^(.{2,})\s([А-ЯЁӘӨҮҒҚҢҲІЎ])$/u;

// Maxsus: ПРОСПЕКТ П aslida ПРОСПЕКТ ning omonimi
const SPECIAL_TITLES = [
  { from: 'ПРОСПЕКТ П', to: 'ПРОСПЕКТ ІІ', alsoRename: { from: 'ПРОСПЕКТ', to: 'ПРОСПЕКТ І' } },
];

// Sitata bilan tugagan matnni misollarga ajratish
const CIT_RE = /\(([^)]{1,80})\)\s*\.?\s*$/;
function splitCitationExamples(text) {
  // Gaplarni sitata nuqtalarida bo'lamiz
  const parts = [];
  let rest = text.trim();
  const segRe = /(.+?\([^)]{1,80}\)\s*\.?)(\s+|$)/gu;
  let m;
  let consumed = 0;
  while ((m = segRe.exec(rest)) !== null) {
    parts.push(m[1].trim());
    consumed = segRe.lastIndex;
  }
  const tail = rest.slice(consumed).trim();
  const examples = [];
  for (const part of parts) {
    const cm = part.match(CIT_RE);
    if (!cm) return { examples: [], tail: text.trim() };
    const example = part.replace(CIT_RE, '').trim().replace(/[.\s]+$/g, '');
    const author = cm[1].trim().replace(/\.+$/g, '');
    if (example) examples.push({ example, author });
  }
  return { examples, tail };
}

const [cats] = await db.query('SELECT id, name FROM categorys');
const catByName = new Map(cats.map((c) => [c.name, c]));

const [titles] = await db.query('SELECT id, soz FROM titles WHERE status = 1');
const titleSet = new Set(titles.map((t) => t.soz));

const actions = { catFix: [], catRename: [], titleFix: [], special: [] };

// --- turkumga qo'shilib ketganlar
for (const fix of CAT_FIXES) {
  const cat = catByName.get(fix.catName);
  if (!cat) continue;
  const [rows] = await db.query(
    `SELECT d.id AS did, d.description, t.soz
     FROM description d JOIN titles t ON t.id = d.titles_id
     WHERE d.categorys_id = ? AND t.status = 1`,
    [cat.id]
  );
  for (const r of rows) {
    const { examples, tail } = splitCitationExamples(r.description);
    const newDesc = tail ? `${fix.defPrefix} ${tail}`.trim() : fix.defPrefix;
    actions.catFix.push({
      did: r.did,
      soz: r.soz,
      oldCat: fix.catName,
      newCat: fix.newCat,
      newDesc,
      examples,
    });
  }
}

// --- turkum nomlarini tuzatish
for (const r of CAT_RENAMES) {
  const from = catByName.get(r.from);
  if (!from) continue;
  const to = catByName.get(r.to);
  actions.catRename.push({ fromId: from.id, from: r.from, toId: to?.id || null, to: r.to });
}

// --- maxsus sarlavhalar
for (const s of SPECIAL_TITLES) {
  if (titleSet.has(s.from)) actions.special.push(s);
}

// --- sarlavha oxiridagi yopishgan harf (umumiy qoida)
const specialFroms = new Set(SPECIAL_TITLES.map((s) => s.from));
const [firstDescs] = await db.query(
  `SELECT t.id AS tid, t.soz, d.description, c.name AS category
   FROM titles t
   JOIN description d ON d.titles_id = t.id
   LEFT JOIN categorys c ON c.id = d.categorys_id
   WHERE t.status = 1
   GROUP BY t.id`
);
for (const r of firstDescs) {
  if (specialFroms.has(r.soz)) continue;
  const m = r.soz.match(TRAIL_RE);
  if (!m) continue;
  const trail = m[2];
  if (ROMAN_LETTERS.has(trail)) continue;
  const base = m[1].trim().replace(/\.+$/g, '');

  const descFirst = (r.description || '').trim().charAt(0);
  const catFirst = (r.category || '').trim().charAt(0);
  const low = (ch) => ch.toLocaleLowerCase('kk');
  // Harf ta'rif yoki turkumning bosh harfi bilan mos kelsa — OCR yopishgan
  if (low(descFirst) !== low(trail) && low(catFirst) !== low(trail)) continue;
  if (titleSet.has(base)) {
    actions.titleFix.push({ tid: r.tid, from: r.soz, to: base, blocked: true });
    continue;
  }
  actions.titleFix.push({ tid: r.tid, from: r.soz, to: base });
}

// ---------- Hisobot ----------
console.log('=== TURKUM+TA’RIF QO‘SHILGANLAR ===');
for (const a of actions.catFix) {
  console.log(`  [${a.soz}] cat "${a.oldCat}" -> "${a.newCat}"`);
  console.log(`     def -> "${a.newDesc.slice(0, 70)}"`);
  for (const e of a.examples) console.log(`     misal: "${e.example.slice(0, 55)}" — ${e.author}`);
}
console.log('\n=== TURKUM NOMLARI ===');
for (const a of actions.catRename) {
  console.log(`  "${a.from}" -> "${a.to}" ${a.toId ? '(birlashtiriladi)' : '(nomi yangilanadi)'}`);
}
console.log('\n=== SARLAVHA OXIRIDAGI HARF ===');
for (const a of actions.titleFix) {
  console.log(`  ${a.from} -> ${a.to}${a.blocked ? '  [BLOK: band]' : ''}`);
}
console.log('\n=== MAXSUS ===');
for (const s of actions.special) {
  console.log(`  ${s.from} -> ${s.to}; ${s.alsoRename.from} -> ${s.alsoRename.to}`);
}

if (!WRITE) {
  console.log('\nDRY-RUN. Yozish: node scripts/fix-merged-categories.js --write');
  await db.end();
  process.exit(0);
}

// ---------- Yozish ----------
const conn = await db.getConnection();
try {
  await conn.beginTransaction();

  // turkum+ta'rif
  for (const a of actions.catFix) {
    const target = catByName.get(a.newCat);
    await conn.query('UPDATE description SET categorys_id = ?, description = ? WHERE id = ?', [
      target.id,
      a.newDesc,
      a.did,
    ]);
    for (let i = 0; i < a.examples.length; i++) {
      const e = a.examples[i];
      await conn.query(
        'INSERT INTO examples (descriptions_id, example, author, sort_order) VALUES (?, ?, ?, ?)',
        [a.did, e.example, e.author, i + 1]
      );
    }
  }

  // turkum nomlari
  for (const a of actions.catRename) {
    if (a.toId) {
      await conn.query('UPDATE description SET categorys_id = ? WHERE categorys_id = ?', [
        a.toId,
        a.fromId,
      ]);
      await conn.query('DELETE FROM categorys WHERE id = ?', [a.fromId]);
    } else {
      await conn.query('UPDATE categorys SET name = ? WHERE id = ?', [a.to, a.fromId]);
    }
  }

  // maxsus sarlavhalar
  for (const s of actions.special) {
    await conn.query('UPDATE titles SET soz = ?, normalized = ? WHERE soz = ? AND status = 1', [
      s.to,
      s.to.toLocaleLowerCase('kk'),
      s.from,
    ]);
    await conn.query('UPDATE titles SET soz = ?, normalized = ? WHERE soz = ? AND status = 1', [
      s.alsoRename.to,
      s.alsoRename.to.toLocaleLowerCase('kk'),
      s.alsoRename.from,
    ]);
  }

  // sarlavha harflari
  for (const a of actions.titleFix) {
    if (a.blocked) continue;
    await conn.query('UPDATE titles SET soz = ?, normalized = ?, st_let = ? WHERE id = ?', [
      a.to,
      a.to.toLocaleLowerCase('kk'),
      a.to.charAt(0),
      a.tid,
    ]);
  }

  await conn.commit();
} catch (e) {
  await conn.rollback();
  throw e;
} finally {
  conn.release();
}

console.log(
  `\nYOZILDI: ${actions.catFix.length} turkum+ta’rif, ${actions.catRename.length} turkum nomi, ` +
    `${actions.titleFix.filter((a) => !a.blocked).length} sarlavha, ${actions.special.length} maxsus.`
);
await db.end();
