/**
 * Quiz DB kontentin to‘liq qaraqalpaq latinǵa awdarıw / tolıqtırıw.
 * Paydalanıw: node scripts/localize-quiz-kaa.js
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import { SEED_QUIZZES_KAA } from './quiz-seed-kaa.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function upsertQuiz(conn, quiz, sortOrder) {
  await conn.query(
    `INSERT INTO quizzes (id, title, description, level, category, time_mode, time_limit_seconds, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       title = VALUES(title),
       description = VALUES(description),
       level = VALUES(level),
       category = VALUES(category),
       time_mode = VALUES(time_mode),
       time_limit_seconds = VALUES(time_limit_seconds),
       sort_order = VALUES(sort_order)`,
    [
      quiz.id,
      quiz.title,
      quiz.description || null,
      quiz.level || null,
      quiz.category || null,
      quiz.timeMode || 'untimed',
      quiz.timeLimitSeconds ?? null,
      sortOrder,
    ]
  );

  const [existing] = await conn.query(
    `SELECT id FROM quiz_questions WHERE quiz_id = ? ORDER BY sort_order, id`,
    [quiz.id]
  );

  for (let i = 0; i < quiz.questions.length; i++) {
    const item = quiz.questions[i];
    const row = existing[i];
    if (row) {
      await conn.query(
        `UPDATE quiz_questions
         SET question = ?, options = ?, correct_answer = ?,
             time_limit_seconds = ?, sort_order = ?
         WHERE id = ?`,
        [
          item.question,
          JSON.stringify(item.options),
          item.correctAnswer,
          item.timeLimitSeconds ?? null,
          i,
          row.id,
        ]
      );
    } else {
      await conn.query(
        `INSERT INTO quiz_questions (quiz_id, question, options, correct_answer, time_limit_seconds, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          quiz.id,
          item.question,
          JSON.stringify(item.options),
          item.correctAnswer,
          item.timeLimitSeconds ?? null,
          i,
        ]
      );
    }
  }

  if (existing.length > quiz.questions.length) {
    const extraIds = existing.slice(quiz.questions.length).map((r) => r.id);
    await conn.query(`DELETE FROM quiz_questions WHERE id IN (?)`, [extraIds]);
  }
}

async function updateDatabase(database) {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database,
    charset: 'utf8mb4',
  });

  try {
    const [[{ m }]] = await conn.query(`SELECT COALESCE(MAX(id), 0) AS m FROM quiz_questions`);
    await conn.query(`ALTER TABLE quiz_questions AUTO_INCREMENT = ?`, [Number(m) + 1]);

    for (let i = 0; i < SEED_QUIZZES_KAA.length; i++) {
      await upsertQuiz(conn, SEED_QUIZZES_KAA[i], i);
      console.log(`✅ ${database}: ${SEED_QUIZZES_KAA[i].title}`);
    }
  } finally {
    await conn.end();
  }
}

const targets = [process.env.KK_QUIZ_DB || 'kk_quiz'];

for (const db of targets) {
  try {
    await updateDatabase(db);
  } catch (err) {
    console.warn(`⚠️  ${db}: ${err.message}`);
  }
}

console.log('✅ Quiz kontenti qaraqalpaqsha jańalandı / tolıqtırıldı.');
