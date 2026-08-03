import dotenv from 'dotenv';
import db from '../src/config/dictionary.db.js';

dotenv.config();
const [rows] = await db.query(
  `SELECT COLUMN_NAME
   FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'idiom_desc'
   ORDER BY ORDINAL_POSITION`
);
console.log(rows.map((row) => row.COLUMN_NAME));
await db.end();
