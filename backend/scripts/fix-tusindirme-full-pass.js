/**
 * To'liq 27k sifat passi (LOCAL + AIVEN):
 * 1) OCR lookalike lotin (харекеt → харекет) — etimologiya qavslari saqlanadi
 * 2) Kesilgan title: Д + омино → ДОМИНО
 * 3) comp_* / yaroqsiz 1-hárip chiqindilari
 * 4) Yakuniy audit hisoboti
 *
 *   node scripts/fix-tusindirme-full-pass.js --target=both
 *   node scripts/fix-tusindirme-full-pass.js --target=both --write
 */
import dotenv from 'dotenv';
dotenv.config();

import mysql from 'mysql2/promise';
import { mysqlSslOptions } from '../src/config/mysqlSsl.js';
import searchFold from '../src/utils/searchFold.js';
import { stLetFromSoz } from '../src/utils/letterIndex.js';
import { parseNumberedSenses } from '../src/utils/glossStructure.js';

const WRITE = process.argv.includes('--write');
const targetArg = (process.argv.find((a) => a.startsWith('--target=')) || '--target=both').split('=')[1];

const LAT = /[A-Za-zÁáÓóÚúŃńǴǵÍíı]/;
const CYR = /[\u0400-\u04FF]/;

const LAT2CYR = {
  A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', K: 'К', M: 'М',
  O: 'О', P: 'Р', T: 'Т', X: 'Х', Y: 'У', G: 'Ғ', F: 'Ғ',
  a: 'а', c: 'с', e: 'е', o: 'о', p: 'р', t: 'т', x: 'х', y: 'у',
  i: 'і', n: 'н', u: 'у', r: 'р', s: 'с', g: 'г', f: 'ф',
  b: 'в', d: 'д', z: 'з', m: 'м', l: 'л',
};

const KEEP_LATIN_RE =
  /tion|phy|off|online|http|www|griff|domin|illus|transf|amid|bamboo|physik|accept|offline|vertical|menu|dna|formula|\b(?:Hf|Ge|Fe|Pb|Sb|Cu|Ag|Au|Zn|Al|Mg|Ca|Na|Cl|SO|VO|Nb|H2|O2|CO2|PbS|Sb2O3)\b/i;

const ETYM_RE =
  /\((?:лат|латын|фр|франц|ингл|англ|грек|парсы|нем|ит|итал|араб|турк|рус|малай|лат\.|фр\.)[^)]{0,220}\)/giu;

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
  const local = {
    name: 'local',
    cfg: parseUrl(process.env.DATABASE_TUSINDIRME),
    ssl: false,
  };
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

function fixLookalikeText(text) {
  const kept = [];
  let t = String(text || '').replace(ETYM_RE, (m) => {
    kept.push(m);
    return `\u0001${kept.length - 1}\u0001`;
  });

  t = t
    .split(/(\s+)/)
    .map((tok) => {
      if (!/[A-Za-z]/.test(tok)) return tok;
      if (KEEP_LATIN_RE.test(tok)) return tok;
      const lat = (tok.match(/[A-Za-z]/g) || []).length;
      const cyr = (tok.match(/[\u0400-\u04FF]/g) || []).length;
      if (cyr > 0 && lat > 0) {
        return tok.replace(/[A-Za-z]/g, (ch) => LAT2CYR[ch] || ch);
      }
      if (lat > 0 && cyr === 0) {
        const onlyLookalike = [...tok].every((ch) => !/[A-Za-z]/.test(ch) || LAT2CYR[ch]);
        if (onlyLookalike && lat <= 10) {
          return tok.replace(/[A-Za-z]/g, (ch) => LAT2CYR[ch] || ch);
        }
      }
      return tok;
    })
    .join('');

  return t.replace(/\u0001(\d+)\u0001/g, (_, i) => kept[Number(i)]);
}

function isAlphabetLetterEntry(soz, description) {
  if (String(soz || '').trim().length !== 1) return false;
  return /ҳәриб|хәриб|әлипбе|элипбе|алипбе|сестиң таңба|сестин таңба|ҳәрипи|хәрипи/i.test(
    description || ''
  );
}

/**
 * Д + омино ат. → ДОМИНО (OCR title kesilgan)
 * Faqat: 1-2 hárip title + kichik hárip davom + POS tegi.
 * Álipbe hárip maqolaları (еки езиў..., тил ушы...) tegilmeydi.
 */
function tryMergeFragment(soz, description) {
  const title = String(soz || '').trim();
  if (title.length < 1 || title.length > 2) return null;
  if (isAlphabetLetterEntry(title, description)) return null;

  // POS majburiy — aks holda fonetik tushuntirishlarni titlega yopishtirib yuboradi
  const CONT =
    /^([A-Za-zа-яәғқңөүұһёіў-]{3,30})\s+(ат|ф|кел|к|рәў|алм|сан|лин|гөн|анат|дин)\.\s*/iu;
  const m = String(description || '').trim().match(CONT);
  if (!m) return null;

  let frag = m[1];
  // davom kichik háripten baslanıwı kerek (úlken = jańa maqola)
  if (!/^[a-zа-яәғқңөүұһёіў]/.test(frag)) return null;
  if (/^[А-ЯӘҒҚҢӨҮҰҺІЎЁA-Z]{3,}$/.test(frag)) return null;

  frag = frag.replace(/[A-Za-z]/g, (ch) => LAT2CYR[ch] || ch);
  const merged = `${title}${frag}`.toLocaleUpperCase('kk');
  if (merged.length < 4 || merged.length > 40) return null;
  if (!/^[\p{L}\-()І]+$/u.test(merged)) return null;

  // Fonetik / álipbe gápı qaldıqları
  if (/^(еки|тил|аўыз|сес|ҳәрип|хәрип)/i.test(frag)) return null;

  const rest = String(description || '').trim().slice(m[0].length).trim();
  if (rest.length < 8) return null;
  const pos = `${m[2].toLowerCase()}.`;
  return { merged, rest, pos };
}

async function findOrCreateCategory(conn, name) {
  const [rows] = await conn.query('SELECT id FROM categorys WHERE LOWER(name)=LOWER(?)', [name]);
  if (rows[0]) return rows[0].id;
  const [r] = await conn.query('INSERT INTO categorys (temp_id, name, code) VALUES (?,?,?)', [
    `cat_${name}`,
    name,
    name.replace(/\./g, '').toLowerCase(),
  ]);
  return r.insertId;
}

async function runTarget(target) {
  const ssl = target.ssl ? mysqlSslOptions() : undefined;
  const pool = mysql.createPool({
    ...target.cfg,
    waitForConnections: true,
    connectionLimit: 4,
    charset: 'utf8mb4',
    ...(ssl ? { ssl } : {}),
  });

  const stats = {
    lookalikeDefs: 0,
    lookalikeEx: 0,
    fragments: 0,
    junkOff: 0,
    meta: 0,
  };

  const conn = await pool.getConnection();
  try {
    const [[who]] = await conn.query('SELECT DATABASE() db');
    console.log(`\n########## ${target.name.toUpperCase()} → ${target.cfg.host} / ${who.db} ##########`);
    if (WRITE) await conn.beginTransaction();

    // --- 1) Lookalike in definitions ---
    const [defs] = await conn.query(
      `SELECT d.id, d.description FROM description d
       JOIN titles t ON t.id=d.titles_id AND t.status=1
       WHERE d.description REGEXP '[A-Za-z]'`
    );
    for (const d of defs) {
      const fixed = fixLookalikeText(d.description);
      if (fixed !== d.description) {
        stats.lookalikeDefs++;
        if (stats.lookalikeDefs <= 12) {
          console.log('LOOK', JSON.stringify(d.description.slice(0, 70)), '→', JSON.stringify(fixed.slice(0, 70)));
        }
        if (WRITE) await conn.query('UPDATE description SET description=? WHERE id=?', [fixed, d.id]);
      }
    }

    // --- 2) Lookalike in examples ---
    const [exs] = await conn.query(
      `SELECT e.id, e.example FROM examples e
       JOIN description d ON d.id=e.descriptions_id
       JOIN titles t ON t.id=d.titles_id AND t.status=1
       WHERE e.example REGEXP '[A-Za-z]'`
    );
    for (const e of exs) {
      const fixed = fixLookalikeText(e.example);
      if (fixed !== e.example) {
        stats.lookalikeEx++;
        if (WRITE) await conn.query('UPDATE examples SET example=? WHERE id=?', [fixed, e.id]);
      }
    }

    // --- 3) Fragment titles ---
    const [frags] = await conn.query(
      `SELECT t.id, t.soz, d.id AS did, d.description, d.categorys_id
       FROM titles t
       JOIN description d ON d.titles_id=t.id
       WHERE t.status=1 AND CHAR_LENGTH(TRIM(t.soz)) BETWEEN 1 AND 2`
    );
    const seenTitle = new Set();
    for (const r of frags) {
      if (seenTitle.has(r.id)) continue;
      const merged = tryMergeFragment(r.soz, r.description);
      if (!merged) continue;
      seenTitle.add(r.id);

      // collision?
      const [exist] = await conn.query(
        `SELECT id, soz FROM titles WHERE status=1 AND id<>? AND (soz=? OR normalized=?) LIMIT 1`,
        [r.id, merged.merged, merged.merged.toLocaleLowerCase('kk')]
      );
      if (exist[0]) {
        console.log(`FRAG skip (exists ${exist[0].soz}): ${r.soz} → ${merged.merged}`);
        continue;
      }

      stats.fragments++;
      console.log(`FRAG ${r.soz} → ${merged.merged}`);
      if (WRITE) {
        const st = stLetFromSoz(merged.merged);
        const norm = merged.merged.toLocaleLowerCase('kk');
        const key = searchFold(merged.merged);
        await conn.query(
          'UPDATE titles SET soz=?, normalized=?, search_key=?, st_let=? WHERE id=?',
          [merged.merged, norm, key, st, r.id]
        );
        await conn.query('UPDATE description SET description=? WHERE id=?', [merged.rest, r.did]);
        if (merged.pos && !r.categorys_id) {
          const cid = await findOrCreateCategory(conn, merged.pos);
          await conn.query('UPDATE description SET categorys_id=? WHERE id=?', [cid, r.did]);
        }
      }
    }

    // --- 4) Junk comp_ ---
    const [junk] = await conn.query(
      `SELECT id, soz FROM titles WHERE status=1 AND soz LIKE 'comp_%'`
    );
    for (const j of junk) {
      stats.junkOff++;
      console.log('JUNK', j.soz);
      if (WRITE) await conn.query('UPDATE titles SET status=0 WHERE id=?', [j.id]);
    }

    // --- 5) Refresh meta for any leftover wrong st_let ---
    const [titles] = await conn.query(
      'SELECT id, soz, normalized, search_key, st_let FROM titles WHERE status=1'
    );
    for (const t of titles) {
      const st = stLetFromSoz(t.soz);
      const norm = String(t.soz).toLocaleLowerCase('kk');
      const key = searchFold(t.soz);
      if (t.st_let !== st || t.normalized !== norm || t.search_key !== key) {
        stats.meta++;
        if (WRITE) {
          await conn.query(
            'UPDATE titles SET normalized=?, search_key=?, st_let=? WHERE id=?',
            [norm, key, st, t.id]
          );
        }
      }
    }

    if (WRITE) await conn.commit();
    console.log('SUMMARY', target.name, stats, WRITE ? 'WRITE' : 'DRY-RUN');

    // Final audit snapshot
    const [allTitles] = await conn.query('SELECT id, soz, st_let FROM titles WHERE status=1');
    const [allDefs] = await conn.query(
      `SELECT d.description FROM description d JOIN titles t ON t.id=d.titles_id AND t.status=1`
    );
    let latinTitle = 0;
    let wrongSt = 0;
    let promo = 0;
    let numbered = 0;
    let mixedLat = 0;
    for (const t of allTitles) {
      if (LAT.test(t.soz) && !CYR.test(t.soz.replace(/(?:^|\s)[IVXLCІі]{1,8}(?:-[IVXLCІі]{1,8})?(?=\s|$)/g, ' '))) {
        latinTitle++;
      }
      if (stLetFromSoz(t.soz) !== t.st_let) wrongSt++;
    }
    for (const d of allDefs) {
      const text = d.description || '';
      if (/={3,}|aǵza bolıń|ағза болың|MAYDA ADAM/i.test(text)) promo++;
      if (LAT.test(text)) mixedLat++;
      const parts = parseNumberedSenses(text);
      if (
        parts.length >= 2 &&
        parts[0].n === 1 &&
        /(^|\s)1[.)]\s/.test(text) &&
        /(^|\s)2[.)]\s/.test(text)
      ) {
        numbered++;
      }
    }
    console.log('AUDIT', {
      titles: allTitles.length,
      defs: allDefs.length,
      latinTitle,
      wrongSt,
      promo,
      numbered,
      stillHasLatinInDef: mixedLat,
    });
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
