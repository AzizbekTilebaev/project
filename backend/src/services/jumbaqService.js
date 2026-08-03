import crypto from 'crypto';
import { pools } from '../config/db.js';
import { toCyrillic, toLatin } from '../utils/qqScript.js';
import searchFold from '../utils/searchFold.js';
import { gradeProduceSubmission } from '../utils/produceGrade.js';
import { buildProduceAccepted } from './tutorService.js';

const db = pools.jumbaqlar;
const aiDb = pools.ai;

function httpError(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

const SCRIPTS = new Set(['original', 'latin', 'cyrillic']);

/**
 * Yagona kontrakt: 'cyrillic' | 'latin'.
 * Jumbaq manbasi Latin; 'original' → 'latin' (manba), 'cyrillic' → Kirill.
 * Literature bilan UI bir xil: Cyrillic tugmasi = cyrillic, Latin = latin.
 */
export function normalizeScript(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return 'latin';
  if (!SCRIPTS.has(s)) {
    throw httpError('script "cyrillic", "latin" yamasa "original" bolıwı kerek');
  }
  // UI "Кирилл" → cyrillic; eski "original" jumbaqda manba (=latin) edi —
  // endi UI bir xil: original/cyrillic → cyrillic display.
  if (s === 'cyrillic' || s === 'original') return 'cyrillic';
  return 'latin';
}

function clampLimit(raw, fallback = 24, max = 100) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(max, Math.floor(n));
}

function clampPage(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

/** topar/utopar: bos → null, pútin emes → 400. */
function parseCategory(raw, name) {
  if (raw === '' || raw == null) return null;
  const n = Number(String(raw).trim());
  if (!Number.isInteger(n) || n < 0 || n > 100000) {
    throw httpError(`${name} pútin san bolıwı kerek`);
  }
  return n;
}

/** Sof: juwap accepted list (latin/cyr + fold). */
export function buildJumbaqAccepted(row) {
  const raw = [
    row?.juwap_original,
    row?.juwap_cyrillic,
    row?.juwapOriginal,
    row?.juwapCyrillic,
    row?.juwap,
    row?.answer,
  ]
    .map((x) => String(x || '').trim())
    .filter(Boolean);
  const expanded = [];
  for (const a of raw) {
    expanded.push(a, toLatin(a), toCyrillic(a));
  }
  const accepted = [];
  for (const a of expanded) {
    for (const part of buildProduceAccepted(a)) {
      if (part && !accepted.some((x) => searchFold(x) === searchFold(part))) {
        accepted.push(part);
      }
    }
  }
  return accepted;
}

/** Sof: answer maydanların public payloadtan alıp taslaw. */
export function stripJumbaqAnswers(mapped) {
  if (!mapped) return null;
  const {
    juwap: _j,
    juwapOriginal: _jo,
    juwapLatin: _jl,
    juwapCyrillic: _jc,
    answer: _a,
    ...rest
  } = mapped;
  return { ...rest, answerHidden: true };
}

function mapJumbaqFull(row, { script = 'latin' } = {}) {
  if (!row) return null;
  const original = row.jumbaq_original; // source Latin
  const cyr = row.jumbaq_cyrillic || toCyrillic(original);
  const answerOriginal = row.juwap_original;
  const answerCyr = row.juwap_cyrillic || toCyrillic(answerOriginal);
  const showLatin = script === 'latin';
  return {
    id: row.id,
    jumbaq: showLatin ? original : cyr,
    jumbaqOriginal: original,
    jumbaqLatin: original,
    jumbaqCyrillic: cyr,
    juwap: showLatin ? answerOriginal : answerCyr,
    juwapOriginal: answerOriginal,
    juwapLatin: answerOriginal,
    juwapCyrillic: answerCyr,
    answer: showLatin ? answerOriginal : answerCyr,
    topar: row.topar,
    utopar: row.utopar,
    status: row.status,
  };
}

/**
 * @param {{ script?: string, includeAnswer?: boolean }} opts
 * includeAnswer=false (default) — public list/detail; juwap jasırın.
 */
export function mapJumbaq(row, { script = 'latin', includeAnswer = false } = {}) {
  const full = mapJumbaqFull(row, { script });
  if (!full) return null;
  return includeAnswer ? full : stripJumbaqAnswers(full);
}

export { parseCategory };

/**
 * Izlew sózin eki jazıwda LIKE shártine keńeytedi (parametrlengen, qáwipsiz).
 * "kolenke" ham "көлеңке" birdey nátiyje beredi.
 */
function buildSearchClause(query, params) {
  const variants = [...new Set([query, toLatin(query), toCyrillic(query)].filter(Boolean))];
  const clauses = [];
  for (const v of variants) {
    clauses.push(
      '(jumbaq_original LIKE ? OR jumbaq_cyrillic LIKE ? OR juwap_original LIKE ? OR juwap_cyrillic LIKE ?)'
    );
    const like = `%${v}%`;
    params.push(like, like, like, like);
  }
  return `(${clauses.join(' OR ')})`;
}

export async function listJumbaqlar({
  q = '',
  topar = '',
  utopar = '',
  script = 'original',
  page = 1,
  limit = 24,
} = {}) {
  const safeScript = normalizeScript(script);
  const safeLimit = clampLimit(limit);
  const safePage = clampPage(page);
  const offset = (safePage - 1) * safeLimit;
  const where = [`status = 'published'`];
  const params = [];

  const toparNum = parseCategory(topar, 'topar');
  if (toparNum != null) {
    where.push('topar = ?');
    params.push(toparNum);
  }
  const utoparNum = parseCategory(utopar, 'utopar');
  if (utoparNum != null) {
    where.push('utopar = ?');
    params.push(utoparNum);
  }
  const query = String(q || '').trim();
  if (query) {
    where.push(buildSearchClause(query, params));
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM jumbaqlar ${whereSql}`,
    params
  );
  const [rows] = await db.query(
    `SELECT id, jumbaq_original, jumbaq_cyrillic, juwap_original, juwap_cyrillic,
            topar, utopar, status
     FROM jumbaqlar
     ${whereSql}
     ORDER BY id ASC
     LIMIT ? OFFSET ?`,
    [...params, safeLimit, offset]
  );

  const jumbaqlar = rows.map((r) => mapJumbaq(r, { script: safeScript }));
  return {
    jumbaqlar,
    items: jumbaqlar,
    total: Number(total) || 0,
    page: safePage,
    limit: safeLimit,
  };
}

/**
 * Eń kóp ushırasqan juwaptan topar atın shıǵaradı (maǵlıwmattan inferred label).
 * "Aspan, jer" → "Aspan" (birinshi bólegi alınadı).
 */
export function inferLabel(answers) {
  const counts = new Map();
  for (const raw of answers) {
    const primary = String(raw || '').split(/[,;]/)[0].trim();
    if (!primary) continue;
    const key = primary.toLocaleLowerCase('kk');
    const entry = counts.get(key) || { count: 0, label: primary };
    entry.count += 1;
    if (primary.length < entry.label.length) entry.label = primary;
    counts.set(key, entry);
  }
  let best = null;
  for (const entry of counts.values()) {
    if (!best || entry.count > best.count) best = entry;
  }
  return best ? best.label : null;
}

// Kategoriya dizimi barlıq qatarlardı oqıydı — nátiyjeni qısqa waqıtqa keshleymiz.
const categoriesCache = new Map();
const CATEGORIES_TTL_MS = 5 * 60 * 1000;

export async function listCategories({ script = 'original' } = {}) {
  const safeScript = normalizeScript(script);
  const cached = categoriesCache.get(safeScript);
  if (cached && Date.now() - cached.at < CATEGORIES_TTL_MS) return cached.value;
  const [rows] = await db.query(
    `SELECT topar, utopar, juwap_original, juwap_cyrillic
     FROM jumbaqlar
     WHERE status = 'published'
     ORDER BY topar ASC`
  );

  const useCyr = safeScript === 'cyrillic';
  const toparMap = new Map();
  for (const row of rows) {
    if (!toparMap.has(row.topar)) {
      toparMap.set(row.topar, { topar: row.topar, utopar: row.utopar, count: 0, answers: [] });
    }
    const entry = toparMap.get(row.topar);
    entry.count += 1;
    entry.answers.push(
      useCyr ? row.juwap_cyrillic || toCyrillic(row.juwap_original) : row.juwap_original
    );
  }

  const topars = [...toparMap.values()]
    .sort((a, b) => a.topar - b.topar)
    .map(({ answers, ...entry }) => ({
      ...entry,
      id: entry.topar,
      label: inferLabel(answers) || `Topar ${entry.topar}`,
    }));

  const utoparMap = new Map();
  for (const t of topars) {
    if (!utoparMap.has(t.utopar)) {
      utoparMap.set(t.utopar, { utopar: t.utopar, count: 0, topars: [], labels: [] });
    }
    const entry = utoparMap.get(t.utopar);
    entry.count += t.count;
    entry.topars.push(t.topar);
    if (entry.labels.length < 3) entry.labels.push(t.label);
  }
  const utopars = [...utoparMap.values()]
    .sort((a, b) => a.utopar - b.utopar)
    .map(({ labels, ...entry }) => ({
      ...entry,
      label: labels.join(' · ') || `Úlken topar ${entry.utopar}`,
    }));

  const total = topars.reduce((sum, c) => sum + c.count, 0);
  const value = { categories: topars, topars, utopars, total };
  categoriesCache.set(safeScript, { at: Date.now(), value });
  return value;
}

export async function getJumbaqById(id, { script = 'original' } = {}) {
  const safeScript = normalizeScript(script);
  const num = Number(id);
  if (!Number.isInteger(num) || num < 1) throw httpError('Jumbaq ID qáte');
  const [[row]] = await db.query(
    `SELECT id, jumbaq_original, jumbaq_cyrillic, juwap_original, juwap_cyrillic,
            topar, utopar, status
     FROM jumbaqlar WHERE id = ? AND status = 'published' LIMIT 1`,
    [num]
  );
  if (!row) throw httpError('Jumbaq tabılmadı', 404);
  return mapJumbaq(row, { script: safeScript });
}

export async function getRandomJumbaq({ script = 'original', topar = '', utopar = '' } = {}) {
  const safeScript = normalizeScript(script);
  const where = [`status = 'published'`];
  const params = [];
  const toparNum = parseCategory(topar, 'topar');
  if (toparNum != null) {
    where.push('topar = ?');
    params.push(toparNum);
  }
  const utoparNum = parseCategory(utopar, 'utopar');
  if (utoparNum != null) {
    where.push('utopar = ?');
    params.push(utoparNum);
  }
  const [[row]] = await db.query(
    `SELECT id, jumbaq_original, jumbaq_cyrillic, juwap_original, juwap_cyrillic,
            topar, utopar, status
     FROM jumbaqlar WHERE ${where.join(' AND ')}
     ORDER BY RAND() LIMIT 1`,
    params
  );
  if (!row) throw httpError('Jumbaq tabılmadı', 404);
  return mapJumbaq(row, { script: safeScript });
}

/** Kúnlik deterministik indeks: birdey kún → birdey jumbaq (hámmege). */
export function dailyIndexFor(dayKey, count) {
  if (!count) return 0;
  const hash = crypto.createHash('sha1').update(`jumbaq-daily:${dayKey}`).digest();
  return hash.readUInt32BE(0) % count;
}

/** date query (YYYY-MM-DD) yamasa búgingi UTC kún. Nadurıs format → 400. */
export function resolveDayKey(date = null) {
  if (!date) return new Date().toISOString().slice(0, 10);
  const raw = String(date).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw httpError('date YYYY-MM-DD formatında bolıwı kerek');
  }
  return raw;
}

export async function getDailyJumbaq({ script = 'original', date = null } = {}) {
  const safeScript = normalizeScript(script);
  const day = resolveDayKey(date);
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM jumbaqlar WHERE status = 'published'`
  );
  const count = Number(total) || 0;
  if (!count) throw httpError('Jumbaqlar joq', 404);
  const idx = dailyIndexFor(day, count);
  const [rows] = await db.query(
    `SELECT id, jumbaq_original, jumbaq_cyrillic, juwap_original, juwap_cyrillic,
            topar, utopar, status
     FROM jumbaqlar WHERE status = 'published'
     ORDER BY id ASC LIMIT 1 OFFSET ?`,
    [idx]
  );
  const jumbaq = mapJumbaq(rows[0], { script: safeScript });
  return { ...jumbaq, date: day };
}

// ---------------------------------------------------------------------------
// Admin CRUD
// ---------------------------------------------------------------------------

const STATUSES = new Set(['published', 'draft']);

function hashText(text) {
  return crypto.createHash('sha256').update(String(text), 'utf8').digest('hex');
}

/** Jumbaq/juwap tekstlerin validatsiya qılıp, eki jazıwda tayarlaydı. */
function prepareJumbaqInput(payload) {
  const jumbaq = String(payload?.jumbaq || '').trim();
  const juwap = String(payload?.juwap || '').trim();
  if (jumbaq.length < 5) throw httpError('Jumbaq teksti keminde 5 belgiden ibarat bolıwı kerek');
  if (jumbaq.length > 2000) throw httpError('Jumbaq teksti 2000 belgiden aspawı kerek');
  if (!juwap) throw httpError('Juwap kerek');
  if (juwap.length > 500) throw httpError('Juwap 500 belgiden aspawı kerek');
  const topar = parseCategory(payload?.topar ?? 0, 'topar') ?? 0;
  const utopar = parseCategory(payload?.utopar ?? 0, 'utopar') ?? 0;
  const status = String(payload?.status || 'published');
  if (!STATUSES.has(status)) throw httpError('status "published" yamasa "draft" bolıwı kerek');
  // Manba Latin saqlanadı; Kirill avtomat esaplanadı
  const jumbaqLatin = toLatin(jumbaq);
  const juwapLatin = toLatin(juwap);
  return {
    jumbaqLatin,
    jumbaqCyrillic: toCyrillic(jumbaq),
    juwapLatin,
    juwapCyrillic: toCyrillic(juwap),
    topar,
    utopar,
    status,
    variantGroup: hashText(searchFold(`${jumbaqLatin}|${juwapLatin}`)).slice(0, 32),
  };
}

export async function listJumbaqlarAdmin({ q = '', status = '', page = 1, limit = 24 } = {}) {
  const safeLimit = clampLimit(limit);
  const safePage = clampPage(page);
  const offset = (safePage - 1) * safeLimit;
  const where = [];
  const params = [];
  if (status) {
    if (!STATUSES.has(status)) throw httpError('status "published" yamasa "draft" bolıwı kerek');
    where.push('status = ?');
    params.push(status);
  }
  const query = String(q || '').trim();
  if (query) where.push(buildSearchClause(query, params));
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM jumbaqlar ${whereSql}`,
    params
  );
  const [rows] = await db.query(
    `SELECT id, jumbaq_original, jumbaq_cyrillic, juwap_original, juwap_cyrillic,
            topar, utopar, status
     FROM jumbaqlar ${whereSql}
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [...params, safeLimit, offset]
  );
  return {
    items: rows.map((r) => mapJumbaq(r, { script: 'latin', includeAnswer: true })),
    total: Number(total) || 0,
    page: safePage,
    limit: safeLimit,
    pages: Math.max(1, Math.ceil((Number(total) || 0) / safeLimit)),
  };
}

export async function createJumbaqAdmin(payload) {
  const input = prepareJumbaqInput(payload);
  const conn = await db.getConnection();
  let id;
  try {
    await conn.beginTransaction();
    // id auto_increment emes — keyingi bos id atomar túrde esaplanadı
    const [[{ nextId }]] = await conn.query(
      'SELECT COALESCE(MAX(id), 0) + 1 AS nextId FROM jumbaqlar FOR UPDATE'
    );
    id = Number(nextId);
    await conn.query(
      `INSERT INTO jumbaqlar
        (id, jumbaq_original, jumbaq_cyrillic, juwap_original, juwap_cyrillic,
         topar, utopar, variant_group, content_hash, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.jumbaqLatin,
        input.jumbaqCyrillic,
        input.juwapLatin,
        input.juwapCyrillic,
        input.topar,
        input.utopar,
        input.variantGroup,
        hashText(`${id}|${input.jumbaqLatin}|${input.juwapLatin}|${input.topar}|${input.utopar}`),
        input.status,
      ]
    );
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  categoriesCache.clear();
  const [[row]] = await db.query('SELECT * FROM jumbaqlar WHERE id = ?', [id]);
  return mapJumbaq(row, { script: 'latin', includeAnswer: true });
}

export async function updateJumbaqAdmin(id, payload) {
  const num = Number(id);
  if (!Number.isInteger(num) || num < 1) throw httpError('Jumbaq ID qáte');
  const [[existing]] = await db.query('SELECT * FROM jumbaqlar WHERE id = ? LIMIT 1', [num]);
  if (!existing) throw httpError('Jumbaq tabılmadı', 404);

  const input = prepareJumbaqInput({
    jumbaq: payload?.jumbaq ?? existing.jumbaq_original,
    juwap: payload?.juwap ?? existing.juwap_original,
    topar: payload?.topar ?? existing.topar,
    utopar: payload?.utopar ?? existing.utopar,
    status: payload?.status ?? existing.status,
  });
  await db.query(
    `UPDATE jumbaqlar
     SET jumbaq_original = ?, jumbaq_cyrillic = ?, juwap_original = ?, juwap_cyrillic = ?,
         topar = ?, utopar = ?, variant_group = ?, content_hash = ?, status = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      input.jumbaqLatin,
      input.jumbaqCyrillic,
      input.juwapLatin,
      input.juwapCyrillic,
      input.topar,
      input.utopar,
      input.variantGroup,
      hashText(`${num}|${input.jumbaqLatin}|${input.juwapLatin}|${input.topar}|${input.utopar}`),
      input.status,
      num,
    ]
  );
  categoriesCache.clear();
  const [[row]] = await db.query('SELECT * FROM jumbaqlar WHERE id = ?', [num]);
  return mapJumbaq(row, { script: 'latin', includeAnswer: true });
}

export async function deleteJumbaqAdmin(id) {
  const num = Number(id);
  if (!Number.isInteger(num) || num < 1) throw httpError('Jumbaq ID qáte');
  const [[existing]] = await db.query('SELECT id FROM jumbaqlar WHERE id = ? LIMIT 1', [num]);
  if (!existing) throw httpError('Jumbaq tabılmadı', 404);
  await db.query('DELETE FROM jumbaq_progress WHERE jumbaq_id = ?', [num]);
  await db.query('DELETE FROM jumbaqlar WHERE id = ?', [num]);
  categoriesCache.clear();
  return { deleted: true, id: num };
}

export async function getProgressMap(actorId) {
  const [rows] = await db.query(
    `SELECT jumbaq_id AS id, revealed, favorited
     FROM jumbaq_progress WHERE actor_id = ?`,
    [actorId]
  );
  const progress = {};
  for (const row of rows) {
    progress[row.id] = {
      revealed: Boolean(row.revealed),
      favorited: Boolean(row.favorited),
    };
  }
  return { progress, items: progress };
}

export async function upsertProgress(actorId, jumbaqId, patch = {}) {
  const id = Number(jumbaqId);
  if (!Number.isInteger(id) || id < 1) throw httpError('Jumbaq ID qáte');
  if (patch.revealed === undefined && patch.favorited === undefined) {
    throw httpError('revealed yamasa favorited kerek');
  }
  await getJumbaqById(id);

  const [[existing]] = await db.query(
    `SELECT revealed, favorited FROM jumbaq_progress
     WHERE actor_id = ? AND jumbaq_id = ? LIMIT 1`,
    [actorId, id]
  );

  const revealed =
    patch.revealed === undefined
      ? Boolean(existing?.revealed)
      : Boolean(patch.revealed);
  const favorited =
    patch.favorited === undefined
      ? Boolean(existing?.favorited)
      : Boolean(patch.favorited);

  await db.query(
    `INSERT INTO jumbaq_progress (actor_id, jumbaq_id, revealed, favorited)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       revealed = VALUES(revealed),
       favorited = VALUES(favorited),
       updated_at = CURRENT_TIMESTAMP`,
    [actorId, id, revealed ? 1 : 0, favorited ? 1 : 0]
  );

  return { id, revealed, favorited };
}

async function loadJumbaqRow(jumbaqId) {
  const num = Number(jumbaqId);
  if (!Number.isInteger(num) || num < 1) throw httpError('Jumbaq ID qáte');
  const [[row]] = await db.query(
    `SELECT id, jumbaq_original, jumbaq_cyrillic, juwap_original, juwap_cyrillic,
            topar, utopar, status
     FROM jumbaqlar WHERE id = ? AND status = 'published' LIMIT 1`,
    [num]
  );
  if (!row) throw httpError('Jumbaq tabılmadı', 404);
  return row;
}

async function resolveJumbaqDictTitleId(row) {
  try {
    const { resolveDictTitleIdFromQuiz } = await import('./quizDictBridge.js');
    return await resolveDictTitleIdFromQuiz({
      correctAnswer: row.juwap_original || row.juwap_cyrillic,
    });
  } catch {
    return null;
  }
}

/**
 * Sof: jumbaq bank touch strategiyası.
 * reveal + correct → introduce_once (qayta reveal box óspeydi).
 * guess correct/wrong → touch_title (advance + siblings).
 */
export function jumbaqBankTouchKind({ correct, mode = 'guess' } = {}) {
  if (correct && String(mode || 'guess').toLowerCase() === 'reveal') {
    return 'introduce_once';
  }
  return 'touch_title';
}

async function touchJumbaqMistakeBank(
  actorId,
  row,
  { correct, prompt = null, mode = 'guess' } = {}
) {
  if (!actorId) return { touched: false };
  try {
    const {
      introduceLearnedCard,
      touchMistakeBankByDictTitle,
      uniqueKey,
    } = await import('./mistakeBankService.js');
    await ensureJumbaqSourceEnum();
    const dictTitleId = await resolveJumbaqDictTitleId(row);
    const promptText =
      prompt ||
      String(row.jumbaq_original || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 160) ||
      null;
    if (!dictTitleId) return { touched: false, dictTitleId: null };

    const kind = jumbaqBankTouchKind({ correct, mode });

    if (kind === 'introduce_once') {
      const key = uniqueKey({
        actorId,
        source: 'jumbaq',
        questionId: null,
        dictTitleId,
      });
      const [[existing]] = await aiDb.query(
        `SELECT id FROM mistake_bank WHERE unique_key = ? LIMIT 1`,
        [key]
      );
      if (existing) return { touched: false, already: true, dictTitleId };
      const intro = await introduceLearnedCard(actorId, {
        dictTitleId,
        source: 'jumbaq',
        prompt: promptText,
      });
      return {
        touched: Boolean(intro.introduced),
        introduced: Boolean(intro.introduced),
        dictTitleId,
      };
    }

    // Guess correct: advance jumbaq + sibling title rows; wrong: reinforce.
    const result = await touchMistakeBankByDictTitle(actorId, dictTitleId, {
      correct: Boolean(correct),
      prompt: promptText,
      fallbackSource: 'jumbaq',
    });
    return {
      touched: Boolean(result.touched),
      introduced: Boolean(result.introduced),
      dictTitleId,
    };
  } catch (e) {
    console.error('Jumbaq mistake bank:', e.message);
    return { touched: false };
  }
}

let jumbaqSourceEnumReady = false;

export async function ensureJumbaqSourceEnum() {
  if (jumbaqSourceEnumReady) return;
  try {
    await aiDb.query(
      `ALTER TABLE mistake_bank
       MODIFY COLUMN source ENUM('quiz','dict_game','adaptive','reading','crossword','immersion','jumbaq') NOT NULL`
    );
  } catch {
    /* already / no DDL */
  }
  jumbaqSourceEnumReady = true;
}

/**
 * Authed reveal — juwap qaytarıladı + bank seed (dict bridge).
 */
export async function revealJumbaq(actorId, jumbaqId, { script = 'latin' } = {}) {
  const safeScript = normalizeScript(script);
  const row = await loadJumbaqRow(jumbaqId);
  const progress = await upsertProgress(actorId, row.id, { revealed: true });
  const full = mapJumbaq(row, { script: safeScript, includeAnswer: true });
  const bank = await touchJumbaqMistakeBank(actorId, row, {
    correct: true,
    mode: 'reveal',
  });
  return {
    progress,
    juwap: full.juwap,
    answer: full.answer,
    dictTitleId: bank.dictTitleId || null,
  };
}

/**
 * Typed guess — soft produce grade; durıs bolsa reveal + juwap.
 */
export async function guessJumbaq(actorId, jumbaqId, { answer, script = 'latin' } = {}) {
  const safeScript = normalizeScript(script);
  const row = await loadJumbaqRow(jumbaqId);
  const submitted = String(answer ?? '').trim();
  if (!submitted) throw httpError('Juwaptı jazıń', 400);

  const accepted = buildJumbaqAccepted(row);
  const graded = gradeProduceSubmission(accepted, submitted);
  const full = mapJumbaq(row, { script: safeScript, includeAnswer: true });

  if (graded.correct) {
    const progress = await upsertProgress(actorId, row.id, { revealed: true });
    const bank = await touchJumbaqMistakeBank(actorId, row, {
      correct: true,
      mode: 'guess',
    });
    return {
      correct: true,
      nearMiss: graded.nearMiss,
      progress,
      juwap: full.juwap,
      answer: full.answer,
      dictTitleId: bank.dictTitleId || null,
    };
  }

  const bank = await touchJumbaqMistakeBank(actorId, row, {
    correct: false,
    mode: 'guess',
  });
  return {
    correct: false,
    nearMiss: false,
    juwap: null,
    answer: null,
    dictTitleId: bank.dictTitleId || null,
  };
}
