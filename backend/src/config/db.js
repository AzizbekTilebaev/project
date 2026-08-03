/**
 * Markaziy MySQL ulanish qatlami — 10 ta domen bazasi.
 *
 * Har domen o‘z bazasiga ega (kk_users, kk_poets, ...). Barcha bazalar bitta
 * MySQL serverida turadi, shuning uchun bazalararo FOREIGN KEY ishlamaydi
 * (app darajasida ta’minlanadi), lekin bazalararo JOIN to‘liq nom bilan
 * (masalan `kk_users.anonymous_actors`) ishlaydi.
 *
 * Har servis o‘z "uy" poolidan foydalanadi; boshqa bazadagi jadvalga
 * murojaat qilganda DB konstantasini prefiks qilib yozadi.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Baza nomlari (env orqali override qilinishi mumkin)
export const DB = {
  users: process.env.KK_USERS_DB || 'kk_users',
  poets: process.env.KK_POETS_DB || 'kk_poets',
  poetrys: process.env.KK_POETRYS_DB || 'kk_poetrys',
  jumbaqlar: process.env.KK_JUMBAQLAR_DB || 'kk_jumbaqlar',
  tusindirme: process.env.KK_TUSINDIRME_DB || 'kk_tusindirme',
  quiz: process.env.KK_QUIZ_DB || 'kk_quiz',
  krasvord: process.env.KK_KRASVORD_DB || 'kk_krasvord',
  statistika: process.env.KK_STATISTIKA_DB || 'kk_statistika',
  ai: process.env.KK_AI_DB || 'kk_ai_db',
  logs: process.env.KK_LOGS_DB || 'kk_logs',
};

// Umumiy server ulanish sozlamasi (baza nomisiz)
export const SERVER_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
};

function makePool(database) {
  return mysql.createPool({
    ...SERVER_CONFIG,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4',
  });
}

export const pools = {
  users: makePool(DB.users),
  poets: makePool(DB.poets),
  poetrys: makePool(DB.poetrys),
  jumbaqlar: makePool(DB.jumbaqlar),
  tusindirme: makePool(DB.tusindirme),
  quiz: makePool(DB.quiz),
  krasvord: makePool(DB.krasvord),
  statistika: makePool(DB.statistika),
  ai: makePool(DB.ai),
  logs: makePool(DB.logs),
};

// Barcha baza nomlari ro‘yxati (setup/health uchun)
export const ALL_DB_NAMES = Object.values(DB);

export default pools;
