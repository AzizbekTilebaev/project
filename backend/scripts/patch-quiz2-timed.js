import db from '../src/config/quiz.db.js';

await db.query(
  `UPDATE quizzes SET time_mode = 'timed', time_limit_seconds = 180 WHERE id = '2'`
);
await db.query(`UPDATE quiz_questions SET time_limit_seconds = 60 WHERE quiz_id = '2'`);
console.log('✅ Quiz 2 timed qilindi');
await db.end();
