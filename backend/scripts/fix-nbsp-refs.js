import dotenv from 'dotenv';
dotenv.config();
import db from '../src/config/dictionary.db.js';

const WRITE = process.argv.includes('--write');

// 1) NBSP va boshqa ko'rinmas probellar
const [rows] = await db.query(
  "SELECT id, description FROM description WHERE description REGEXP '[\u00A0\u2007\u202F]' OR description LIKE '%  %'"
);
let n = 0;
for (const r of rows) {
  const fixed = r.description.replace(/[\u00A0\u2007\u202F]/g, ' ').replace(/[ \t]{2,}/g, ' ').trim();
  if (fixed !== r.description) {
    n++;
    console.log('NBSP:', r.description.slice(0, 50), '->', fixed.slice(0, 50));
    if (WRITE) await db.query('UPDATE description SET description=? WHERE id=?', [fixed, r.id]);
  }
}
console.log('NBSP tozalandi:', n);

const [exRows] = await db.query(
  "SELECT id, example FROM examples WHERE example REGEXP '[\u00A0\u2007\u202F]' OR example LIKE '%  %'"
);
let ne = 0;
for (const r of exRows) {
  const fixed = r.example.replace(/[\u00A0\u2007\u202F]/g, ' ').replace(/[ \t]{2,}/g, ' ').trim();
  if (fixed !== r.example) {
    ne++;
    if (WRITE) await db.query('UPDATE examples SET example=? WHERE id=?', [fixed, r.id]);
  }
}
console.log('Misollarda NBSP:', ne);

// 2) ҲӘКИСЛЕСИЎ ҲӘК -> ҲӘКИСЛЕСИЎ
const [hek] = await db.query("SELECT id FROM titles WHERE soz='ҲӘКИСЛЕСИЎ ҲӘК'");
if (hek[0]) {
  console.log('ҲӘКИСЛЕСИЎ ҲӘК -> ҲӘКИСЛЕСИЎ');
  if (WRITE) {
    const [dup] = await db.query("SELECT id FROM titles WHERE soz='ҲӘКИСЛЕСИЎ'");
    if (dup.length) {
      await db.query('UPDATE titles SET status=0 WHERE id=?', [hek[0].id]);
    } else {
      await db.query(
        "UPDATE titles SET soz='ҲӘКИСЛЕСИЎ', normalized='ҳәкислесиў', st_let='Ҳ' WHERE id=?", [hek[0].id]
      );
      await db.query(
        "UPDATE description SET description='ҳәкислеў фейилиниң шериклик дәрежеси.' WHERE titles_id=?", [hek[0].id]
      );
    }
  }
}

// 3) Havola-yozuvlarga "к." kategoriyasini qo'yish (белгисиз bo'lsa)
const REFS = ['БИРАҚ ТА','ЛАЛ БОЛЫЎ','БАЙҚА','АТ СЕЙИС','ҚАТЫС','КЕТКЕН','БОЗ ТОПЫРАҚ','КЕСЕК ПЕЧЬ','БОЗ ҮЙ','ЕР ТОҚЫМ','БАС МИЙ','ЕР ТУРМАН'];
const [belg] = await db.query("SELECT id FROM categorys WHERE name='белгисиз' LIMIT 1");
const belgId = belg[0]?.id ?? null;
const [kCat] = await db.query("SELECT id FROM categorys WHERE LOWER(name)='к.' LIMIT 1");
let kId = kCat[0]?.id;
if (!kId && WRITE) {
  const [ins] = await db.query("INSERT INTO categorys (temp_id, name, code) VALUES ('cat_к.','к.','к')");
  kId = ins.insertId;
}
let refFixed = 0;
for (const soz of REFS) {
  const [ds] = await db.query(
    'SELECT d.id, d.categorys_id FROM description d JOIN titles t ON d.titles_id=t.id WHERE t.soz=?', [soz]
  );
  for (const d of ds) {
    if (d.categorys_id === belgId || d.categorys_id == null) {
      refFixed++;
      console.log('REF-cat:', soz);
      if (WRITE) await db.query('UPDATE description SET categorys_id=? WHERE id=?', [kId, d.id]);
    }
  }
}
console.log('Havola kategoriyalari:', refFixed);
console.log('MODE:', WRITE ? 'WRITE' : 'DRY-RUN');
await db.end();
