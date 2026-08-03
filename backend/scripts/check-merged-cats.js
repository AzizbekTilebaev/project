import dotenv from 'dotenv';
import db from '../src/config/dictionary.db.js';

dotenv.config();

const WORDS = ['АЙТ І', 'ЖҮЗ ІІ', 'ҒУРТ ІІ', 'ҚАМАР І', 'ҚУБЫЖЫҚ Қ', 'ПРОСПЕКТ П', 'ПРОСПЕКТ', 'ҚУЛЛАСЫ М', 'ДИЙЎАН ІІ', 'ҒУБЫЖЫҚ', 'СО', 'ӘНЕЛ', 'ПӘРРАШ'];

for (const w of WORDS) {
  const [rows] = await db.query(
    `SELECT t.id AS tid, t.soz, d.id AS did, d.description, c.id AS cid, c.name AS category
     FROM titles t
     JOIN description d ON d.titles_id = t.id
     LEFT JOIN categorys c ON c.id = d.categorys_id
     WHERE t.status = 1 AND t.soz = ?`,
    [w]
  );
  if (!rows.length) {
    console.log(`--- ${w}: TOPILMADI`);
    continue;
  }
  for (const r of rows) {
    console.log(`--- [${r.soz}] tid=${r.tid} did=${r.did} cat(id ${r.cid})="${r.category}"`);
    console.log(`    desc: ${r.description}`);
    const [ex] = await db.query(
      'SELECT example, author FROM examples WHERE descriptions_id = ?',
      [r.did]
    );
    for (const e of ex) console.log(`    misal: "${e.example}" — ${e.author}`);
  }
}
await db.end();
