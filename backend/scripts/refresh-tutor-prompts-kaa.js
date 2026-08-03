/**
 * Active tutor sessiyalardaǵı eski (ózbeksha) promptlardı jańa quiz kontenti menen almastırıw.
 * node scripts/refresh-tutor-prompts-kaa.js
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const AI = process.env.KK_AI_DB || 'kk_ai_db';
const QUIZ = process.env.KK_QUIZ_DB || 'kk_quiz';

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  charset: 'utf8mb4',
});

const [sessions] = await conn.query(
  `SELECT id, plan_json FROM \`${AI}\`.tutor_sessions WHERE status = 'active'`
);

let updated = 0;
for (const s of sessions) {
  const plan = typeof s.plan_json === 'string' ? JSON.parse(s.plan_json) : s.plan_json;
  if (!plan?.items?.length) continue;
  let changed = false;

  for (const it of plan.items) {
    if (!it.questionId || it.answered) continue;
    const [[q]] = await conn.query(
      `SELECT question, options FROM \`${QUIZ}\`.quiz_questions WHERE id = ? LIMIT 1`,
      [it.questionId]
    );
    if (!q) continue;
    const options = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
    it.prompt = q.question;
    it.options = options;
    if (it.lesson) {
      it.lesson.practice =
        'Varianttı saylap, yadta bekitıń. Juwap mazmunı ashılmaydı.';
      it.lesson.example = `Qayta esleń: ${q.question}`;
      const focus = it.lesson.focus || 'Sóz';
      it.lesson.tip = `${focus}: qısqa qayta kóriw. Durıs varianttı eslew ushın mısaldı oqıń.`;
    }
    changed = true;
  }

  if (changed) {
    await conn.query(`UPDATE \`${AI}\`.tutor_sessions SET plan_json = ? WHERE id = ?`, [
      JSON.stringify(plan),
      s.id,
    ]);
    updated += 1;
  }
}

console.log(`✅ Tutor sessiyalar jańalandı: ${updated}/${sessions.length}`);
await conn.end();
