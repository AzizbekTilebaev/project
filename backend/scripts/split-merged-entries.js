import dotenv from 'dotenv';
dotenv.config();
import db from '../src/config/dictionary.db.js';
import { randomUUID } from 'crypto';

const WRITE = process.argv.includes('--write');

const POS_NAME = { 'Ф': 'ф.', 'АТ': 'ат.', 'КЕЛ': 'кел.', 'К': 'к.', 'РӘЎ': 'рәў.', 'АЛМ': 'алм.', 'САН': 'сан.' };

function foldOcr(s) {
  return s.toLocaleLowerCase('kk')
    .replace(/қ/g, 'к').replace(/ғ/g, 'г').replace(/ң/g, 'н')
    .replace(/ә/g, 'а').replace(/ө/g, 'о').replace(/[үұў]/g, 'у')
    .replace(/һ/g, 'х').replace(/і/g, 'и');
}

/**
 * Ta'rifni segmentlarga bo'ladi: har segment { soz|null, pos|null, def }.
 * Bosh so'z deb faqat title bilan bir xil prefiksli KATTA HARFLI so'z olinadi
 * (lug'atda qo'shni maqolalar alifbo bo'yicha yaqin bo'ladi).
 */
function splitSegments(titleSoz, text) {
  const prefix = foldOcr(titleSoz).slice(0, 3);
  const re = /(^|[.!?]\s+|\s+)([А-ЯӘҒҚҢӨҮҰҺІЁЎ][А-ЯӘҒҚҢӨҮҰҺІЁЎ-]{3,})(?:\s+(Ф|АТ|КЕЛ|К|РӘЎ|АЛМ|САН)\.)?\s+/gu;
  const marks = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const word = m[2];
    if (foldOcr(word).slice(0, 3) !== prefix) continue;
    marks.push({ start: m.index + m[1].length, end: re.lastIndex, soz: word, pos: m[3] || null });
  }
  if (!marks.length) return null;
  const segs = [];
  const headDef = text.slice(0, marks[0].start).trim().replace(/[,;]\s*$/, '');
  segs.push({ soz: null, pos: null, def: headDef });
  for (let i = 0; i < marks.length; i++) {
    const defEnd = i + 1 < marks.length ? marks[i + 1].start : text.length;
    const def = text.slice(marks[i].end, defEnd).trim().replace(/[,;]\s*$/, '');
    segs.push({ soz: marks[i].soz, pos: marks[i].pos, def });
  }
  return segs;
}

async function catId(conn, posMark) {
  const name = POS_NAME[posMark];
  if (!name) return null;
  const [c] = await conn.query('SELECT id FROM categorys WHERE LOWER(name)=?', [name]);
  if (c[0]) return c[0].id;
  const [ins] = await conn.query('INSERT INTO categorys (temp_id, name, code) VALUES (?,?,?)', [
    `cat_${name}`, name, name.replace('.', ''),
  ]);
  return ins.insertId;
}

const [rows] = await db.query(
  `SELECT d.id did, d.description, t.id tid, t.soz
   FROM description d JOIN titles t ON d.titles_id=t.id
   WHERE t.status=1 AND CHAR_LENGTH(d.description) > 30
     AND d.description REGEXP BINARY '[[:space:]][А-ЯӘҒҚҢӨҮҰҺІЁЎ-]{4,}[[:space:]]'`
);

const [allTitles] = await db.query('SELECT soz FROM titles');
const existing = new Set(allTitles.map((r) => r.soz));

// segment ta'rifi boshidagi rim raqam + POS ni ajratish
const ROMAN_START = /^([IVXІП]{1,4})[:.]?\s+(.*)$/su;
const POS_START = /^(ат|ф|кел|к|рәў|алм|сан)\.\s*(.*)$/siu;

function normalizeSegment(seg) {
  let soz = seg.soz;
  let pos = seg.pos;
  let def = seg.def;

  const mR = def.match(ROMAN_START);
  if (mR && /^[IVXІ]+$/.test(mR[1].replace(/П/, 'ІІ'))) {
    const roman = mR[1] === 'П' ? 'ІІ' : mR[1];
    soz = `${soz} ${roman}`;
    def = mR[2].trim();
  }
  const mP = def.match(POS_START);
  if (mP && (mP[2] || '').trim().length >= 5) {
    pos = pos || mP[1].toUpperCase();
    def = mP[2].trim();
  }
  return { soz, pos, def };
}

let handled = 0;
for (const r of rows) {
  const segs = splitSegments(r.soz, r.description.trim());
  if (!segs || segs.length < 2) continue;
  const mainDef = segs[0].def;
  // asosiy ta'rif sog'lom bo'lishi shart: yetarlicha uzun, kichik harfli matnli, tinish belgisi bilan boshlanmagan
  if (mainDef.length < 10) continue;
  if (!/[а-яәғқңөүұһёіў]/u.test(mainDef)) continue;
  if (/^[^\p{L}]/u.test(mainDef)) continue;
  handled++;
  console.log(`\n=== ${r.soz}`);
  console.log('  saqlanadi:', mainDef.slice(0, 70));
  if (WRITE) await db.query('UPDATE description SET description=? WHERE id=?', [mainDef, r.did]);
  for (const raw of segs.slice(1)) {
    const s = normalizeSegment(raw);
    if (s.def.length < 5) { console.log('  tashlab yuborildi (qisqa):', s.soz); continue; }
    if (existing.has(s.soz)) { console.log('  o\u2018tkazildi (bazada bor):', s.soz); continue; }
    console.log(`  yangi: ${s.soz} [${s.pos ? POS_NAME[s.pos] : '-'}] ${s.def.slice(0, 60)}`);
    if (WRITE) {
      const cid = s.pos ? await catId(db, s.pos) : null;
      const newId = randomUUID().slice(0, 8);
      await db.query('INSERT INTO titles (id, soz, normalized, st_let, status) VALUES (?,?,?,?,1)', [
        newId, s.soz, s.soz.toLocaleLowerCase('kk'), s.soz.charAt(0),
      ]);
      await db.query(
        'INSERT INTO description (titles_id, categorys_id, description, sort_order) VALUES (?,?,?,1)',
        [newId, cid, s.def]
      );
      existing.add(s.soz);
    }
  }
}
console.log('\nJami qayta ishlangan:', handled, '| MODE:', WRITE ? 'WRITE' : 'DRY-RUN');
await db.end();
