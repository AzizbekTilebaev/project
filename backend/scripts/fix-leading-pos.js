import dotenv from 'dotenv';
dotenv.config();
import db from '../src/config/dictionary.db.js';

const WRITE = process.argv.includes('--write');

// Ta'rifi "Ф. ..." / "АТ. ..." kabi katta harfli POS bilan boshlanadiganlar
const POS_MAP = { 'ф': 'ф.', 'ат': 'ат.', 'кел': 'кел.', 'к': 'к.', 'рәў': 'рәў.', 'алм': 'алм.', 'сан': 'сан.' };
const RE = /^(Ф|АТ|КЕЛ|РӘЎ|АЛМ|САН)\.\s+(.{3,})$/su;

const [belg] = await db.query("SELECT id FROM categorys WHERE name='белгисиз' LIMIT 1");
const belgId = belg[0]?.id ?? null;

const [rows] = await db.query(
  `SELECT d.id, d.description, d.categorys_id, t.soz
   FROM description d JOIN titles t ON d.titles_id=t.id
   WHERE t.status=1 AND d.description REGEXP BINARY '^(Ф|АТ|КЕЛ|РӘЎ|АЛМ|САН)\\\\.'`
);

let n = 0;
for (const r of rows) {
  const m = r.description.trim().match(RE);
  if (!m) continue;
  const posName = POS_MAP[m[1].toLowerCase()];
  const rest = m[2].trim();
  n++;
  console.log(r.soz, '::', r.description.slice(0, 45), '->', `[${posName}]`, rest.slice(0, 45));
  if (WRITE) {
    await db.query('UPDATE description SET description=? WHERE id=?', [rest, r.id]);
    if (r.categorys_id === belgId || r.categorys_id == null) {
      const [c] = await db.query('SELECT id FROM categorys WHERE LOWER(name)=?', [posName]);
      let cid = c[0]?.id;
      if (!cid) {
        const [ins] = await db.query('INSERT INTO categorys (temp_id, name, code) VALUES (?,?,?)', [
          `cat_${posName}`, posName, posName.replace('.', ''),
        ]);
        cid = ins.insertId;
      }
      await db.query('UPDATE description SET categorys_id=? WHERE id=?', [cid, r.id]);
    }
  }
}
console.log('Jami:', n, '| MODE:', WRITE ? 'WRITE' : 'DRY-RUN');
await db.end();
