import dotenv from 'dotenv';
dotenv.config();
import db from '../src/config/dictionary.db.js';

const WRITE = process.argv.includes('--write');

// Lotin -> Kirill lookalike xarita (OCR xatolari)
const LAT2CYR = {
  A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', K: 'К', M: 'М',
  O: 'О', P: 'Р', T: 'Т', X: 'Х', Y: 'У', F: 'Ғ', I: 'І',
  a: 'а', b: 'в', c: 'с', e: 'е', h: 'н', k: 'к', m: 'м',
  o: 'о', p: 'р', t: 'т', x: 'х', y: 'у', f: 'ғ', i: 'і',
};

const ROMAN_TOKEN = /^[IVXІ]+$/; // homonim belgisi (I, II, IV...) — tegilmaydi

function transliterateTitle(soz) {
  return soz
    .split(/\s+/)
    .map((tok) => {
      if (ROMAN_TOKEN.test(tok)) return tok.replace(/І/g, 'I'); // roman → lotin normalizatsiya
      return tok.replace(/[A-Za-z]/g, (ch) => LAT2CYR[ch] || ch);
    })
    .join(' ');
}

const POS_RE = '(ат|ф|кел|к|рәў|алм|сан|б|лингв|астр|диал\\.с|мед)';
// kichik harf davomi + POS: "омбырашы ат. ..." (kesilgan title davomi)
const CONT_RE = new RegExp(`^([а-яәғқңөүұһёіў-]{2,})\\s+${POS_RE}\\.\\s*(.*)$`, 'su');
// bosh so'z takror: "ЖОЛЫ ат. ..." yoki "TҮСИЎ Ф. ..."
const TAIL_RE = /^([А-ЯӘҒҚҢӨҮҰҺІЁЎA-Z-]{2,})[\s.]+(.*)$/su;
// ta'rif boshidagi POS teglari: "ат. астр. ..." -> kategoriya
const LEAD_POS_RE = new RegExp(`^((?:${POS_RE}\\.\\s*)+)(.*)$`, 'siu');

// mustaqil so'z sifatida yoziladigan davomlar — bo'sh joy bilan qo'shiladi
const STANDALONE_CONT = /^(етиў|жетиў|болыў|қылыў|салыў|бериў|алыў|урыў|қатыў|ислеў)$/iu;

/** takrorlangan 4-gram bor-yo'qligi (xato birlashuvni ushlaydi) */
function hasRepeatedChunk(s) {
  const t = s.replace(/[^\p{L}]/gu, '').toLocaleLowerCase('kk');
  for (let n = 4; n <= 6; n++) {
    for (let i = 0; i + 2 * n <= t.length; i++) {
      if (t.slice(i, i + n) === t.slice(i + n, i + 2 * n)) return true;
    }
  }
  return false;
}

/** OCR variantlarini tenglashtirish (қ→к, ғ→г...) */
function foldOcr(s) {
  return s
    .toLocaleLowerCase('kk')
    .replace(/қ/g, 'к')
    .replace(/ғ/g, 'г')
    .replace(/ң/g, 'н')
    .replace(/ә/g, 'а')
    .replace(/ө/g, 'о')
    .replace(/[үұў]/g, 'у')
    .replace(/һ/g, 'х')
    .replace(/і/g, 'и');
}

/** fragment aslida yangi (ikkinchi) yozuv boshlanishi bo'lsa true — birlashtirmaymiz */
function looksLikeSecondEntry(title, frag) {
  if (title.length < 4 || frag.length < 4) return false;
  return foldOcr(frag).slice(0, 4) === foldOcr(title).slice(0, 4);
}

async function findOrCreateCategory(conn, name) {
  const [rows] = await conn.query('SELECT id FROM categorys WHERE LOWER(name)=LOWER(?)', [name]);
  if (rows[0]) return rows[0].id;
  const [r] = await conn.query('INSERT INTO categorys (temp_id, name, code) VALUES (?,?,?)', [
    `cat_${name}`, name, name.toLowerCase(),
  ]);
  return r.insertId;
}

const [titles] = await db.query(
  `SELECT t.id, t.soz, t.status FROM titles t WHERE t.status = 1`
);

const [belgisizRow] = await db.query("SELECT id FROM categorys WHERE name = 'белгисиз' LIMIT 1");
const belgisizId = belgisizRow[0]?.id ?? null;

const actions = { translit: [], contFix: [], tailFix: [], deactivate: [] };

const conn = await db.getConnection();
try {
  if (WRITE) await conn.beginTransaction();

  const bySoz = new Map(titles.map((t) => [t.soz, t]));

  for (const t of titles) {
    let soz = t.soz;
    let changed = false;

    // 1) Lotin -> Kirill
    const hasLatin = /[A-Za-z]/.test(soz.replace(/\b[IVX]+\b/g, ''));
    if (hasLatin) {
      const fixed = transliterateTitle(soz);
      if (fixed !== soz) {
        if (bySoz.has(fixed)) {
          actions.deactivate.push({ id: t.id, soz, reason: `dublikat (${fixed} bar)` });
          if (WRITE) await conn.query('UPDATE titles SET status=0 WHERE id=?', [t.id]);
          continue;
        }
        actions.translit.push({ id: t.id, from: soz, to: fixed });
        soz = fixed;
        changed = true;
      }
    }

    // Descriptions olish
    const [defs] = await conn.query(
      'SELECT d.id, d.description, d.categorys_id FROM description d WHERE d.titles_id=? ORDER BY d.sort_order',
      [t.id]
    );

    if (defs.length) {
      const d = defs[0];
      const desc = (d.description || '').trim();

      // 2) Kesilgan title davomi: "омбырашы ат. ..."
      const mCont = desc.match(CONT_RE);
      if (mCont && soz.length <= 12 && !/\s/.test(soz)) {
        const frag = mCont[1];
        const joiner = STANDALONE_CONT.test(frag) ? ' ' : '';
        const newTitle = (soz + joiner + frag).toUpperCase().replace(/-$/, '');
        const pos = mCont[2].toLowerCase() + '.';
        const rest = (mCont[3] || '').trim();
        if (
          rest.length >= 3 &&
          !bySoz.has(newTitle) &&
          !hasRepeatedChunk(newTitle) &&
          !looksLikeSecondEntry(soz, frag)
        ) {
          actions.contFix.push({ id: t.id, from: soz, to: newTitle, pos, newDef: rest.slice(0, 50) });
          if (WRITE) {
            await conn.query('UPDATE titles SET soz=?, normalized=?, st_let=? WHERE id=?', [
              newTitle, newTitle.toLocaleLowerCase('kk'), newTitle.charAt(0), t.id,
            ]);
            await conn.query('UPDATE description SET description=? WHERE id=?', [rest, d.id]);
            if (d.categorys_id === belgisizId || d.categorys_id == null) {
              const catId = await findOrCreateCategory(conn, pos);
              await conn.query('UPDATE description SET categorys_id=? WHERE id=?', [catId, d.id]);
            }
          }
          continue;
        }
      }

      // 3) Bosh so'z takrori: "ЖОЛЫ ат. ..." (birinchi so'z title oxirgi so'ziga teng)
      const mTail = desc.match(TAIL_RE);
      if (mTail) {
        const firstWord = mTail[1];
        const lastTitleWord = soz.split(/\s+/).pop();
        if (
          firstWord.toLocaleLowerCase('kk') === lastTitleWord.toLocaleLowerCase('kk') &&
          (mTail[2] || '').trim().length >= 3
        ) {
          let rest = mTail[2].trim();
          let pos = null;

          // ta'rif boshidagi POS teglarini kategoriyaga ko'chirish
          const mPos = rest.match(LEAD_POS_RE);
          if (mPos && (mPos[3] || '').trim().length >= 3) {
            pos = mPos[1].trim().replace(/\s+/g, ' ').toLowerCase();
            rest = mPos[3].trim();
          }

          if (rest.length >= 3) {
            actions.tailFix.push({ id: t.id, soz, pos, oldDef: desc.slice(0, 50), newDef: rest.slice(0, 50) });
            if (WRITE) {
              await conn.query('UPDATE description SET description=? WHERE id=?', [rest, defs[0].id]);
              if (pos && (defs[0].categorys_id === belgisizId || defs[0].categorys_id == null)) {
                const catId = await findOrCreateCategory(conn, pos);
                await conn.query('UPDATE description SET categorys_id=? WHERE id=?', [catId, defs[0].id]);
              }
            }
          }
        }
      } else {
        // 3b) title to'g'ri, lekin ta'rif faqat POS bilan boshlanadi: "ат. астр. ..."
        const mPosOnly = desc.match(LEAD_POS_RE);
        if (mPosOnly && (mPosOnly[3] || '').trim().length >= 3) {
          const pos = mPosOnly[1].trim().replace(/\s+/g, ' ').toLowerCase();
          const rest = mPosOnly[3].trim();
          if (d.categorys_id === belgisizId || d.categorys_id == null) {
            actions.tailFix.push({ id: t.id, soz, pos, oldDef: desc.slice(0, 50), newDef: rest.slice(0, 50) });
            if (WRITE) {
              await conn.query('UPDATE description SET description=? WHERE id=?', [rest, d.id]);
              const catId = await findOrCreateCategory(conn, pos);
              await conn.query('UPDATE description SET categorys_id=? WHERE id=?', [catId, d.id]);
            }
          }
        }
      }
    }

    // Lotin title yozish (translit)
    if (changed && WRITE) {
      await conn.query('UPDATE titles SET soz=?, normalized=?, st_let=? WHERE id=?', [
        soz, soz.toLocaleLowerCase('kk'), soz.charAt(0), t.id,
      ]);
    }

    // 4) Hali ham buzilgan: 1 harfli yoki lotin qolgan
    const stillLatin = /[A-Za-z]/.test(soz.replace(/\b[IVX]+\b/g, ''));
    if (soz.length <= 1 || stillLatin) {
      actions.deactivate.push({ id: t.id, soz, reason: soz.length <= 1 ? '1 harf' : 'lotin qoldi' });
      if (WRITE) await conn.query('UPDATE titles SET status=0 WHERE id=?', [t.id]);
    }
  }

  if (WRITE) await conn.commit();
} catch (e) {
  if (WRITE) await conn.rollback();
  console.error('failed', e);
  conn.release();
  await db.end();
  process.exit(1);
}
conn.release();

console.log(JSON.stringify({
  mode: WRITE ? 'WRITE' : 'DRY-RUN',
  translit: actions.translit.length,
  contFix: actions.contFix.length,
  tailFix: actions.tailFix.length,
  deactivate: actions.deactivate.length,
}, null, 2));

console.log('\n--- Lotin -> Kirill ---');
for (const a of actions.translit) console.log(` ${a.from}  ->  ${a.to}`);
console.log('\n--- Kesilgan title tiklandi ---');
for (const a of actions.contFix) console.log(` ${a.from}  ->  ${a.to}  [${a.pos}] :: ${a.newDef}`);
console.log('\n--- Ta\u2019rifdan bosh so\u2018z olib tashlandi ---');
for (const a of actions.tailFix.slice(0, 25)) console.log(` ${a.soz} [${a.pos || '-'}]: "${a.oldDef}" -> "${a.newDef}"`);
if (actions.tailFix.length > 25) console.log(` ... yana ${actions.tailFix.length - 25} ta`);
console.log('\n--- O\u2018chirildi (status=0) ---');
for (const a of actions.deactivate) console.log(` ${JSON.stringify(a.soz)} (${a.reason})`);

await db.end();
