import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// quiz_db — testlar uchun alohida ma'lumotlar bazasi.
// DATABASE_QUIZ berilgan bo'lsa undan, aks holda DB_* + quiz_db dan foydalanadi.
function parseUrl(url) {
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: Number(u.port) || 3306,
      user: decodeURIComponent(u.username) || 'root',
      password: decodeURIComponent(u.password) || '',
      database: u.pathname.replace(/^\//, '') || 'quiz_db',
    };
  } catch {
    return null;
  }
}

const fromUrl = process.env.DATABASE_QUIZ ? parseUrl(process.env.DATABASE_QUIZ) : null;

const config = fromUrl || {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.QUIZ_DB_NAME || 'quiz_db',
};

const pool = mysql.createPool({
  ...config,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
});

export const QUIZ_DB_CONFIG = config;
export default pool;
