/**
 * Import ertekler from SQLite + PDF collections into kk_poetrys.books
 *
 *   node scripts/import-ertekler.mjs
 *   node scripts/import-ertekler.mjs --apply
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
dotenv.config({ path: path.join(__dirname, '../.env') });

const APPLY = process.argv.includes('--apply');
const JSON_PATH = path.join(ROOT, 'new/ertekler.json');
const PDF_ERTEKLER = path.join(ROOT, 'new/Ertekler.pdf');
const PDF_ATAJANOV = path.join(ROOT, "new/A.Atajanov O'tken O'mir-Ertek.pdf");
const ATAJANOV_WRITER_ID = 16; // atajanov-abdimurat

function contentToParagraphs(content) {
  const normalized = String(content || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .trim();
  if (!normalized) return [];
  let paras = normalized
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (paras.length <= 1) {
    paras = normalized
      .split('\n')
      .map((p) => p.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
  }
  return paras.length ? paras : [normalized];
}

function tidyTitle(name) {
  return String(name || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function loadStories() {
  if (!fs.existsSync(JSON_PATH)) {
    throw new Error(`Missing ${JSON_PATH} (export from ertekler.db first)`);
  }
  const raw = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  return (Array.isArray(raw) ? raw : []).map((s) => ({
    id: Number(s.id),
    title: tidyTitle(s.title || s.story_name),
    content: String(s.content || ''),
    typeId: s.typeId != null ? Number(s.typeId) : null,
    typeName: String(s.typeName || 'Ertek').trim(),
  }));
}

async function main() {
  const stories = loadStories();
  console.log(`SQLite stories: ${stories.length}`);
  console.log(
    'types:',
    [...new Set(stories.map((s) => s.typeName))].join(' | ')
  );
  console.log('sample:', stories[0]?.title, 'paras', contentToParagraphs(stories[0]?.content).length);
  console.log('PDF Ertekler exists:', fs.existsSync(PDF_ERTEKLER));
  console.log('PDF Atajanov exists:', fs.existsSync(PDF_ATAJANOV));

  if (!APPLY) {
    console.log('Dry-run. Re-run with --apply to write DB + copy PDFs.');
    return;
  }

  const { pools, DB } = await import('../src/config/db.js');
  const { ensureUploadsDir, getUploadsDir } = await import('../src/middleware/bookUpload.js');
  const { toLatin } = await import('../src/utils/qqScript.js');

  const db = pools.poetrys;
  const uploadDir = ensureUploadsDir();

  // Remove previous import batch
  const [old] = await db.query(
    `SELECT id, stored_name FROM books WHERE id LIKE 'ertek-%' OR work_kind = 'ertek'`
  );
  for (const row of old) {
    await db.query(`DELETE FROM book_sections WHERE book_id = ?`, [row.id]);
    await db.query(`DELETE FROM \`${DB.poets}\`.book_writers WHERE book_id = ?`, [row.id]);
    if (row.stored_name) {
      const full = path.join(uploadDir, row.stored_name);
      if (fs.existsSync(full) && String(row.stored_name).startsWith('ertek-')) {
        try {
          fs.unlinkSync(full);
        } catch {
          /* ignore */
        }
      }
    }
    await db.query(`DELETE FROM books WHERE id = ?`, [row.id]);
  }
  console.log(`Cleared previous ertek books: ${old.length}`);

  let textCount = 0;
  for (const s of stories) {
    const bookId = `ertek-sqlite-${s.id}`;
    const paragraphs = contentToParagraphs(s.content);
    if (!paragraphs.length) {
      console.warn('skip empty', s.id, s.title);
      continue;
    }
    const title = s.title;
    const titleLatin = toLatin(title) || title;
    const description = s.typeName;
    const hash = crypto.createHash('sha1').update(`sqlite:${s.id}:${s.content}`).digest('hex');

    await db.query(
      `INSERT INTO books
        (id, title, title_original, title_latin, author, author_original, author_latin,
         years, genre, description, description_original, description_latin, note,
         source_type, original_name, stored_name, file_size, mime_type,
         original_script, source_path, content_hash, import_status, work_kind)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ertek', ?, ?, ?, ?, 'text',
               NULL, NULL, NULL, NULL, 'latin', ?, ?, 'imported', 'ertek')`,
      [
        bookId,
        title,
        title,
        titleLatin,
        'Qaraqalpaq xalıq ertekleri',
        'Qaraqalpaq xalıq ertekleri',
        'Qaraqalpaq xalıq ertekleri',
        '',
        description,
        description,
        toLatin(description) || description,
        s.typeName,
        `ertekler.db#${s.id}`,
        hash,
      ]
    );

    await db.query(
      `INSERT INTO book_sections (id, book_id, title, paragraphs_json, sort_order)
       VALUES (?, ?, ?, ?, 0)`,
      [`${bookId}-s0`, bookId, title, JSON.stringify(paragraphs)]
    );
    textCount += 1;
  }

  async function importPdf({ id, title, author, authorLatin, filePath, note, writerId }) {
    if (!fs.existsSync(filePath)) {
      console.warn('PDF missing', filePath);
      return false;
    }
    const ext = path.extname(filePath).toLowerCase() || '.pdf';
    const stored = `${id}${ext}`;
    const dest = path.join(getUploadsDir(), stored);
    fs.copyFileSync(filePath, dest);
    const st = fs.statSync(dest);
    const hash = crypto.createHash('sha1').update(fs.readFileSync(dest)).digest('hex');
    const titleLatin = toLatin(title) || title;

    await db.query(
      `INSERT INTO books
        (id, title, title_original, title_latin, author, author_original, author_latin,
         years, genre, description, description_original, description_latin, note,
         source_type, original_name, stored_name, file_size, mime_type,
         original_script, source_path, content_hash, import_status, work_kind)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ertek', ?, ?, ?, ?, 'pdf',
               ?, ?, ?, 'application/pdf', 'latin', ?, ?, 'imported', 'ertek')`,
      [
        id,
        title,
        title,
        titleLatin,
        author,
        author,
        authorLatin || toLatin(author) || author,
        '',
        note,
        note,
        toLatin(note) || note,
        note,
        path.basename(filePath),
        stored,
        st.size,
        path.relative(ROOT, filePath),
        hash,
      ]
    );

    if (writerId) {
      await db.query(
        `INSERT IGNORE INTO \`${DB.poets}\`.book_writers (book_id, writer_id, role, sort_order)
         VALUES (?, ?, 'author', 0)`,
        [id, writerId]
      );
    }
    return true;
  }

  const pdf1 = await importPdf({
    id: 'ertek-pdf-ertekler',
    title: 'Ertekler',
    author: 'Qaraqalpaq xalıq ertekleri',
    authorLatin: 'Qaraqalpaq xalıq ertekleri',
    filePath: PDF_ERTEKLER,
    note: 'Jıynaq · PDF',
  });

  const pdf2 = await importPdf({
    id: 'ertek-pdf-atajanov-otken-omir',
    title: 'Ótken ómir — Ertek',
    author: 'Ábdimurat Atajanov',
    authorLatin: 'Ábdimurat Atajanov',
    filePath: PDF_ATAJANOV,
    note: 'Avtor ertegi · PDF',
    writerId: ATAJANOV_WRITER_ID,
  });

  const [[n]] = await db.query(
    `SELECT COUNT(*) n FROM books WHERE genre = 'ertek' OR work_kind = 'ertek'`
  );
  console.log(`Done. text=${textCount}, pdfs=${Number(pdf1) + Number(pdf2)}, total ertek books=${n.n}`);
  console.log('uploads dir', getUploadsDir());

  await pools.poetrys.end();
  await pools.poets.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
