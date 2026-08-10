/**
 * Túsindirme sifat tozalaw (LOCAL + AIVEN):
 * 1) Telegram promo / MAYDA ADAM junk
 * 2) Lotin title → kirill; dublikat (QLAS/ҚЛАС → ЫҚЛАС) óshiriw
 * 3) "1. 2. 3." → ayrı ma'nolar
 * 4) st_let ni sof kirill háripine qayta esaplaw (F/Ғ adasıwın túzetedi)
 *
 * Usage:
 *   node scripts/fix-tusindirme-quality.js --target=both
 *   node scripts/fix-tusindirme-quality.js --target=aiven --write
 *   node scripts/fix-tusindirme-quality.js --target=local --write
 */
import dotenv from 'dotenv';
dotenv.config();

import crypto from 'crypto';
import mysql from 'mysql2/promise';
import { mysqlSslOptions } from '../src/config/mysqlSsl.js';
import { toCyrillic, detectScript } from '../src/utils/qqScript.js';
import { parseNumberedSenses } from '../src/utils/glossStructure.js';
import searchFold from '../src/utils/searchFold.js';
import { stLetFromSoz } from '../src/utils/letterIndex.js';

const WRITE = process.argv.includes('--write');
const targetArg = (process.argv.find((a) => a.startsWith('--target=')) || '--target=both').split('=')[1];

const LAT = /[A-Za-zÁáÓóÚúŃńǴǵÍíı]/;
const CYR = /[\u0400-\u04FF]/;

const HEADWORD_FIXES = new Map([
  ['QLAS', 'ЫҚЛАС'],
  ['qlas', 'ықлас'],
  ['Qlas', 'Ықлас'],
  ['QLASLÍ', 'ЫҚЛАСЛЫ'],
  ['QLASLI', 'ЫҚЛАСЛЫ'],
  ['QLASLı', 'ЫҚЛАСЛЫ'],
  ['ҚЛАС', 'ЫҚЛАС'],
  ['ҚЛАСЛЫ', 'ЫҚЛАСЛЫ'],
  ['қлас', 'ықлас'],
  ['қласлы', 'ықласлы'],
]);

const JUNK_TITLE_RE = /^(ESTE\s+SAQLA[ŃN]|comp_)$/i;
const ROMAN_TOKEN_RE =
  /(?:^|\s)([IVXLCivxlcІі]{1,8}(?:-[IVXLCivxlcІі]{1,8})?)(?=\s|$)/g;

function shortId() {
  return crypto.randomBytes(4).toString('hex');
}
function hasLatin(s) {
  return LAT.test(s || '');
}
function hasCyrillic(s) {
  return CYR.test(s || '');
}
function lemmaWithoutRoman(soz) {
  return String(soz || '')
    .replace(ROMAN_TOKEN_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function foldKey(s) {
  return searchFold(String(s || ''));
}
function normalizeTitleCase(cyr) {
  const t = String(cyr || '').trim();
  if (!t) return t;
  const letters = t.replace(/[^\p{L}]/gu, '');
  const upper = [...letters].filter((ch) => ch === ch.toUpperCase()).length;
  if (letters.length && upper / letters.length >= 0.6) return t.toLocaleUpperCase('kk');
  return t;
}
function resolveHeadFix(soz) {
  const trimmed = String(soz || '').trim();
  if (HEADWORD_FIXES.has(trimmed)) return HEADWORD_FIXES.get(trimmed);
  const lower = trimmed.toLocaleLowerCase('kk');
  for (const [k, v] of HEADWORD_FIXES) {
    if (k.toLocaleLowerCase('kk') === lower) return v;
  }
  return null;
}
function resolveCanonicalSoz(soz) {
  const trimmed = String(soz || '').trim();
  if (!trimmed) return trimmed;
  const fixed = resolveHeadFix(trimmed);
  if (fixed) return fixed;

  const core = lemmaWithoutRoman(trimmed);
  if (!hasLatin(core)) return trimmed;

  if (hasLatin(core) && !hasCyrillic(core)) {
    const m = trimmed.match(/^(.*?)(\s+[IVXLCivxlcІі]{1,8}(?:-[IVXLCivxlcІі]{1,8})?)?$/);
    const head = (m?.[1] || trimmed).trim();
    const romanSuffix = (m?.[2] || '').trim();
    const cyr = normalizeTitleCase(toCyrillic(head));
    return romanSuffix ? `${cyr} ${romanSuffix}` : cyr;
  }

  const parts = [];
  let last = 0;
  const re = /(?:^|\s)([IVXLCivxlcІі]{1,8}(?:-[IVXLCivxlcІі]{1,8})?)(?=\s|$)/g;
  let m;
  const s = trimmed;
  while ((m = re.exec(s)) !== null) {
    const start = m.index + (m[0].startsWith(' ') ? 1 : 0);
    if (start > last) parts.push({ type: 'text', v: s.slice(last, start) });
    parts.push({ type: 'roman', v: m[1] });
    last = re.lastIndex;
  }
  if (last < s.length) parts.push({ type: 'text', v: s.slice(last) });
  if (!parts.length) parts.push({ type: 'text', v: s });
  return normalizeTitleCase(
    parts
      .map((p) => (p.type === 'roman' ? p.v : toCyrillic(p.v)))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}
function titleNeedsScriptFix(soz) {
  if (resolveHeadFix(soz)) return true;
  return hasLatin(lemmaWithoutRoman(soz));
}
function stripPromo(text) {
  let t = String(text || '');
  if (!t) return t;
  t = t.replace(/\s*=+\s*=*.*$/su, '');
  t = t.replace(/\s*Kanallarımızǵa\s+aǵza\s+bolıń!?\s*$/iu, '');
  t = t.replace(/\s*Каналларымызға\s+ағза\s+болың!?\s*$/iu, '');
  t = t.replace(/\s*MAYDA\s+ADAM\.?\s*$/iu, '');
  t = t.replace(/\s*MAYDA\s+ADAM\.?/giu, '');
  return t.replace(/\s+/g, ' ').trim();
}
function toCanonicalText(text) {
  let t = stripPromo(text);
  if (!t) return t;
  const script = detectScript(t);
  if (script === 'latin' || (script === 'mixed' && hasLatin(t))) t = toCyrillic(t);
  return t.replace(/\s+/g, ' ').trim();
}
function shouldSplitNumbered(text) {
  const senses = parseNumberedSenses(text);
  if (senses.length < 2) return null;
  if (senses[0].n !== 1) return null;
  const nums = new Set(senses.map((s) => s.n));
  if (!nums.has(1) || !nums.has(2)) return null;
  if (senses.some((s) => s.text.trim().length < 2)) return null;
  const plain = String(text || '').trim();
  if (!/(^|\s)1[.)]\s/.test(plain) || !/(^|\s)2[.)]\s/.test(plain)) return null;
  return senses;
}

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
  const localUrl = process.env.DATABASE_TUSINDIRME;
  const local = localUrl
    ? { name: 'local', cfg: parseUrl(localUrl), ssl: false }
    : {
        name: 'local',
        cfg: {
          host: '127.0.0.1',
          port: 3306,
          user: 'admin',
          password: 'Admin123',
          database: 'kk_tusindirme',
        },
        ssl: false,
      };
  const aiven = {
    name: 'aiven',
    cfg: {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 16342,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME || process.env.KK_TUSINDIRME_DB || 'kk_tusindirme',
    },
    ssl: true,
  };
  if (targetArg === 'local') return [local];
  if (targetArg === 'aiven') return [aiven];
  return [local, aiven];
}

async function runOnTarget(target) {
  const ssl = target.ssl ? mysqlSslOptions() : undefined;
  const pool = mysql.createPool({
    ...target.cfg,
    waitForConnections: true,
    connectionLimit: 4,
    charset: 'utf8mb4',
    ...(ssl ? { ssl } : {}),
  });

  const stats = {
    promoStripped: 0,
    titlesConverted: 0,
    titlesDeactivated: 0,
    titlesJunk: 0,
    sensesSplit: 0,
    sensesCreated: 0,
    defsConverted: 0,
    examplesConverted: 0,
    stLetFixed: 0,
  };

  const conn = await pool.getConnection();
  try {
    const [[who]] = await conn.query('SELECT DATABASE() db');
    console.log(`\n########## ${target.name.toUpperCase()} → ${target.cfg.host} / ${who.db} ##########`);

    const [titles] = await conn.query(
      'SELECT id, soz, normalized, search_key, st_let, status FROM titles'
    );
    const byFold = new Map();
    const stillActive = () => titles.filter((t) => Number(t.status) === 1);

    if (WRITE) await conn.beginTransaction();

    // 1) Junk
    for (const t of stillActive()) {
      const junk =
        JUNK_TITLE_RE.test(t.soz) ||
        (t.soz.length === 1 && hasLatin(t.soz) && !hasCyrillic(t.soz));
      if (!junk) continue;
      stats.titlesJunk++;
      console.log('JUNK', t.soz);
      if (WRITE) await conn.query('UPDATE titles SET status=0 WHERE id=?', [t.id]);
      t.status = 0;
    }

    byFold.clear();
    for (const t of stillActive()) {
      const k = foldKey(resolveCanonicalSoz(t.soz));
      if (!byFold.has(k)) byFold.set(k, []);
      byFold.get(k).push(t);
    }

    // 2) Script / headword fixes
    for (const t of stillActive()) {
      if (/^comp_/i.test(t.soz)) continue;
      if (t.soz.length <= 1 && !hasCyrillic(t.soz)) continue;
      if (/^[IVXLC]+$/i.test(t.soz)) continue;
      if (!titleNeedsScriptFix(t.soz)) continue;

      const canonical = resolveCanonicalSoz(t.soz);
      if (!canonical || canonical === t.soz) continue;

      const k = foldKey(canonical);
      const rivals = (byFold.get(k) || []).filter((x) => x.id !== t.id && Number(x.status) === 1);
      const cyrRivals = rivals.filter((x) => hasCyrillic(x.soz) && !hasLatin(lemmaWithoutRoman(x.soz)));
      cyrRivals.sort((a, b) => {
        const score = (s) => (/[қғңўәөүҳ]/i.test(s.soz) ? 2 : 0) + (s.soz.length <= 40 ? 1 : 0);
        return score(b) - score(a);
      });
      const anyRival = cyrRivals[0] || rivals[0];

      if (anyRival) {
        stats.titlesDeactivated++;
        console.log(`DUP  ${t.soz} → keep ${anyRival.soz}`);
        if (WRITE) await conn.query('UPDATE titles SET status=0 WHERE id=?', [t.id]);
        t.status = 0;
        continue;
      }

      const normalized = canonical.toLocaleLowerCase('kk');
      const key = searchFold(canonical);
      const st = stLetFromSoz(canonical);
      stats.titlesConverted++;
      console.log(`TITLE ${t.soz} → ${canonical} [${st}]`);
      if (WRITE) {
        await conn.query(
          'UPDATE titles SET soz=?, normalized=?, search_key=?, st_let=? WHERE id=?',
          [canonical, normalized, key, st, t.id]
        );
      }
      for (const [, list] of byFold) {
        const idx = list.findIndex((x) => x.id === t.id);
        if (idx >= 0) list.splice(idx, 1);
      }
      t.soz = canonical;
      t.normalized = normalized;
      t.search_key = key;
      t.st_let = st;
      const list = byFold.get(k) || [];
      list.push(t);
      byFold.set(k, list);
    }

    // 3) Descriptions
    const [defs] = await conn.query(
      `SELECT d.id, d.titles_id, d.sort_order, d.categorys_id, d.description
       FROM description d JOIN titles t ON t.id = d.titles_id WHERE t.status = 1`
    );
    const defsByTitle = new Map();
    for (const d of defs) {
      if (!defsByTitle.has(d.titles_id)) defsByTitle.set(d.titles_id, []);
      defsByTitle.get(d.titles_id).push(d);
    }
    for (const list of defsByTitle.values()) {
      list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    }

    for (const d of defs) {
      const title = titles.find((t) => t.id === d.titles_id);
      if (!title || Number(title.status) !== 1) continue;

      const original = String(d.description || '');
      const stripped = stripPromo(original);
      if (stripped !== original.trim() && stripped !== original) stats.promoStripped++;

      const senses = shouldSplitNumbered(stripped);
      if (senses) {
        const first = toCanonicalText(senses[0].text);
        const rest = senses.slice(1).map((s) => toCanonicalText(s.text)).filter(Boolean);
        stats.sensesSplit++;
        console.log(`SPLIT ${title.soz}: ${senses.length}`);
        if (WRITE) {
          await conn.query('UPDATE description SET description=? WHERE id=?', [first, d.id]);
          const siblings = defsByTitle.get(d.titles_id) || [];
          let nextOrder = Math.max(...siblings.map((x) => x.sort_order || 0), d.sort_order || 0);
          for (const part of rest) {
            nextOrder += 1;
            const id = shortId();
            await conn.query(
              'INSERT INTO description (id, titles_id, categorys_id, description, sort_order) VALUES (?,?,?,?,?)',
              [id, d.titles_id, d.categorys_id, part, nextOrder]
            );
            stats.sensesCreated++;
            siblings.push({ id, titles_id: d.titles_id, sort_order: nextOrder });
          }
        } else {
          stats.sensesCreated += rest.length;
        }
        continue;
      }

      const converted = toCanonicalText(stripped);
      if (converted && converted !== original) {
        stats.defsConverted++;
        if (WRITE) await conn.query('UPDATE description SET description=? WHERE id=?', [converted, d.id]);
      }
    }

    // 4) Examples
    const [exs] = await conn.query(
      `SELECT e.id, e.example, e.author FROM examples e
       JOIN description d ON d.id = e.descriptions_id
       JOIN titles t ON t.id = d.titles_id AND t.status = 1`
    );
    for (const e of exs) {
      const ex = toCanonicalText(e.example);
      const au = e.author ? toCanonicalText(e.author) : e.author;
      if (ex !== e.example || au !== e.author) {
        stats.examplesConverted++;
        if (WRITE) await conn.query('UPDATE examples SET example=?, author=? WHERE id=?', [ex, au, e.id]);
      }
    }

    // 5) Rebuild ALL st_let + normalized/search_key for active titles
    for (const t of stillActive()) {
      const st = stLetFromSoz(t.soz);
      const normalized = String(t.soz || '').toLocaleLowerCase('kk');
      const key = searchFold(t.soz);
      if (t.st_let !== st || t.normalized !== normalized || t.search_key !== key) {
        stats.stLetFixed++;
        if (stats.stLetFixed <= 20) {
          console.log(`META ${t.soz}: st_let ${t.st_let}→${st}`);
        }
        if (WRITE) {
          await conn.query(
            'UPDATE titles SET normalized=?, search_key=?, st_let=? WHERE id=?',
            [normalized, key, st, t.id]
          );
        }
        t.st_let = st;
        t.normalized = normalized;
        t.search_key = key;
      }
    }

    if (WRITE) await conn.commit();

    console.log('SUMMARY', target.name, stats);
    console.log('MODE:', WRITE ? 'WRITE' : 'DRY-RUN');

    const [check] = await conn.query(
      `SELECT id, soz, st_let, status FROM titles
       WHERE id IN ('abf80934','b7ddbb9c','529d2107','752311ad','702808f0','128d30a2','7d8206dd','23eb520d')
          OR soz IN ('ҚЛАС','ҚЛАСЛЫ','ЫҚЛАС','ЫҚЛАСЛЫ','ҒАРҚ ІІ','ФАППЕК','ФАППЕМ')
       ORDER BY soz`
    );
    console.log('check', check);

    const [fWrong] = await conn.query(
      `SELECT id, soz, st_let FROM titles WHERE status=1 AND soz LIKE 'Ғ%' AND st_let IN ('F','f','Ф','ф') LIMIT 10`
    );
    console.log('Ғ with wrong st_let', fWrong);

    const [promo] = await conn.query(
      `SELECT COUNT(*) c FROM description d JOIN titles t ON t.id=d.titles_id AND t.status=1
       WHERE d.description LIKE '%====%' OR d.description LIKE '%aǵza bolıń%' OR d.description LIKE '%ағза болың%'`
    );
    console.log('promo left', promo[0].c);
  } catch (err) {
    if (WRITE) await conn.rollback();
    throw err;
  } finally {
    conn.release();
    await pool.end();
  }
}

for (const t of targets()) {
  await runOnTarget(t);
}
