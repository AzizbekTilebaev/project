import crypto from 'crypto';
import { pools } from '../config/db.js';
import searchFold from '../utils/searchFold.js';
import { gradeProduceSubmission } from '../utils/produceGrade.js';
import { toCyrillic, toLatin } from '../utils/qqScript.js';
import { buildProduceAccepted } from './tutorService.js';

const db = pools.krasvord;

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function parseJson(raw, fallback) {
  if (raw == null) return fallback;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function publicWords(words) {
  return words.map((w, index) => ({
    index,
    clue: w.clue,
    x: Number(w.x),
    y: Number(w.y),
    direction: w.direction,
    length: String(w.answer || '').length,
  }));
}

function toPublicPuzzle(row) {
  const words = parseJson(row.words_json, []);
  return {
    id: row.id,
    title: row.title,
    difficulty: row.difficulty,
    description: row.description,
    config: {
      CrosswordWidth: row.width,
      CrosswordHeight: row.height,
      WordsData: publicWords(words),
    },
  };
}

export async function listCrosswords() {
  const [rows] = await db.query(
    `SELECT id, title, difficulty, description, width, height, words_json
     FROM crosswords WHERE is_published = 1 ORDER BY sort_order, id`
  );
  return rows.map(toPublicPuzzle);
}

export async function getCrosswordPublic(id) {
  const [[row]] = await db.query(
    `SELECT id, title, difficulty, description, width, height, words_json
     FROM crosswords WHERE id = ? AND is_published = 1`,
    [id]
  );
  if (!row) return null;
  return toPublicPuzzle(row);
}

export async function getCrosswordInternal(id) {
  const [[row]] = await db.query(`SELECT * FROM crosswords WHERE id = ?`, [id]);
  if (!row) return null;
  return {
    ...row,
    words: parseJson(row.words_json, []),
  };
}

/**
 * Soft: latin/cyr + searchFold accepted list (jumbaq/produce menen bir xil).
 * Export — unit test.
 */
export function buildCrosswordAccepted(answer) {
  const raw = String(answer || '')
    .trim()
    .replace(/\s+/g, '');
  if (!raw) return [];
  const expanded = [raw, toLatin(raw), toCyrillic(raw)];
  const accepted = [];
  for (const a of expanded) {
    const cleaned = String(a || '')
      .trim()
      .replace(/\s+/g, '');
    if (!cleaned) continue;
    for (const part of buildProduceAccepted(cleaned)) {
      if (part && !accepted.some((x) => searchFold(x) === searchFold(part))) {
        accepted.push(part);
      }
    }
  }
  return accepted;
}

export async function validateGuess(crosswordId, { wordIndex, answer }, { actorId = null } = {}) {
  const puzzle = await getCrosswordInternal(crosswordId);
  if (!puzzle) throw httpError('Krossvord tabılmadı', 404);
  const idx = Number(wordIndex);
  if (!Number.isInteger(idx) || idx < 0 || idx >= puzzle.words.length) {
    throw httpError('Sóз indeksi qáte');
  }
  const expectedRaw = String(puzzle.words[idx].answer || '')
    .trim()
    .replace(/\s+/g, '');
  const given = String(answer || '')
    .trim()
    .replace(/\s+/g, '');
  const accepted = buildCrosswordAccepted(expectedRaw);
  const graded = gradeProduceSubmission(accepted, given);
  const correct = graded.correct;
  const nearMiss = Boolean(graded.nearMiss);
  // Grid fill: puzzle canonical (script/typo mismatchta da length tuwrı).
  const fillAnswer = correct ? expectedRaw.toUpperCase() : null;

  let dictTitleId = null;
  try {
    const { resolveDictTitleIdFromQuiz } = await import('./quizDictBridge.js');
    dictTitleId = await resolveDictTitleIdFromQuiz({
      correctAnswer: expectedRaw,
      question: puzzle.words[idx].clue || '',
    });
  } catch {
    dictTitleId = null;
  }

  if (actorId && dictTitleId) {
    try {
      const { touchMistakeBankByDictTitle } = await import('./mistakeBankService.js');
      await touchMistakeBankByDictTitle(actorId, dictTitleId, {
        correct,
        prompt: puzzle.words[idx].clue || expectedRaw,
        fallbackSource: 'crossword',
      });
    } catch (e) {
      console.error('Mistake bank (crossword):', e.message);
    }
  }

  return {
    correct,
    nearMiss,
    fillAnswer,
    wordIndex: idx,
    length: expectedRaw.length,
    direction: puzzle.words[idx].direction,
    x: puzzle.words[idx].x,
    y: puzzle.words[idx].y,
    dictTitleId: dictTitleId || null,
  };
}

export async function listCrosswordsAdmin({
  q = '',
  difficulty = '',
  published = '',
  page = 1,
  limit = 40,
} = {}) {
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 40));
  const safePage = Math.max(1, Number(page) || 1);
  const offset = (safePage - 1) * safeLimit;
  const where = [];
  const params = [];

  const needle = String(q || '').trim().slice(0, 80);
  if (needle) {
    where.push('(c.id LIKE ? OR c.title LIKE ? OR c.description LIKE ?)');
    const like = `%${needle}%`;
    params.push(like, like, like);
  }
  if (difficulty) {
    where.push('c.difficulty = ?');
    params.push(String(difficulty).trim().slice(0, 64));
  }
  if (published === '1' || published === 'true') {
    where.push('c.is_published = 1');
  } else if (published === '0' || published === 'false') {
    where.push('c.is_published = 0');
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM crosswords c ${whereSql}`,
    params
  );
  const [rows] = await db.query(
    `SELECT c.id, c.title, c.difficulty, c.description, c.width, c.height,
            c.is_published AS isPublished, c.sort_order AS sortOrder, c.created_at AS createdAt,
            COALESCE(JSON_LENGTH(c.words_json), 0) AS wordCount,
            (SELECT COUNT(*) FROM crossword_stats s
              WHERE s.crossword_id = c.id AND s.completed = 1) AS completionCount
     FROM crosswords c
     ${whereSql}
     ORDER BY c.sort_order, c.id
     LIMIT ? OFFSET ?`,
    [...params, safeLimit, offset]
  );
  const totalNum = Number(total) || 0;
  return {
    items: rows.map((r) => ({
      id: r.id,
      title: r.title,
      difficulty: r.difficulty,
      description: r.description,
      width: r.width,
      height: r.height,
      isPublished: Boolean(r.isPublished),
      sortOrder: r.sortOrder,
      createdAt: r.createdAt,
      wordCount: Number(r.wordCount) || 0,
      completionCount: Number(r.completionCount) || 0,
    })),
    total: totalNum,
    page: safePage,
    limit: safeLimit,
    pages: Math.max(1, Math.ceil(totalNum / safeLimit)),
  };
}

export async function getCrosswordAdmin(id) {
  const row = await getCrosswordInternal(id);
  if (!row) return null;
  const [[{ completionCount }]] = await db.query(
    `SELECT COUNT(*) AS completionCount FROM crossword_stats
     WHERE crossword_id = ? AND completed = 1`,
    [String(id)]
  );
  return {
    id: row.id,
    title: row.title,
    difficulty: row.difficulty,
    description: row.description,
    width: row.width,
    height: row.height,
    words: row.words,
    isPublished: Boolean(row.is_published),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    wordCount: Array.isArray(row.words) ? row.words.length : 0,
    completionCount: Number(completionCount) || 0,
  };
}

function validateCustomId(raw) {
  const id = String(raw || '')
    .trim()
    .toLowerCase();
  if (!id) return '';
  if (!/^[a-z0-9-]{1,32}$/.test(id)) {
    throw httpError('ID tek hárip, san hám defisten ibarat bolıwı kerek (max 32)');
  }
  return id;
}

function normalizeWords(words) {
  if (!Array.isArray(words) || !words.length) throw httpError('Sozler kerek');
  for (const w of words) {
    if (!w.answer || !w.clue || w.x == null || w.y == null || !w.direction) {
      throw httpError('Harbir sozde answer, clue, x, y, direction kerek');
    }
  }
  return words;
}

export async function upsertCrossword(payload, { id: forcedId } = {}) {
  const title = String(payload?.title || '').trim();
  if (!title) throw httpError('At kerek');

  const hasWordsPayload =
    payload?.words !== undefined || payload?.config?.WordsData !== undefined;
  const rawWords = hasWordsPayload
    ? Array.isArray(payload?.words)
      ? payload.words
      : payload?.config?.WordsData
    : null;

  const difficulty = String(payload?.difficulty || 'Ápiwayı').slice(0, 64);
  const description = String(payload?.description || '').slice(0, 2000);
  const isPublished = payload?.isPublished === false ? 0 : 1;
  const sortOrder = Number(payload?.sortOrder) || 0;

  if (forcedId) {
    const existing = await getCrosswordAdmin(forcedId);
    if (!existing) throw httpError('Krossvord tabılmadı', 404);

    if (hasWordsPayload) {
      if (existing.completionCount > 0) {
        throw httpError(
          'Bul krossvordta tamamlanıwlar bar — meta/nashr/tártip ózgertiliwi múmkin, biraq sózlerdi ózgertip bolmaydı',
          409
        );
      }
      const words = normalizeWords(rawWords);
      const width = Number(payload?.width ?? payload?.config?.CrosswordWidth);
      const height = Number(payload?.height ?? payload?.config?.CrosswordHeight);
      if (!width || !height) throw httpError('Kenlik/biyiklik kerek');
      await db.query(
        `UPDATE crosswords
         SET title = ?, difficulty = ?, description = ?, width = ?, height = ?,
             words_json = ?, is_published = ?, sort_order = ?
         WHERE id = ?`,
        [
          title,
          difficulty,
          description,
          width,
          height,
          JSON.stringify(words),
          isPublished,
          sortOrder,
          existing.id,
        ]
      );
    } else {
      await db.query(
        `UPDATE crosswords
         SET title = ?, difficulty = ?, description = ?, is_published = ?, sort_order = ?
         WHERE id = ?`,
        [title, difficulty, description, isPublished, sortOrder, existing.id]
      );
    }
    return getCrosswordAdmin(existing.id);
  }

  const words = normalizeWords(rawWords);
  const width = Number(payload?.width ?? payload?.config?.CrosswordWidth);
  const height = Number(payload?.height ?? payload?.config?.CrosswordHeight);
  if (!width || !height) throw httpError('Kenlik/biyiklik kerek');

  const customId = validateCustomId(payload?.id);
  const id = customId || `cw-${crypto.randomBytes(4).toString('hex')}`;
  if (customId) {
    const [[dup]] = await db.query('SELECT id FROM crosswords WHERE id = ?', [id]);
    if (dup) throw httpError('Bul ID band', 409);
  }

  await db.query(
    `INSERT INTO crosswords
     (id, title, difficulty, description, width, height, words_json, is_published, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, title, difficulty, description, width, height, JSON.stringify(words), isPublished, sortOrder]
  );
  return getCrosswordAdmin(id);
}

export async function deleteCrossword(id) {
  const existing = await getCrosswordAdmin(id);
  if (!existing) throw httpError('Krossvord tabılmadı', 404);
  await db.query(`DELETE FROM crosswords WHERE id = ?`, [existing.id]);
  return {
    deleted: true,
    id: existing.id,
    removedCompletions: existing.completionCount || 0,
  };
}

export async function recordSoloCompletion(actorId, crosswordId, { seconds = null, score = null } = {}) {
  await db.query(
    `INSERT INTO crossword_stats
     (id, actor_id, crossword_id, mode, room_id, score, duration_seconds, completed)
     VALUES (?, ?, ?, 'solo', NULL, ?, ?, 1)`,
    [crypto.randomUUID(), actorId, String(crosswordId), score, seconds]
  );
}

export async function listCrosswordStatsForActor(actorId, limit = 40) {
  const safe = Math.min(Math.max(Number(limit) || 40, 1), 100);
  const [rows] = await db.query(
    `SELECT s.id, s.crossword_id AS crosswordId, s.mode, s.score,
            s.duration_seconds AS durationSeconds, s.completed, s.created_at AS createdAt,
            c.title
     FROM crossword_stats s
     LEFT JOIN crosswords c ON c.id = s.crossword_id
     WHERE s.actor_id = ?
     ORDER BY s.created_at DESC
     LIMIT ${safe}`,
    [actorId]
  );
  return rows;
}
