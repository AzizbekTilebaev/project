import fs from 'fs';
import {
  listBooks,
  getBookById,
  getBookFileMeta,
  createBook,
  updateBook,
  deleteBook,
  hideBook,
  restoreBook,
  linkBookWriter,
  unlinkBookWriter,
} from '../services/booksService.js';
import {
  safeStoredPath,
  mimeForFormat,
  deleteStoredFile,
} from '../middleware/bookUpload.js';
import { signBookFileAccess, verifyBookFileAccess } from '../utils/signedUrl.js';
import {
  upsertBookProgress,
  getBookProgress,
  listBookProgress,
} from '../services/bookProgressService.js';

function parseSectionsField(body) {
  if (body.sections == null) return undefined;
  if (typeof body.sections === 'string') {
    try {
      return JSON.parse(body.sections);
    } catch {
      const err = new Error('Bólimler JSON emes');
      err.statusCode = 400;
      throw err;
    }
  }
  return body.sections;
}

export async function adminLogin(req, res, next) {
  try {
    // email berilsa — akkaunt login (rol bilan); aks holda legacy parol
    const { loginLegacyOrAccount } = await import('../services/adminAccountsService.js');
    const result = await loginLegacyOrAccount(req.body || {});
    res.json({ success: true, ...result, expiresInHours: 8 });
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    const books = await listBooks({
      q: req.query.q || '',
      orphansOnly: false,
      includeHidden: false,
    });
    res.json({ success: true, books });
  } catch (err) {
    next(err);
  }
}

export async function adminList(req, res, next) {
  try {
    const importStatus = String(req.query.importStatus || req.query.import_status || '').trim();
    const books = await listBooks({
      q: req.query.q || '',
      orphansOnly: req.query.orphans === '1' || req.query.orphans === 'true',
      includeHidden: true,
      importStatus,
    });
    const hiddenOnly = req.query.hidden === '1' || req.query.hidden === 'true';
    res.json({
      success: true,
      books: hiddenOnly ? books.filter((b) => b.isHidden) : books,
    });
  } catch (err) {
    next(err);
  }
}

export async function getOne(req, res, next) {
  try {
    res.set('Cache-Control', 'no-store');
    const book = await getBookById(req.params.id);
    if (!book) {
      return res.status(404).json({ success: false, error: 'Kitap tabılmadı' });
    }
    let fileAccess = null;
    if (book.sourceType && book.sourceType !== 'text' && book.id) {
      fileAccess = signBookFileAccess(book.id, 10 * 60);
    }
    res.json({ success: true, book, fileAccess });
  } catch (err) {
    next(err);
  }
}

export async function adminGetOne(req, res, next) {
  try {
    res.set('Cache-Control', 'no-store');
    const book = await getBookById(req.params.id, { includeHidden: true });
    if (!book) {
      return res.status(404).json({ success: false, error: 'Kitap tabılmadı' });
    }
    let fileAccess = null;
    if (book.sourceType && book.sourceType !== 'text' && book.id) {
      fileAccess = signBookFileAccess(book.id, 10 * 60);
    }
    res.json({ success: true, book, fileAccess });
  } catch (err) {
    next(err);
  }
}

export async function streamFile(req, res, next) {
  try {
    res.set('Cache-Control', 'no-store');
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd || process.env.REQUIRE_SIGNED_BOOK_FILES === '1') {
      if (!verifyBookFileAccess(req.params.id, req.query.exp, req.query.sig)) {
        return res.status(403).json({ success: false, error: 'Fayl tokenı jaramlı emes' });
      }
    }

    const meta = await getBookFileMeta(req.params.id);
    if (!meta || !meta.stored_name) {
      return res.status(404).json({ success: false, error: 'Fayl tabılmadı' });
    }
    const full = safeStoredPath(meta.stored_name);
    if (!full || !fs.existsSync(full)) {
      return res.status(404).json({ success: false, error: 'Fayl diskte joq' });
    }

    const format = meta.source_type;
    const mime = meta.mime_type || mimeForFormat(format);
    const downloadName = meta.original_name || `${meta.title}.${format}`;
    const disposition =
      format === 'pdf' && req.query.download !== '1' ? 'inline' : 'attachment';

    res.setHeader('Content-Type', mime);
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename*=UTF-8''${encodeURIComponent(downloadName)}`
    );
    if (meta.file_size) res.setHeader('Content-Length', String(meta.file_size));
    fs.createReadStream(full).pipe(res);
  } catch (err) {
    next(err);
  }
}

export async function saveProgress(req, res, next) {
  try {
    res.set('Cache-Control', 'no-store');
    const progress = await upsertBookProgress(req.actor.id, req.params.id, req.body || {});
    res.json({ success: true, progress });
  } catch (err) {
    next(err);
  }
}

export async function getProgress(req, res, next) {
  try {
    res.set('Cache-Control', 'no-store');
    const progress = await getBookProgress(req.actor.id, req.params.id);
    res.json({ success: true, progress });
  } catch (err) {
    next(err);
  }
}

export async function listMyProgress(req, res, next) {
  try {
    res.set('Cache-Control', 'no-store');
    const progress = await listBookProgress(req.actor.id);
    res.json({ success: true, progress });
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const body = { ...req.body, sections: parseSectionsField(req.body) };
    const book = await createBook(body, req.file || null);
    res.status(201).json({ success: true, book });
  } catch (err) {
    if (req.file) deleteStoredFile(req.file.filename);
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const body = { ...req.body, sections: parseSectionsField(req.body) };
    const book = await updateBook(req.params.id, body, req.file || null);
    res.json({ success: true, book });
  } catch (err) {
    if (req.file) deleteStoredFile(req.file.filename);
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await deleteBook(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function hide(req, res, next) {
  try {
    const book = await hideBook(req.params.id);
    res.json({ success: true, book });
  } catch (err) {
    next(err);
  }
}

export async function restore(req, res, next) {
  try {
    const book = await restoreBook(req.params.id);
    res.json({ success: true, book });
  } catch (err) {
    next(err);
  }
}

export async function linkWriter(req, res, next) {
  try {
    const book = await linkBookWriter(req.params.id, req.body?.writerId ?? req.body?.writer_id, {
      role: req.body?.role,
    });
    res.json({ success: true, book });
  } catch (err) {
    next(err);
  }
}

export async function unlinkWriter(req, res, next) {
  try {
    const book = await unlinkBookWriter(req.params.id, req.params.writerId);
    res.json({ success: true, book });
  } catch (err) {
    next(err);
  }
}
