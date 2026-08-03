import dotenv from 'dotenv';
dotenv.config();
import db from '../src/config/dictionary.db.js';
import fs from 'fs';

const out = [];
const log = (...a) => out.push(a.join(' '));

// K-quyruqli titlelar tavsifi
const [kTails] = await db.query(
  "SELECT t.id, t.soz, c.name cat, d.description FROM titles t LEFT JOIN description d ON d.titles_id=t.id LEFT JOIN categorys c ON d.categorys_id=c.id WHERE t.status=1 AND t.soz REGEXP BINARY ' (Ф|АТ|КЕЛ|К|РӘЎ)\\\\.?$'"
);
log('--- K-quyruqli titlelar:');
for (const r of kTails) log(`  [${r.id}] ${r.soz} (${r.cat || '-'}) :: ${r.description}`);

// Qisqa ta'rifli yozuvlarning misollari bormi?
const SUSPECTS = ['БЕС ПАРЫЗ','БЕС САЎСАҚ','АТ ШАПТЫРЫМ','ВАТТ','УСАҚ МАЛ','ҚАРА ЫЗҒАР','ҲАЛҚАП КӨЙЛЕК','БАҲАЛЫ ҚАҒАЗ','МӘНЗИЛХАНА','МАЙ ТАРТЫЎ','КОТ','ТИК КЕЛИЎ','ТОПАЙ','УСТЫҚАН'];
log('\n--- Qisqa ta\u2019rif + misollari:');
for (const s of SUSPECTS) {
  const [rows] = await db.query(
    `SELECT t.id tid, d.id did, d.description, c.name cat FROM titles t JOIN description d ON d.titles_id=t.id LEFT JOIN categorys c ON d.categorys_id=c.id WHERE t.soz=?`, [s]
  );
  for (const r of rows) {
    const [exs] = await db.query('SELECT example, author FROM examples WHERE descriptions_id=?', [r.did]);
    log(`  ${s} [tid=${r.tid} did=${r.did}] (${r.cat || '-'}) def="${r.description}"`);
    for (const e of exs) log(`      ex: "${e.example.slice(0, 60)}" — ${e.author}`);
  }
}

// Buzuq titlelar (ҚӘЛ, ӘЛҒ, ДӘР, ТАС ТУНЕК, АССИРИОЛОГИЯ А, ҒОҒАҚЛАСЫЎ РО, ТОСҚЫЗЫЎ Т)
log('\n--- Buzuq titlelar:');
const BROKEN = ['ҚӘЛ','ӘЛҒ','ДӘР','ТАС ТУНЕК','АССИРИОЛОГИЯ А','ҒОҒАҚЛАСЫЎ РО','ТОСҚЫЗЫЎ Т','БОЗҮЙ','ТОСҚЫЗЫЎ'];
for (const s of BROKEN) {
  const [rows] = await db.query(
    `SELECT t.id tid, t.soz, d.id did, d.description FROM titles t LEFT JOIN description d ON d.titles_id=t.id WHERE t.soz=?`, [s]
  );
  for (const r of rows) log(`  [${r.tid}] ${r.soz} :: ${r.description}`);
}

fs.writeFileSync('../detail-report.txt', out.join('\n'));
console.log('yozildi');
await db.end();
