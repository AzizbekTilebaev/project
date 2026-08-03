import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function parseUrl(url) {
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: Number(u.port) || 3306,
      user: decodeURIComponent(u.username) || 'root',
      password: decodeURIComponent(u.password) || '',
      database: u.pathname.replace(/^\//, '') || 'tusindirme_sozlik',
    };
  } catch {
    return null;
  }
}

const fromUrl = process.env.DATABASE_TUSINDIRME
  ? parseUrl(process.env.DATABASE_TUSINDIRME)
  : null;

const config = fromUrl || {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'tusindirme_sozlik',
};

const pool = mysql.createPool({
  ...config,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
});

export const DICT_DB_CONFIG = config;
export default pool;
