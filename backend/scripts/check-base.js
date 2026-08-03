import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

const db = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'tusindirme_sozlik',
});

const word = process.argv[2] || 'азапла';
const [r] = await db.query(
  `SELECT id, soz, normalized FROM titles WHERE normalized LIKE CONCAT(?, '%') AND status = 1 LIMIT 10`,
  [word]
);
console.log(r);
await db.end();
