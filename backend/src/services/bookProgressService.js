import crypto from 'crypto';
import { pools } from '../config/db.js';

const db = pools.statistika;

export async function upsertBookProgress(actorId, bookId, progress) {
  const sectionIndex = Math.max(0, Number(progress?.sectionIndex) || 0);
  const paragraphIndex = Math.max(0, Number(progress?.paragraphIndex) || 0);
  const percent = Math.min(100, Math.max(0, Number(progress?.percent) || 0));
  const completed = progress?.completed ? 1 : 0;
  const id = crypto.randomUUID();

  await db.query(
    `INSERT INTO book_progress
     (id, actor_id, book_id, section_index, paragraph_index, percent, completed)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       section_index = VALUES(section_index),
       paragraph_index = VALUES(paragraph_index),
       percent = VALUES(percent),
       completed = VALUES(completed),
       updated_at = CURRENT_TIMESTAMP`,
    [id, actorId, String(bookId), sectionIndex, paragraphIndex, percent, completed]
  );

  return getBookProgress(actorId, bookId);
}

export async function getBookProgress(actorId, bookId) {
  const [[row]] = await db.query(
    `SELECT book_id AS bookId, section_index AS sectionIndex,
            paragraph_index AS paragraphIndex, percent, completed, updated_at AS updatedAt
     FROM book_progress WHERE actor_id = ? AND book_id = ? LIMIT 1`,
    [actorId, String(bookId)]
  );
  return row
    ? {
        ...row,
        completed: Boolean(row.completed),
        percent: Number(row.percent),
      }
    : null;
}

export async function listBookProgress(actorId) {
  const [rows] = await db.query(
    `SELECT book_id AS bookId, section_index AS sectionIndex,
            paragraph_index AS paragraphIndex, percent, completed, updated_at AS updatedAt
     FROM book_progress WHERE actor_id = ? ORDER BY updated_at DESC`,
    [actorId]
  );
  return rows.map((r) => ({
    ...r,
    completed: Boolean(r.completed),
    percent: Number(r.percent),
  }));
}
