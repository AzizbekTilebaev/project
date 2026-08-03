/**
 * ChatExport index-2.html → kk_tusindirme (sozlik only, strict validation)
 *
 *   node scripts/import-chatexport-sozlik.mjs           # dry-run → fordata/chatexport-review/
 *   node scripts/import-chatexport-sozlik.mjs --apply   # insert accepted items
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import searchFold from '../src/utils/searchFold.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const SRC = path.join(ROOT, 'new/ChatExport_2026-07-22/index-2.html');
const OUT = path.join(ROOT, 'fordata/chatexport-review');

const APPLY = process.argv.includes('--apply');

const HW_CHARS =
  "A-Za-zА-Яа-яӘәҒғҚқҢңӨөҮүЎўІіҺһÁáǴǵŃńÓóÚúÍıʼ'`\\-";
const HW_TOKEN = `[${HW_CHARS}]+`;
const HOMONYM = '(?:\\s+(?:[IVXivxІіⅤⅴ]{1,4}|[1-9]))?';
const POS_RE =
  '(?:at\\.?|ат\\.?|atlıq|atliq|atl[ıi]q\\s+sóz|feyil\\.?|фейил\\.?|kel\\.?|кел\\.?|kelbetlik|келбетлик|r\\.?|р\\.?)';

const PROMO_RE = new RegExp(
  'soz akciyas|xosh kel|diqqat|duris jaziw|assalawma|hurmetli topar',
  'i'
);

const BIBLIO_ONLY_RE =
  /фразеологизмлер сөзлиги|сөзлиги\.\s*Нөкис| Bul sózlikte |Бул сөзликте /i;

const BIO_RE = /^[A-ZÁǴŃÓÚÍЎÄÖÜА-ЯӘҒҚҢӨҮЎІ][\wʼ'`\-ÁáǴǵŃńÓóÚúÍıЎўӘәҒғҚқҢңӨөҮүІі]+\s+[A-ZÁǴŃÓÚÍЎА-ЯӘҒҚҢӨҮЎІ][\wʼ'`\-ÁáǴǵŃńÓóÚúÍıЎўӘәҒғҚқҢңӨөҮүІі]+\s*\(\s*\d{4}/;

function stripHtml(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function cleanText(raw) {
  let t = stripHtml(raw);
  t = t.replace(/\u00a0/g, ' ');
  t = t.replace(/\uFFFD/g, ' ');
  t = t.replace(/@[\w_]+/g, ' ');
  // emoji / symbols (broad ranges + known markers)
  t = t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, ' ');
  t = t.replace(/[🖊📖📝📒🗒🖍🔍📕🖌👉📚🔖✍️📜☝️❗️👇👆]/g, ' ');
  t = t.replace(
    /["“]?Qaraqalpaq tiliniń túsindirme sózligi["”]?\s*áleminen\s*/gi,
    ' '
  );
  t = t.replace(/Til bilimi terminlerinen\s*/gi, ' ');
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

/** Split raw card on dictionary emoji markers before cleaning */
function splitRawByMarkers(raw) {
  const parts = String(raw || '')
    .split(/(?=(?:📒|📖|📝|🖊|🗒\s*🖍))/u)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts : [raw];
}

function mapPos(raw) {
  const p = String(raw || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  if (!p) return 'белгисиз';
  if (/^at|^ат|atlıq|atliq|атл/.test(p)) return 'ат.';
  if (/feyil|фейил/.test(p)) return 'фейил.';
  if (/kel|кел/.test(p)) return 'кел.';
  if (/^r\.?$|^р\.?$/.test(p)) return 'р.';
  return p.slice(0, 40) || 'белгисиз';
}

function normalizeTitle(soz) {
  const s = String(soz || '')
    .replace(/\s+/g, ' ')
    .trim();
  return s.toLocaleLowerCase('kk');
}

function isValidHeadword(hw) {
  if (!hw || hw.length < 2 || hw.length > 80) return false;
  const words = hw.split(/\s+/).filter(Boolean);
  if (words.length > 3) return false;
  if (/синоним|sinonim|фразеолог|derek|дерек|мысал|tilindegi|qaraqalpaq tilindegi/i.test(hw)) {
    return false;
  }
  if (BIO_RE.test(hw)) return false;
  const first = hw.charAt(0);
  if (!/[A-Za-zÁáǴǵŃńÓóÚúÍıЎўА-Яа-яӘәҒғҚқҢңӨөҮүІіҺһ]/.test(first)) return false;
  if (/^[a-záǵńóúıў]+$/.test(hw) && hw.length < 12) return false;
  if (!new RegExp(`[${HW_CHARS}]`).test(hw)) return false;
  return true;
}

function looksLikeLexiconHead(hw) {
  const base = hw.replace(/\s+[IVXivxІі]{1,4}$/, '').trim();
  // All-caps / Title / Cyrillic capital start
  if (/^[A-ZÁǴŃÓÚÍЎА-ЯӘҒҚҢӨҮЎІҺ]/.test(base)) return true;
  // Allow cyrillic words that may be title-cased mid alphabet
  if (/^[А-ЯӘҒҚҢӨҮЎІҺа-яәғқңөүўіһ]/.test(base) && base.length >= 2) return true;
  return false;
}

function isValidDefinition(def) {
  const d = String(def || '').trim();
  if (d.length < 12) return false;
  if (/^[,.;:)\]}]/.test(d)) return false;
  if (PROMO_RE.test(d) && d.length < 80) return false;
  return true;
}

/** Split multi-entry posts: only on Title/CAPS headword + POS */
function splitMultiEntries(text) {
  const markers = [];
  const findRe = new RegExp(
    `\\b(${HW_TOKEN}${HOMONYM})\\s+(${POS_RE})\\b`,
    'gi'
  );
  let m;
  while ((m = findRe.exec(text)) !== null) {
    if (!looksLikeLexiconHead(m[1])) continue;
    // skip mid-sentence lowercase-start fragments already filtered
    markers.push({ index: m.index, hw: m[1] });
  }
  if (markers.length <= 1) return [text];
  const parts = [];
  for (let i = 0; i < markers.length; i++) {
    const start = markers[i].index;
    const end = i + 1 < markers.length ? markers[i + 1].index : text.length;
    parts.push(text.slice(start, end).trim());
  }
  return parts.length ? parts : [text];
}

function parseSingleEntry(chunk, meta) {
  const text = chunk.trim();
  if (!text) return null;

  // Pattern: HW [homonym] POS. definition
  const posPat = new RegExp(
    `^(${HW_TOKEN}${HOMONYM})\\s+(${POS_RE})\\s*[.:]?\\s*(.+)$`,
    'is'
  );
  let m = text.match(posPat);
  if (m) {
    const soz = m[1].replace(/\s+/g, ' ').trim();
    const category = mapPos(m[2]);
    let definition = m[3].trim();
    // strip trailing QTTS citation noise kept in definition — OK to keep
    definition = definition.replace(/\s*@[\w_]+\s*$/g, '').trim();
    if (!isValidHeadword(soz) || !isValidDefinition(definition)) return null;
    return {
      soz,
      normalized: normalizeTitle(soz),
      descriptions: [{ category, definition, order: 1 }],
      _meta: meta,
    };
  }

  // Pattern: HW - definition  OR  HW – definition
  const dashPat = new RegExp(
    `^(${HW_TOKEN}(?:[\\s\\-]${HW_TOKEN}){0,3}${HOMONYM})\\s*[-–—:]\\s+(.+)$`,
    'is'
  );
  m = text.match(dashPat);
  if (m) {
    const soz = m[1].replace(/\s+/g, ' ').trim();
    let definition = m[2].trim();
    if (!isValidHeadword(soz) || !isValidDefinition(definition)) return null;
    // reject bio-style "Name (1934-2010) – born..."
    if (/\(\s*\d{4}\s*[-–—]/.test(text.slice(0, 80))) return null;
    let category = 'белгисиз';
    const posLead = definition.match(
      new RegExp(`^\\(?(${POS_RE}|атlıq\\s+sóz)\\)?\\.?\\s*`, 'i')
    );
    if (posLead) {
      category = mapPos(posLead[1]);
      definition = definition.slice(posLead[0].length).trim();
    }
    if (!isValidDefinition(definition)) return null;
    return {
      soz,
      normalized: normalizeTitle(soz),
      descriptions: [{ category, definition, order: 1 }],
      _meta: meta,
    };
  }

  // Pattern: HW. Feyil. 1. ...
  const dotPos = new RegExp(
    `^(${HW_TOKEN}${HOMONYM})\\.\\s+(${POS_RE})\\.\\s*(.+)$`,
    'is'
  );
  m = text.match(dotPos);
  if (m) {
    const soz = m[1].replace(/\s+/g, ' ').trim();
    const category = mapPos(m[2]);
    const definition = m[3].trim();
    if (!isValidHeadword(soz) || !isValidDefinition(definition)) return null;
    return {
      soz,
      normalized: normalizeTitle(soz),
      descriptions: [{ category, definition, order: 1 }],
      _meta: meta,
    };
  }

  return null;
}

function extractNumberedDialectItems(text) {
  // 1️⃣ Word (A.) - def
  const items = [];
  const re =
    /(?:[\d️⃣1️⃣2️⃣3️⃣4️⃣5️⃣]+\s*|[0-9]+[.)]\s*)([A-Za-zÁáǴǵŃńÓóÚúÍıЎўӘәҒғҚқҢңӨөҮүІіА-Яа-яʼ'`\-]+(?:[\s\-][A-Za-zÁáǴǵŃńÓóÚúÍıЎўӘәҒғҚқҢңӨөҮүІіА-Яа-яʼ'`\-]+)?)\s*(?:\([A-Za-zА-Яа-я.]+\)\s*)?[-–—:]\s*([^1️⃣2️⃣3️⃣4️⃣5️⃣\n]+?)(?=(?:[\d️⃣]|[0-9]+[.)]|📚|$))/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const soz = m[1].trim();
    const definition = m[2].replace(/📜/g, ' ').replace(/\s+/g, ' ').trim();
    if (!isValidHeadword(soz) || !isValidDefinition(definition)) continue;
    items.push({
      soz,
      normalized: normalizeTitle(soz),
      descriptions: [{ category: 'диалект', definition, order: 1 }],
    });
  }
  return items;
}

function classifyCard(rawText, date) {
  const rejected = [];
  const accepted = [];
  const raw = stripHtml(rawText);
  const meta = { date, rawSnippet: raw.slice(0, 240) };

  // Whole-card rejects
  if (/duris jaziw|durıs jazıw|\u274c|\u2705/i.test(raw)) {
    return { accepted, rejected: [{ reason: 'spelling_drill', ...meta }] };
  }
  if (/soz akciyas|sóz akciyas|xosh kelipsiz|xosh keldi/i.test(raw)) {
    return { accepted, rejected: [{ reason: 'promo_aktsiya', ...meta }] };
  }
  if (/Ismińizdiń sırı|Isminizdin siri/i.test(raw)) {
    return { accepted, rejected: [{ reason: 'name_etymology', ...meta }] };
  }
  if (BIBLIO_ONLY_RE.test(raw) && !/(?:[-–—]| at\.|ат\.|feyil)/i.test(raw)) {
    return { accepted, rejected: [{ reason: 'bibliography_only', ...meta }] };
  }
  if (/синоним фразеолог/i.test(raw) && !new RegExp(`^${HW_TOKEN}\\s*[-–—]`, 'i').test(cleanText(raw))) {
    const cleaned = cleanText(raw);
    if (!parseSingleEntry(cleaned, meta)) {
      return { accepted, rejected: [{ reason: 'synonym_list', ...meta }] };
    }
  }

  // Dialect numbered list
  if (/dialekt sózler|диалект/i.test(raw) || (/[1-5]\uFE0F?\u20E3|1️⃣/.test(raw) && /Qr\.|A\.\)|диалект/i.test(raw))) {
    const dial = extractNumberedDialectItems(raw);
    if (dial.length >= 2) {
      for (const item of dial) {
        accepted.push({ ...item, _meta: { ...meta, source: 'dialect_list' } });
      }
      return { accepted, rejected };
    }
  }

  // Prefer emoji-marker splits on raw, then clean+parse each piece
  const rawParts = splitRawByMarkers(raw);
  let got = 0;
  for (const part of rawParts) {
    const cleanedPart = cleanText(part);
    if (!cleanedPart || cleanedPart.length < 10) continue;
    const chunks = splitMultiEntries(cleanedPart);
    for (const chunk of chunks) {
      const item = parseSingleEntry(chunk, { ...meta, source: 'card' });
      if (item) {
        accepted.push(item);
        got++;
      }
    }
  }

  if (!got) {
    const cleaned = cleanText(raw);
    if (!cleaned || cleaned.length < 10) {
      return { accepted, rejected: [{ reason: 'too_short', ...meta }] };
    }
    const item = parseSingleEntry(cleaned, { ...meta, source: 'fallback' });
    if (item) accepted.push(item);
    else rejected.push({ reason: 'unparseable', text: cleaned.slice(0, 300), ...meta });
  }

  return { accepted, rejected };
}

function extractCards(html) {
  const cards = [];
  const re =
    /<article class="card" data-cat="sozlik"[^>]*>[\s\S]*?<span class="card-date">([\s\S]*?)<\/span>[\s\S]*?<p class="card-text">([\s\S]*?)<\/p>/gi;
  let m;
  let idx = 0;
  while ((m = re.exec(html)) !== null) {
    cards.push({
      index: idx++,
      date: stripHtml(m[1]),
      text: m[2],
    });
  }
  return cards;
}

function dedupeItems(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = searchFold(item.normalized || item.soz);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function toImportPayload(items) {
  return items.map(({ soz, normalized, descriptions }) => ({
    soz,
    normalized,
    descriptions: descriptions.map((d, i) => ({
      category: d.category || 'белгисиз',
      definition: d.definition,
      order: d.order || i + 1,
      ...(d.example ? { example: d.example } : {}),
    })),
  }));
}

async function loadLocalIndex(db) {
  const [rows] = await db.query(
    `SELECT id, soz, normalized, search_key FROM titles WHERE status = 1`
  );
  const byNorm = new Set();
  const byExact = new Set();
  for (const r of rows) {
    byExact.add(String(r.soz || ''));
    byNorm.add(searchFold(r.normalized || r.soz || ''));
    if (r.search_key) byNorm.add(searchFold(r.search_key));
  }
  return { byExact, byNorm, count: rows.length };
}

function filterAgainstDb(items, local) {
  const fresh = [];
  const dupes = [];
  for (const item of items) {
    const fold = searchFold(item.normalized || item.soz);
    if (local.byExact.has(item.soz) || local.byNorm.has(fold)) {
      dupes.push({ soz: item.soz, reason: 'already_in_db' });
      continue;
    }
    fresh.push(item);
  }
  return { fresh, dupes };
}

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error('Source missing:', SRC);
    process.exit(1);
  }

  const html = fs.readFileSync(SRC, 'utf8');
  const cards = extractCards(html);
  console.log(`Cards (sozlik): ${cards.length}`);

  const accepted = [];
  const rejected = [];
  for (const card of cards) {
    const { accepted: a, rejected: r } = classifyCard(card.text, card.date);
    for (const item of a) {
      accepted.push({ ...item, _cardIndex: card.index });
    }
    for (const item of r) {
      rejected.push({ ...item, _cardIndex: card.index });
    }
  }

  const deduped = dedupeItems(accepted);
  const payload = toImportPayload(deduped);

  fs.mkdirSync(OUT, { recursive: true });

  // Validate AJV on payload (may be empty)
  let ajvOk = true;
  let ajvErrors = null;
  if (payload.length) {
    const { validateTitlesArray } = await import('../src/validators/title.validator.js');
    ajvOk = validateTitlesArray(payload);
    if (!ajvOk) ajvErrors = validateTitlesArray.errors;
  }

  const summary = {
    source: SRC,
    cards: cards.length,
    acceptedRaw: accepted.length,
    acceptedDeduped: deduped.length,
    rejected: rejected.length,
    rejectReasons: rejected.reduce((acc, r) => {
      acc[r.reason] = (acc[r.reason] || 0) + 1;
      return acc;
    }, {}),
    ajvOk,
    ajvErrors,
    apply: APPLY,
  };

  fs.writeFileSync(
    path.join(OUT, 'accepted.json'),
    JSON.stringify(
      deduped.map(({ soz, normalized, descriptions, _meta, _cardIndex }) => ({
        soz,
        normalized,
        descriptions,
        meta: _meta,
        cardIndex: _cardIndex,
      })),
      null,
      2
    )
  );
  fs.writeFileSync(path.join(OUT, 'rejected.json'), JSON.stringify(rejected, null, 2));
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));

  console.log(JSON.stringify(summary, null, 2));
  console.log(`Wrote ${OUT}`);

  if (!ajvOk) {
    console.error('AJV validation failed — not applying');
    process.exit(2);
  }

  if (!APPLY) {
    console.log('Dry-run only. Re-run with --apply to insert.');
    return;
  }

  if (!payload.length) {
    console.log('Nothing to import.');
    return;
  }

  const { default: db } = await import('../src/config/dictionary.db.js');
  const TusindirmeService = (await import('../src/services/tusindirmeService.js')).default;

  const [[dbName]] = await db.query('SELECT DATABASE() AS db');
  console.log('Target DB:', dbName.db);

  const local = await loadLocalIndex(db);
  console.log(`Local titles: ${local.count}`);

  const { fresh, dupes } = filterAgainstDb(payload, local);
  console.log(`After DB dedupe: ${fresh.length} fresh, ${dupes.length} already present`);

  fs.writeFileSync(
    path.join(OUT, 'apply-dupes.json'),
    JSON.stringify(dupes, null, 2)
  );

  if (!fresh.length) {
    console.log('All accepted items already in DB.');
    await db.end();
    return;
  }

  const service = new TusindirmeService();
  const result = await service.insertNested(fresh);
  console.log(`IMPORT: ${result.added} qo‘shildi, ${result.skipped} tashlab ketildi.`);

  summary.imported = result.added;
  summary.skippedOnInsert = result.skipped;
  summary.dupesBeforeInsert = dupes.length;
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));

  await db.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
