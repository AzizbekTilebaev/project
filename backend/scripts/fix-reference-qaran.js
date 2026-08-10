/**
 * Havola-yozuvlar (к./қ. = «қараң») ni tozalaw:
 * - "к фантастикалық." → cat=к., desc="фантастикалық."
 * - "к. қәнар." + белгисиз → cat=к.
 * - "к е л. ..." → cat=кел. (POS OCR, havola emes)
 *
 *   node scripts/fix-reference-qaran.js --target=both
 *   node scripts/fix-reference-qaran.js --target=both --write
 */
import dotenv from 'dotenv';
dotenv.config();

import mysql from 'mysql2/promise';
import { mysqlSslOptions } from '../src/config/mysqlSsl.js';

const WRITE = process.argv.includes('--write');
const targetArg = (process.argv.find((a) => a.startsWith('--target=')) || '--target=both').split('=')[1];

function parseUrl(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port) || 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
  };
}

function targets() {
  const local = { name: 'local', cfg: parseUrl(process.env.DATABASE_TUSINDIRME), ssl: false };
  const aiven = {
    name: 'aiven',
    cfg: {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME || 'kk_tusindirme',
    },
    ssl: true,
  };
  if (targetArg === 'local') return [local];
  if (targetArg === 'aiven') return [aiven];
  return [local, aiven];
}

async function ensureCat(conn, name) {
  const [rows] = await conn.query('SELECT id FROM categorys WHERE LOWER(name)=LOWER(?) LIMIT 1', [name]);
  if (rows[0]) return rows[0].id;
  const code = name.replace(/\./g, '');
  const [ins] = await conn.query('INSERT INTO categorys (temp_id, name, code) VALUES (?,?,?)', [
    `cat_${code}`,
    name,
    code,
  ]);
  return ins.insertId;
}

function classify(desc, currentCat) {
  const d = String(desc || '').trim();
  const cat = String(currentCat || '').trim().toLowerCase();

  // Spaced POS: "к е л. Үлкен..." / "к ел. ..."
  const kel = d.match(/^[кқ]\s+е\s*л\s*\.\s*(.+)$/isu);
  if (kel && kel[1].trim().length >= 5) {
    return { kind: 'kel_pos', category: 'кел.', description: kel[1].trim() };
  }

  // Explicit "к. X" / "қ. X" — short target only for rewrite
  const dotted = d.match(/^([кқ])\.\s+(.+)$/u);
  if (dotted) {
    const letter = dotted[1].toLocaleLowerCase('kk') === 'қ' ? 'қ.' : 'к.';
    const rest = dotted[2].trim();
    // long gloss after reference — keep text, only fix category if belgisiz
    if (rest.length > 40 || rest.split(/\s+/).length > 4) {
      if (cat === 'белгисиз' || cat === 'belgisiz' || !cat) {
        return { kind: 'cat_only', category: letter, description: d };
      }
      return null;
    }
    const target = rest.replace(/\.+$/u, '').trim();
    if (!target) return null;
    return {
      kind: 'normalize',
      category: letter,
      description: `${target}.`,
    };
  }

  // Nuqtasız: "к фантастикалық." / "қ әдепсиз."
  const undotted = d.match(/^([кқ])\s+([^\s.]{2,40})(\s+\S+){0,2}\.?\s*$/u);
  if (undotted) {
    // skip grammar leftovers
    if (/фейил/i.test(d)) return null;
    const letter = undotted[1].toLocaleLowerCase('kk') === 'қ' ? 'қ.' : 'к.';
    const target = d
      .replace(/^[кқ]\s+/u, '')
      .replace(/\.+$/u, '')
      .trim();
    if (!target || target.length > 30 || target.split(/\s+/).length > 3) return null;
    if (/^(е\s*л|ат|ф|кел)\.?$/iu.test(target)) return null;
    return {
      kind: 'normalize',
      category: letter,
      description: `${target}.`,
    };
  }

  // Already cat к./қ. but desc still has prefix — strip
  if ((cat === 'к.' || cat === 'қ.') && /^[кқ]\.\s+/u.test(d)) {
    const target = d.replace(/^[кқ]\.\s+/u, '').replace(/\.+$/u, '').trim();
    if (target && target.length <= 30 && target.split(/\s+/).length <= 3) {
      return { kind: 'strip_prefix', category: cat, description: `${target}.` };
    }
  }

  // belgisiz + already looks like pure target with cat missing but description is just synonym
  // (handled elsewhere)

  return null;
}

async function runTarget(target) {
  const ssl = target.ssl ? mysqlSslOptions() : undefined;
  const pool = mysql.createPool({
    ...target.cfg,
    waitForConnections: true,
    connectionLimit: 3,
    charset: 'utf8mb4',
    ...(ssl ? { ssl } : {}),
  });
  const conn = await pool.getConnection();
  const stats = { normalize: 0, catOnly: 0, kelPos: 0, strip: 0 };

  try {
    const [[who]] = await conn.query('SELECT DATABASE() db');
    console.log(`\n########## ${target.name.toUpperCase()} → ${who.db} ##########`);

    const kId = await ensureCat(conn, 'к.');
    const qId = await ensureCat(conn, 'қ.');
    const kelId = await ensureCat(conn, 'кел.');

    const [rows] = await conn.query(
      `SELECT d.id did, d.description, d.categorys_id, t.soz, c.name cat
       FROM description d
       JOIN titles t ON t.id = d.titles_id AND t.status = 1
       LEFT JOIN categorys c ON c.id = d.categorys_id
       WHERE d.description REGEXP '^[[:space:]]*[кқ]([.]|[[:space:]])'
          OR LOWER(IFNULL(c.name,'')) IN ('к.','қ.')
          OR LOWER(d.description) REGEXP '^[[:space:]]*(қараң|каран)'`
    );

    if (WRITE) await conn.beginTransaction();

    for (const r of rows) {
      const plan = classify(r.description, r.cat);
      if (!plan) continue;

      let catId = null;
      if (plan.category === 'к.') catId = kId;
      else if (plan.category === 'қ.') catId = qId;
      else if (plan.category === 'кел.') catId = kelId;

      if (plan.kind === 'normalize') stats.normalize++;
      else if (plan.kind === 'cat_only') stats.catOnly++;
      else if (plan.kind === 'kel_pos') stats.kelPos++;
      else if (plan.kind === 'strip_prefix') stats.strip++;

      if (stats.normalize + stats.catOnly + stats.kelPos + stats.strip <= 25) {
        console.log(
          `${plan.kind.padEnd(12)} ${r.soz} | ${JSON.stringify(r.description).slice(0, 50)} → [${plan.category}] ${JSON.stringify(plan.description).slice(0, 50)}`
        );
      }

      if (WRITE) {
        await conn.query('UPDATE description SET description=?, categorys_id=? WHERE id=?', [
          plan.description,
          catId,
          r.did,
        ]);
      }
    }

    if (WRITE) await conn.commit();
    console.log('SUMMARY', target.name, stats, WRITE ? 'WRITE' : 'DRY-RUN');

    // verify fantaziya
    const [check] = await conn.query(
      `SELECT t.soz, c.name cat, d.description
       FROM titles t JOIN description d ON d.titles_id=t.id
       LEFT JOIN categorys c ON c.id=d.categorys_id
       WHERE t.soz IN ('ФАНТАЗИЯЛЫҚ','ФАР','ӘДЕП-ИКРАМСЫЗ','ИРИ')`
    );
    console.log('check', check);
  } catch (e) {
    if (WRITE) await conn.rollback();
    throw e;
  } finally {
    conn.release();
    await pool.end();
  }
}

for (const t of targets()) {
  await runTarget(t);
}
