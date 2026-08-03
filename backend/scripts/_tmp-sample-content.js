import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const host = process.env.DB_HOST || '127.0.0.1';
const user = process.env.DB_USER || 'root';
const password = process.env.DB_PASS || '';

async function sample(db, sql) {
  try {
    const c = await mysql.createConnection({
      host,
      user,
      password,
      database: db,
      charset: 'utf8mb4',
    });
    const [rows] = await c.query(sql);
    console.log('---', db, '---');
    console.log(JSON.stringify(rows, null, 2).slice(0, 1500));
    await c.end();
  } catch (e) {
    console.log(db, 'ERR', e.message);
  }
}

await sample(
  process.env.KK_JUMBAQLAR_DB || 'kk_jumbaqlar',
  'SELECT id, LEFT(jumbaq, 100) AS j, juwap FROM jumbaqlar LIMIT 3'
);
await sample(
  process.env.KK_POETS_DB || 'kk_poets',
  'SELECT id, name, LEFT(biography, 120) AS b FROM writers LIMIT 2'
);

// books may live in poets or quiz-related DB depending on setup
for (const db of [
  process.env.KK_POETRYS_DB || 'kk_poetrys',
  process.env.KK_QUIZ_DB || 'kk_quiz',
  'quiz_db',
]) {
  await sample(db, 'SHOW TABLES LIKE "%book%"');
  await sample(db, 'SELECT id, title, author FROM books LIMIT 3').catch?.();
}
