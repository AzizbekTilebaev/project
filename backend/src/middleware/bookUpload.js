import fs from 'fs';
import path from 'path';
import multer from 'multer';
import crypto from 'crypto';

export const ALLOWED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx']);
export const ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream', // some browsers send this for doc/docx
]);

export function getUploadsDir() {
  const configured = process.env.BOOKS_UPLOAD_DIR;
  if (configured) {
    return path.isAbsolute(configured)
      ? configured
      : path.resolve(process.cwd(), configured);
  }
  return path.join(process.cwd(), 'public', 'uploads', 'books');
}

export function ensureUploadsDir() {
  const dir = getUploadsDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getMaxUploadBytes() {
  const mb = Number(process.env.BOOKS_MAX_UPLOAD_MB) || 25;
  return Math.min(Math.max(mb, 1), 100) * 1024 * 1024;
}

function extensionOf(filename = '') {
  return path.extname(String(filename)).toLowerCase();
}

export function formatFromFilename(filename) {
  const ext = extensionOf(filename);
  if (ext === '.pdf') return 'pdf';
  if (ext === '.doc') return 'doc';
  if (ext === '.docx') return 'docx';
  return null;
}

export function safeStoredPath(storedName) {
  if (!storedName || typeof storedName !== 'string') return null;
  if (storedName.includes('..') || storedName.includes('/') || storedName.includes('\\')) {
    return null;
  }
  const dir = getUploadsDir();
  const full = path.join(dir, storedName);
  if (!full.startsWith(dir)) return null;
  return full;
}

export function deleteStoredFile(storedName) {
  const full = safeStoredPath(storedName);
  if (!full) return;
  try {
    if (fs.existsSync(full)) fs.unlinkSync(full);
  } catch {
    /* ignore */
  }
}

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    try {
      cb(null, ensureUploadsDir());
    } catch (err) {
      cb(err);
    }
  },
  filename(_req, file, cb) {
    const ext = extensionOf(file.originalname);
    const id = crypto.randomBytes(16).toString('hex');
    cb(null, `${id}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  const ext = extensionOf(file.originalname);
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    const err = new Error('Tek PDF, DOC yamasa DOCX fayllar qabıl etiledi');
    err.statusCode = 400;
    return cb(err);
  }
  if (file.mimetype && !ALLOWED_MIMES.has(file.mimetype)) {
    // still allow if extension is valid — some clients send odd MIME
    if (!['.pdf', '.doc', '.docx'].includes(ext)) {
      const err = new Error('Fayl túri qabıl etilmeydi');
      err.statusCode = 400;
      return cb(err);
    }
  }
  cb(null, true);
}

export const bookUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: getMaxUploadBytes(), files: 1 },
});

export function mimeForFormat(format) {
  if (format === 'pdf') return 'application/pdf';
  if (format === 'doc') return 'application/msword';
  if (format === 'docx') {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  return 'application/octet-stream';
}

/** PDF / OLE doc / OOXML docx magic */
export function detectBookKind(buf) {
  if (!buf || buf.length < 8) return null;
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) {
    return { format: 'pdf', ext: '.pdf', mime: 'application/pdf' };
  }
  // OLE Compound File (legacy .doc)
  if (
    buf[0] === 0xd0 &&
    buf[1] === 0xcf &&
    buf[2] === 0x11 &&
    buf[3] === 0xe0 &&
    buf[4] === 0xa1 &&
    buf[5] === 0xb1 &&
    buf[6] === 0x1a &&
    buf[7] === 0xe1
  ) {
    return {
      format: 'doc',
      ext: '.doc',
      mime: 'application/msword',
    };
  }
  // ZIP / OOXML (.docx starts with PK)
  if (buf[0] === 0x50 && buf[1] === 0x4b && (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07)) {
    return {
      format: 'docx',
      ext: '.docx',
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
  }
  return null;
}

export function verifyUploadedBookFile(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(8);
    fs.readSync(fd, buf, 0, 8, 0);
    return detectBookKind(buf);
  } finally {
    fs.closeSync(fd);
  }
}
