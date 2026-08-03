/**
 * books + book_sections tables in quiz_db, seed from frontend books.json if empty.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import { QUIZ_DB_CONFIG } from '../src/config/quiz.db.js';
import { ensureUploadsDir } from '../src/middleware/bookUpload.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const admin = await mysql.createConnection({
  host: QUIZ_DB_CONFIG.host,
  port: QUIZ_DB_CONFIG.port,
  user: QUIZ_DB_CONFIG.user,
  password: QUIZ_DB_CONFIG.password,
  charset: 'utf8mb4',
});
await admin.query(
  `CREATE DATABASE IF NOT EXISTS \`${QUIZ_DB_CONFIG.database}\`
   CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
);
await admin.end();

const db = await mysql.createConnection({ ...QUIZ_DB_CONFIG, charset: 'utf8mb4' });

if (process.argv.includes('--fresh')) {
  await db.query('DROP TABLE IF EXISTS book_sections');
  await db.query('DROP TABLE IF EXISTS books');
  console.log('🗑️  books / book_sections óshirildi (--fresh)');
}

await db.query(`
  CREATE TABLE IF NOT EXISTS books (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    author VARCHAR(200) NOT NULL,
    years VARCHAR(100) NOT NULL DEFAULT '',
    genre VARCHAR(40) NOT NULL DEFAULT 'other',
    description TEXT,
    note VARCHAR(500) DEFAULT '',
    source_type ENUM('text','pdf','doc','docx') NOT NULL DEFAULT 'text',
    original_name VARCHAR(255) NULL,
    stored_name VARCHAR(255) NULL,
    file_size BIGINT NULL,
    mime_type VARCHAR(120) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_books_genre (genre),
    INDEX idx_books_source (source_type)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

await db.query(`
  CREATE TABLE IF NOT EXISTS book_sections (
    id VARCHAR(80) PRIMARY KEY,
    book_id VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    paragraphs_json LONGTEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    CONSTRAINT fk_book_sections_book
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    INDEX idx_book_sections_book (book_id, sort_order)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

console.log('✅ books / book_sections tables ready');

ensureUploadsDir();
console.log('✅ uploads/books directory ready');

const [countRows] = await db.query('SELECT COUNT(*) AS c FROM books');
const count = Number(countRows[0]?.c || 0);

if (count === 0 || process.argv.includes('--reseed')) {
  const seedPath = path.resolve(__dirname, '../../frontend/src/data/books.json');
  if (fs.existsSync(seedPath)) {
    if (process.argv.includes('--reseed')) {
      await db.query('DELETE FROM book_sections');
      await db.query('DELETE FROM books');
    }
    const raw = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
    const books = Array.isArray(raw.books) ? raw.books : [];
    for (const book of books) {
      await db.query(
        `INSERT INTO books
          (id, title, author, years, genre, description, note, source_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'text')
         ON DUPLICATE KEY UPDATE title = VALUES(title)`,
        [
          book.id,
          book.title,
          book.author,
          book.years || '',
          book.genre || 'other',
          book.description || '',
          book.note || '',
        ]
      );
      await db.query('DELETE FROM book_sections WHERE book_id = ?', [book.id]);
      const sections = Array.isArray(book.sections) ? book.sections : [];
      for (let i = 0; i < sections.length; i++) {
        const s = sections[i];
        await db.query(
          `INSERT INTO book_sections (id, book_id, title, paragraphs_json, sort_order)
           VALUES (?, ?, ?, ?, ?)`,
          [
            `${book.id}-s${i}`,
            book.id,
            s.title,
            JSON.stringify(s.paragraphs || []),
            i,
          ]
        );
      }
    }
    console.log(`✅ Seed: ${books.length} kitap books.json dan`);
  } else {
    console.log('⚠️  frontend/src/data/books.json tabılmadı — seed ótkizildi');
  }
} else {
  console.log(`ℹ️  books jadvalında ${count} qator — seed ótkizildi`);
}

await db.end();
console.log('\n✅ Books DB setup tamamlandı.\n');
