// Import aldınan bar bolǵan (legacy) kitaplardı literature_writers menen baylanıstıradı.
// Qayta júrgiziwge qawipsiz (idempotent).
import db from '../src/config/quiz.db.js';

const LINKS = [
  { bookId: 'berdaq', writerSlug: 'berdaq-gargabay-uly' },
  { bookId: 'ajiniyaz', writerSlug: 'ajiniyaz-qosibay-uly' },
  { bookId: 'kunxoja', writerSlug: 'kunxoja-ibrayim-uly' },
  { bookId: 'ibrayim-yusupov', writerSlug: 'yusupov-ibrayim' },
  { bookId: 'qaipbergenov', writerSlug: 'qayipbergenov-tolepbergen' },
  // qirq-qiz — xalıq dástanı, avtorı belgisiz, baylanıs qoyılmaydı.
];

let linked = 0;
for (const { bookId, writerSlug } of LINKS) {
  const [[book]] = await db.query('SELECT id FROM books WHERE id = ? LIMIT 1', [bookId]);
  if (!book) {
    console.log(`- kitap joq, ótkerip jiberildi: ${bookId}`);
    continue;
  }
  const [[writer]] = await db.query(
    'SELECT id FROM literature_writers WHERE slug = ? LIMIT 1',
    [writerSlug]
  );
  if (!writer) {
    console.log(`- jazıwshı joq, ótkerip jiberildi: ${writerSlug}`);
    continue;
  }
  const [result] = await db.query(
    `INSERT IGNORE INTO book_writers (book_id, writer_id, role, sort_order)
     VALUES (?, ?, 'author', 0)`,
    [bookId, writer.id]
  );
  if (result.affectedRows) {
    linked += 1;
    console.log(`+ baylanıstı: ${bookId} -> ${writerSlug}`);
  } else {
    console.log(`= aldın bar: ${bookId} -> ${writerSlug}`);
  }
}
console.log(`\nJámi jańa baylanıs: ${linked}`);
process.exit(0);
