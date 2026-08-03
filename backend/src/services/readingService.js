import crypto from 'crypto';
import { pools, DB } from '../config/db.js';
import { searchFold, sourceWords } from '../utils/textTokens.js';
import { toCyrillic, toLatin } from '../utils/qqScript.js';

// Uy bazasi: kk_poetrys (books, sections, pieces, lessons).
// reading_sessions → kk_statistika, literature_tutor_events → kk_ai,
// writers/book_writers → kk_poets, dictionary → kk_tusindirme.
const db = pools.poetrys;
const dictionaryDb = pools.tusindirme;
import {
  buildReadingLesson,
  gradeReadingSubmission,
  READING_ENGINE,
  stripLessonSecrets,
} from './readingLessonEngine.js';

function httpError(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

function parseJson(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/** Local readingLessonSrs.js menen birdey. */
export const READING_LESSON_BOX_HOURS = [0, 24, 72, 168, 336, 720];
const WEAK_RATIO = 0.7;
let readingLessonSrsReady = false;

/** Sof: tamamnan keyingi box. */
export function nextBoxAfterLessonComplete({
  prevBox = null,
  score = 0,
  total = 0,
} = {}) {
  const maxBox = READING_LESSON_BOX_HOURS.length - 1;
  if (prevBox == null || !Number.isFinite(Number(prevBox))) {
    return 1;
  }
  const totalN = Math.max(0, Number(total) || 0);
  const scoreN = Math.max(0, Number(score) || 0);
  const weak = totalN > 0 && scoreN / totalN < WEAK_RATIO;
  const cur = Math.max(0, Math.min(maxBox, Number(prevBox)));
  if (weak) return Math.max(1, cur - 1);
  return Math.min(maxBox, cur + 1);
}

export function dueHoursFromBox(box) {
  const idx = Math.max(
    0,
    Math.min(Number(box) || 0, READING_LESSON_BOX_HOURS.length - 1)
  );
  return READING_LESSON_BOX_HOURS[idx] ?? 24;
}

export function publicReadingLessonSrsRow(row) {
  if (!row) return null;
  const dueRaw = row.due_at ?? row.dueAt;
  const doneRaw = row.last_completed_at ?? row.lastCompletedAt;
  return {
    bookId: String(row.book_id ?? row.bookId ?? ''),
    sectionIndex: Number(row.section_index ?? row.sectionIndex ?? 0) || 0,
    box: Math.max(0, Number(row.box) || 0),
    dueAt: dueRaw ? new Date(dueRaw).getTime() : 0,
    lastCompletedAt: doneRaw ? new Date(doneRaw).getTime() : 0,
    lastScore: Number(row.last_score ?? row.lastScore) || 0,
    lastTotal: Number(row.last_total ?? row.lastTotal) || 0,
  };
}

async function ensureReadingLessonSrsTable() {
  if (readingLessonSrsReady) return;
  try {
    await pools.statistika.query(`
      CREATE TABLE IF NOT EXISTS reading_lesson_srs (
        id CHAR(36) NOT NULL,
        actor_id BIGINT UNSIGNED NOT NULL,
        book_id VARCHAR(64) NOT NULL,
        section_index INT NOT NULL DEFAULT 0,
        box TINYINT NOT NULL DEFAULT 1,
        due_at DATETIME NOT NULL,
        last_completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_score INT NOT NULL DEFAULT 0,
        last_total INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_reading_lesson_srs_actor_section (actor_id, book_id, section_index),
        KEY idx_reading_lesson_srs_due (actor_id, due_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    readingLessonSrsReady = true;
  } catch (e) {
    console.error('reading_lesson_srs ensure:', e.message);
  }
}

export async function upsertReadingLessonSrs(
  actorId,
  { bookId, sectionIndex, score = 0, total = 0 } = {}
) {
  const id = String(bookId || '').trim();
  const sec = Number(sectionIndex) || 0;
  if (!actorId || !id) return null;
  await ensureReadingLessonSrsTable();

  const [[existing]] = await pools.statistika.query(
    `SELECT id, box FROM ${DB.statistika}.reading_lesson_srs
     WHERE actor_id = ? AND book_id = ? AND section_index = ? LIMIT 1`,
    [actorId, id, sec]
  );
  const box = nextBoxAfterLessonComplete({
    prevBox: existing ? Number(existing.box) : null,
    score,
    total,
  });
  const hours = dueHoursFromBox(box);
  const rowId = existing?.id || crypto.randomUUID();

  await pools.statistika.query(
    `INSERT INTO ${DB.statistika}.reading_lesson_srs
     (id, actor_id, book_id, section_index, box, due_at, last_completed_at, last_score, last_total)
     VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR), NOW(), ?, ?)
     ON DUPLICATE KEY UPDATE
       box = VALUES(box),
       due_at = VALUES(due_at),
       last_completed_at = VALUES(last_completed_at),
       last_score = VALUES(last_score),
       last_total = VALUES(last_total)`,
    [rowId, actorId, id, sec, box, hours, Number(score) || 0, Number(total) || 0]
  );

  const [[row]] = await pools.statistika.query(
    `SELECT * FROM ${DB.statistika}.reading_lesson_srs
     WHERE actor_id = ? AND book_id = ? AND section_index = ? LIMIT 1`,
    [actorId, id, sec]
  );
  return publicReadingLessonSrsRow(row);
}

export async function listReadingLessonSrs(actorId, { limit = 40 } = {}) {
  if (!actorId) return [];
  await ensureReadingLessonSrsTable();
  const safe = Math.min(Math.max(Number(limit) || 40, 1), 80);
  const [rows] = await pools.statistika.query(
    `SELECT * FROM ${DB.statistika}.reading_lesson_srs
     WHERE actor_id = ?
     ORDER BY due_at ASC
     LIMIT ${safe}`,
    [actorId]
  );
  return (rows || []).map(publicReadingLessonSrsRow).filter((r) => r?.bookId);
}

async function getReadingLessonSrsEntry(actorId, bookId, sectionIndex) {
  await ensureReadingLessonSrsTable();
  const [[row]] = await pools.statistika.query(
    `SELECT * FROM ${DB.statistika}.reading_lesson_srs
     WHERE actor_id = ? AND book_id = ? AND section_index = ? LIMIT 1`,
    [actorId, String(bookId), Number(sectionIndex) || 0]
  );
  return publicReadingLessonSrsRow(row);
}

async function getSection(bookId, sectionIndex) {
  const index = Number(sectionIndex);
  if (!Number.isInteger(index) || index < 0) throw httpError('Bólim indeksi qáte');
  const [[row]] = await db.query(
    `SELECT b.id AS bookId, b.title AS bookTitle, b.author,
            s.id AS sectionId, s.title AS sectionTitle, s.paragraphs_json AS paragraphsJson
     FROM books b
     JOIN book_sections s ON s.book_id = b.id
     WHERE b.id = ? AND s.sort_order = ?
     LIMIT 1`,
    [String(bookId), index]
  );
  if (!row) throw httpError('Kitap bólimi tabılmadı', 404);
  const paragraphs = parseJson(row.paragraphsJson, []);
  if (!Array.isArray(paragraphs) || !paragraphs.length) {
    throw httpError('Bul bólimde tekst joq', 422);
  }
  return { ...row, sectionIndex: index, paragraphs };
}

async function getWriterContext(section) {
  const attempts = [
    [
      `SELECT w.poet_name_original AS name, w.biography_plain_original AS bio
       FROM ${DB.poets}.literature_writers w
       JOIN ${DB.poets}.book_writers bw ON bw.writer_id = w.id
       WHERE bw.book_id = ? LIMIT 1`,
      [section.bookId],
    ],
    [
      `SELECT w.poet_name_original AS name, w.biography_plain_original AS bio
       FROM ${DB.poets}.literature_writers w
       JOIN literature_pieces p ON p.writer_id = w.id
       WHERE p.book_id = ? LIMIT 1`,
      [section.bookId],
    ],
    [
      `SELECT poet_name_original AS name, biography_plain_original AS bio
       FROM ${DB.poets}.literature_writers
       WHERE poet_name_original = ? OR poet_name_latin = ? LIMIT 1`,
      [section.author, section.author],
    ],
  ];
  for (const [sql, params] of attempts) {
    try {
      const [[writer]] = await db.query(sql, params);
      if (writer) return writer;
    } catch {
      // Imported literature tables can differ between deployments.
    }
  }
  return null;
}

async function getDictionaryEntries(paragraphs) {
  const rawWords = sourceWords(paragraphs.join(' '))
    .filter((word) => word.length >= 3)
    .slice(0, 80);
  if (!rawWords.length) return [];

  // Latin tekst ↔ Cyrillic sózlik: hár sózdiń script variantları
  const words = [
    ...new Set(
      rawWords.flatMap((word) =>
        [word, toCyrillic(word), toLatin(word)]
          .map((w) => String(w || '').trim())
          .filter((w) => w.length >= 3)
      )
    ),
  ].slice(0, 120);

  // Anıq sáykeslik yamasa uzın (5+) sózdiń morfologiyalıq baslanıwı ǵana qabıl etiledi,
  // sebebi qısqa prefiksler ("дә", "кост") qáte sózlik jazıwların tartıp keledi.
  const sourceMatches = words
    .map(() => `(t.soz = ? OR (CHAR_LENGTH(t.soz) >= 5 AND ? LIKE CONCAT(t.soz, '%')))`)
    .join(' OR ');
  const matchParams = words.flatMap((word) => [word, word]);
  try {
    const [rows] = await dictionaryDb.query(
      `SELECT t.id, t.soz AS title,
              (SELECT d.description FROM description d
               WHERE d.titles_id = t.id ORDER BY d.sort_order LIMIT 1) AS description,
              (SELECT e.example FROM description d
               JOIN examples e ON e.descriptions_id = d.id
               WHERE d.titles_id = t.id AND e.is_approved = 1
               ORDER BY d.sort_order, e.sort_order LIMIT 1) AS example
       FROM titles t
       WHERE t.status = 1 AND CHAR_LENGTH(TRIM(t.soz)) >= 3 AND (${sourceMatches})
       ORDER BY CHAR_LENGTH(t.soz) DESC
       LIMIT 60`,
      matchParams
    );
    return rows.filter((row) => String(row.description || '').trim().length >= 8);
  } catch {
    return [];
  }
}

async function loadSavedLesson(bookId, sectionIndex) {
  const [[row]] = await db.query(
    `SELECT id, engine, lesson_json AS lessonJson, updated_at AS updatedAt
     FROM book_lessons WHERE book_id = ? AND section_index = ? LIMIT 1`,
    [String(bookId), Number(sectionIndex)]
  );
  if (!row) return null;
  const storedEngine = row.engine || '';
  // Eski engine (v1) — jańadan dúziladi
  if (storedEngine && storedEngine !== READING_ENGINE) return null;
  const lesson = parseJson(row.lessonJson);
  if (!lesson) return null;
  if (lesson.engine && lesson.engine !== READING_ENGINE) return null;
  return { ...lesson, id: row.id, engine: row.engine || lesson.engine || READING_ENGINE };
}

async function generateLesson(bookId, sectionIndex) {
  const section = await getSection(bookId, sectionIndex);
  const [dictionaryEntries, writer] = await Promise.all([
    getDictionaryEntries(section.paragraphs),
    getWriterContext(section),
  ]);
  return buildReadingLesson({
    bookId: section.bookId,
    sectionIndex: section.sectionIndex,
    sectionTitle: section.sectionTitle,
    paragraphs: section.paragraphs,
    dictionaryEntries,
    writer,
  });
}

export async function getLessonPreview(bookId, sectionIndex) {
  const lesson = (await loadSavedLesson(bookId, sectionIndex)) ||
    (await generateLesson(bookId, sectionIndex));
  const preview = stripLessonSecrets(lesson);
  delete preview.questions;
  return preview;
}

export async function createReadingSession(actorId, { bookId, sectionIndex = 0 }) {
  const lesson = (await loadSavedLesson(bookId, sectionIndex)) ||
    (await generateLesson(bookId, sectionIndex));
  if (!lesson.questions?.length) throw httpError('Bul bólim ushın soraw dúzilmedi', 422);
  const id = crypto.randomUUID();
  const plan = {
    lesson: {
      ...lesson,
      questions: lesson.questions.map((question) => ({
        ...question,
        answered: false,
        correct: null,
      })),
    },
  };
  await db.query(
    `INSERT INTO ${DB.statistika}.reading_sessions
       (id, actor_id, book_id, section_index, plan_json, status, score, total)
     VALUES (?, ?, ?, ?, ?, 'active', 0, ?)`,
    [id, actorId, String(bookId), Number(sectionIndex), JSON.stringify(plan), lesson.questions.length]
  );
  await recordTutorEvent(actorId, 'reading_started', {
    sessionId: id,
    bookId: String(bookId),
    sectionIndex: Number(sectionIndex),
  });
  return publicSession({
    id,
    actor_id: actorId,
    book_id: String(bookId),
    section_index: Number(sectionIndex),
    plan_json: plan,
    status: 'active',
    score: 0,
    total: lesson.questions.length,
  });
}

function publicSession(row) {
  const plan = parseJson(row.plan_json, { lesson: { questions: [] } });
  return stripLessonSecrets({
    id: row.id,
    bookId: row.book_id,
    sectionIndex: Number(row.section_index),
    status: row.status,
    score: Number(row.score || 0),
    total: Number(row.total || 0),
    completedAt: row.completed_at || null,
    lesson: plan.lesson,
  });
}

export async function getReadingSession(actorId, sessionId) {
  const [[row]] = await db.query(
    `SELECT * FROM ${DB.statistika}.reading_sessions WHERE id = ? AND actor_id = ? LIMIT 1`,
    [String(sessionId), actorId]
  );
  if (!row) throw httpError('Oqıw sessiyası tabılmadı', 404);
  return publicSession(row);
}

export async function answerReadingQuestion(actorId, sessionId, { questionId, answer }) {
  const [[row]] = await db.query(
    `SELECT * FROM ${DB.statistika}.reading_sessions WHERE id = ? AND actor_id = ? LIMIT 1`,
    [String(sessionId), actorId]
  );
  if (!row) throw httpError('Oqıw sessiyası tabılmadı', 404);
  if (row.status !== 'active') throw httpError('Sessiya aktiv emes', 409);
  const plan = parseJson(row.plan_json, { lesson: { questions: [] } });
  const question = plan.lesson?.questions?.find((item) => String(item.id) === String(questionId));
  if (!question) throw httpError('Soraw tabılmadı', 404);
  if (question.answered) throw httpError('Sorawǵa juwap berilgen', 409);

  const graded = gradeReadingSubmission(question, answer);
  const correct = graded.correct;
  const nearMiss = graded.nearMiss;
  question.answered = true;
  question.correct = correct;
  const questions = plan.lesson.questions;
  const score = questions.filter((item) => item.correct === true).length;
  const allAnswered = questions.every((item) => item.answered);
  const status = allAnswered ? 'answered' : 'active';
  await db.query(
    `UPDATE ${DB.statistika}.reading_sessions SET plan_json = ?, score = ?, status = ? WHERE id = ?`,
    [JSON.stringify(plan), score, status, row.id]
  );
  await recordTutorEvent(actorId, 'reading_answered', {
    sessionId: row.id,
    questionId: String(questionId),
    correct,
  });

  try {
    const dictTitleId = resolveDictTitleIdFromQuestion(plan.lesson, question);
    const touch = readingMistakeBankTouchFromAnswer({
      correct,
      dictTitleId,
      prompt: question.prompt || null,
    });
    if (touch) {
      const { touchMistakeBankByDictTitle } = await import('./mistakeBankService.js');
      await touchMistakeBankByDictTitle(actorId, touch.dictTitleId, {
        correct: touch.correct,
        prompt: touch.prompt,
        fallbackSource: touch.fallbackSource,
      });
    }
  } catch (e) {
    console.error('Mistake bank (reading):', e.message);
  }

  return { correct, nearMiss, score, status };
}

/** Juwap → mistake_bank touch args (DB joq). null = bridge joq. */
export function readingMistakeBankTouchFromAnswer({ correct, dictTitleId, prompt } = {}) {
  const id = dictTitleId != null ? String(dictTitleId).trim() : '';
  if (!id) return null;
  return {
    dictTitleId: id,
    correct: Boolean(correct),
    prompt: prompt || null,
    fallbackSource: 'reading',
  };
}

export function resolveDictTitleIdFromQuestion(lesson, question) {
  if (question?.meta?.dictTitleId) return String(question.meta.dictTitleId);
  const vocab = Array.isArray(lesson?.vocabulary) ? lesson.vocabulary : [];
  const answer = question?.meta?.answer;
  if (!answer) return null;
  const hit = vocab.find((item) => searchFold(item.word) === searchFold(answer));
  return hit?.id || null;
}

export function buildPracticePayload(lesson, questions) {
  const vocab = Array.isArray(lesson?.vocabulary) ? lesson.vocabulary : [];
  const vocabIds = vocab.map((item) => item.id).filter(Boolean).map(String);
  const missedIds = [];
  for (const q of questions) {
    if (q.correct !== false) continue;
    const id = resolveDictTitleIdFromQuestion(lesson, q);
    if (id) missedIds.push(String(id));
  }
  const titleIds = [...new Set([...missedIds, ...vocabIds])].slice(0, 40);
  return {
    titleIds,
    missedIds: [...new Set(missedIds)],
    vocabCount: vocabIds.length,
  };
}

export async function completeReadingSession(actorId, sessionId) {
  const [[row]] = await db.query(
    `SELECT * FROM ${DB.statistika}.reading_sessions WHERE id = ? AND actor_id = ? LIMIT 1`,
    [String(sessionId), actorId]
  );
  if (!row) throw httpError('Oqıw sessiyası tabılmadı', 404);
  const plan = parseJson(row.plan_json, { lesson: { questions: [] } });
  const questions = plan.lesson?.questions || [];
  if (!questions.length || questions.some((item) => !item.answered)) {
    throw httpError('Barlıq sorawlarǵa juwap beriń', 409);
  }
  const score = questions.filter((item) => item.correct === true).length;
  const total = questions.length;
  const practice = buildPracticePayload(plan.lesson, questions);

  // Idempotent: ekinshi complete — box qayta óspeydi
  if (row.status === 'completed') {
    let srs = null;
    try {
      srs = await getReadingLessonSrsEntry(actorId, row.book_id, row.section_index);
    } catch (e) {
      console.error('Reading lesson SRS read:', e.message);
    }
    return {
      correct: score === total,
      score,
      total,
      status: 'completed',
      practice,
      srs,
      alreadyCompleted: true,
    };
  }

  await db.query(
    `UPDATE ${DB.statistika}.reading_sessions
     SET status = 'completed', score = ?, completed_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [score, row.id]
  );

  let srs = null;
  try {
    srs = await upsertReadingLessonSrs(actorId, {
      bookId: row.book_id,
      sectionIndex: row.section_index,
      score,
      total,
    });
  } catch (e) {
    console.error('Reading lesson SRS upsert:', e.message);
  }

  await recordTutorEvent(actorId, 'reading_completed', {
    sessionId: row.id,
    score,
    total,
    practiceTitleIds: practice.titleIds,
  });
  return {
    correct: score === total,
    score,
    total,
    status: 'completed',
    practice,
    srs,
  };
}

export async function getReadingProgress(actorId) {
  const [rows] = await db.query(
    `SELECT book_id AS bookId,
            COUNT(*) AS sessions,
            SUM(status = 'completed') AS completed,
            COALESCE(SUM(score), 0) AS score,
            COALESCE(SUM(total), 0) AS total,
            MAX(created_at) AS lastReadAt
     FROM ${DB.statistika}.reading_sessions
     WHERE actor_id = ?
     GROUP BY book_id
     ORDER BY lastReadAt DESC`,
    [actorId]
  );
  return rows.map((row) => ({
    ...row,
    sessions: Number(row.sessions),
    completed: Number(row.completed),
    score: Number(row.score),
    total: Number(row.total),
  }));
}

async function recordTutorEvent(actorId, eventType, payload) {
  try {
    await db.query(
      `INSERT INTO ${DB.ai}.literature_tutor_events (id, actor_id, event_type, payload_json)
       VALUES (?, ?, ?, ?)`,
      [crypto.randomUUID(), actorId, eventType, JSON.stringify(payload)]
    );
  } catch {
    // Analytics must never block a lesson.
  }
}

export async function listAdminLessons() {
  const [rows] = await db.query(
    `SELECT bl.id, bl.book_id AS bookId, bl.section_index AS sectionIndex, bl.engine,
            bl.lesson_json AS lessonJson, bl.created_at AS createdAt, bl.updated_at AS updatedAt,
            b.title AS bookTitle, s.title AS sectionTitle
     FROM book_lessons bl
     LEFT JOIN books b ON b.id = bl.book_id
     LEFT JOIN book_sections s ON s.book_id = bl.book_id AND s.sort_order = bl.section_index
     ORDER BY bl.updated_at DESC`
  );
  return rows.map((row) => ({
    id: row.id,
    bookId: row.bookId,
    sectionIndex: row.sectionIndex,
    engine: row.engine,
    bookTitle: row.bookTitle || null,
    sectionTitle: row.sectionTitle || null,
    lesson: parseJson(row.lessonJson, {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    questionCount: Array.isArray(parseJson(row.lessonJson, {})?.questions)
      ? parseJson(row.lessonJson, {}).questions.length
      : 0,
  }));
}

/** Admin: kitap bólimleri (dars pin ushın). */
export async function listAdminBookSections(bookId) {
  const id = String(bookId || '').trim();
  if (!id) throw httpError('bookId kerek');
  const [[book]] = await db.query(
    `SELECT id, title, author FROM books WHERE id = ? LIMIT 1`,
    [id]
  );
  if (!book) throw httpError('Kitap tabılmadı', 404);
  const [rows] = await db.query(
    `SELECT sort_order AS sectionIndex, title AS sectionTitle,
            CHAR_LENGTH(paragraphs_json) AS approxSize
     FROM book_sections
     WHERE book_id = ?
     ORDER BY sort_order ASC`,
    [id]
  );
  return {
    book: { id: book.id, title: book.title, author: book.author },
    sections: rows.map((r) => ({
      sectionIndex: Number(r.sectionIndex) || 0,
      sectionTitle: r.sectionTitle || '',
      hasText: Number(r.approxSize) > 4,
    })),
  };
}

/**
 * Tolıq dars JSON (meta/accepted menen) — pin/redaktorlaw ushın.
 * force=false: saqlanǵan pin bolsa onı qaytaradı.
 */
export async function generateAdminLesson({
  bookId,
  sectionIndex = 0,
  force = false,
} = {}) {
  const id = String(bookId || '').trim();
  if (!id) throw httpError('bookId kerek');
  const idx = Number(sectionIndex);
  if (!Number.isInteger(idx) || idx < 0) throw httpError('sectionIndex qáte');

  if (!force) {
    const saved = await loadSavedLesson(id, idx);
    if (saved) {
      return {
        ...saved,
        pinned: true,
        bookId: id,
        sectionIndex: idx,
      };
    }
  }

  const lesson = await generateLesson(id, idx);
  const [[pin]] = await db.query(
    `SELECT id FROM book_lessons WHERE book_id = ? AND section_index = ? LIMIT 1`,
    [id, idx]
  );
  return {
    ...lesson,
    id: pin?.id || null,
    pinned: false,
    bookId: id,
    sectionIndex: idx,
  };
}

export async function saveAdminLesson({ id, bookId, sectionIndex, lesson }) {
  if (!lesson || typeof lesson !== 'object') {
    throw httpError('lesson obyekti kerek');
  }
  const questions = Array.isArray(lesson.questions) ? lesson.questions : [];
  if (!questions.length) throw httpError('Keminde 1 soraw kerek');

  const safeLesson = {
    ...lesson,
    engine: READING_ENGINE,
    source: {
      ...(lesson.source || {}),
      bookId: String(bookId),
      sectionIndex: Number(sectionIndex),
    },
  };
  delete safeLesson.pinned;
  delete safeLesson.id;

  await getSection(bookId, sectionIndex);

  const [[existing]] = await db.query(
    `SELECT id FROM book_lessons WHERE book_id = ? AND section_index = ? LIMIT 1`,
    [String(bookId), Number(sectionIndex)]
  );
  const lessonId = String(existing?.id || id || crypto.randomUUID());

  if (existing) {
    await db.query(
      `UPDATE book_lessons
       SET engine = ?, lesson_json = ?, updated_at = CURRENT_TIMESTAMP
       WHERE book_id = ? AND section_index = ?`,
      [READING_ENGINE, JSON.stringify(safeLesson), String(bookId), Number(sectionIndex)]
    );
  } else {
    await db.query(
      `INSERT INTO book_lessons (id, book_id, section_index, engine, lesson_json)
       VALUES (?, ?, ?, ?, ?)`,
      [lessonId, String(bookId), Number(sectionIndex), READING_ENGINE, JSON.stringify(safeLesson)]
    );
  }
  return {
    id: lessonId,
    bookId: String(bookId),
    sectionIndex: Number(sectionIndex),
    ...safeLesson,
  };
}

export async function deleteAdminLesson(id) {
  const [result] = await db.query('DELETE FROM book_lessons WHERE id = ?', [String(id)]);
  if (!result.affectedRows) throw httpError('Dars tabılmadı', 404);
  return { id: String(id) };
}
