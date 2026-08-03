import dotenv from 'dotenv';
dotenv.config();
import db from '../src/config/dictionary.db.js';

// Yunon harflarini kirillga to'liq almashtirish
const GREEK2CYR = { '\u0391': 'А', '\u0392': 'В', '\u0395': 'Е', '\u039A': 'К', '\u039C': 'М', '\u039D': 'Н', '\u039F': 'О', '\u03A0': 'П', '\u03A1': 'Р', '\u03A4': 'Т', '\u03A5': 'У', '\u03A7': 'Х' };

const [rows] = await db.query(
  "SELECT id, soz FROM titles WHERE soz REGEXP '[\u0370-\u03FF]'"
);
for (const r of rows) {
  const soz = r.soz.replace(/[\u0370-\u03FF]/g, (ch) => GREEK2CYR[ch] || ch);
  await db.query('UPDATE titles SET soz=?, normalized=?, st_let=? WHERE id=?', [
    soz, soz.toLocaleLowerCase('kk'), soz.charAt(0), r.id,
  ]);
  console.log('tuzatildi:', r.soz, '->', soz);
}
console.log('jami:', rows.length);
await db.end();
