import fs from 'fs';
import path from 'path';
import multer from 'multer';
import crypto from 'crypto';

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function getAvatarsDir() {
  const configured = process.env.AVATARS_UPLOAD_DIR;
  if (configured) {
    return path.isAbsolute(configured)
      ? configured
      : path.resolve(process.cwd(), configured);
  }
  return path.join(process.cwd(), 'public', 'uploads', 'avatars');
}

export function ensureAvatarsDir() {
  const dir = getAvatarsDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getAvatarMaxBytes() {
  const mb = Number(process.env.AVATARS_MAX_UPLOAD_MB) || 3;
  return Math.min(Math.max(mb, 1), 8) * 1024 * 1024;
}

function detectImageKind(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: '.jpg', mime: 'image/jpeg' };
  }
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return { ext: '.png', mime: 'image/png' };
  }
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return { ext: '.webp', mime: 'image/webp' };
  }
  return null;
}

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, ensureAvatarsDir());
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    const safeExt = ALLOWED_EXT.has(ext) ? ext : '.jpg';
    cb(null, `a-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${safeExt}`);
  },
});

export const avatarUpload = multer({
  storage,
  limits: { fileSize: getAvatarMaxBytes(), files: 1 },
  fileFilter(_req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_EXT.has(ext) || !ALLOWED_MIME.has(file.mimetype)) {
      const err = new Error('Tek JPG, PNG yamasa WebP rásim');
      err.statusCode = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

export function handleAvatarMulter(req, res, next) {
  avatarUpload.single('avatar')(req, res, (err) => {
    if (err) {
      const status = err.statusCode || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 400);
      return res.status(status).json({
        success: false,
        message:
          err.code === 'LIMIT_FILE_SIZE'
            ? `Rásim ${getAvatarMaxBytes() / (1024 * 1024)} MB den aspaǵan bolıwı kerek`
            : err.message || 'Rásim júklew qátesi',
      });
    }
    if (!req.file?.path) return next();
    try {
      const fd = fs.openSync(req.file.path, 'r');
      const buf = Buffer.alloc(12);
      fs.readSync(fd, buf, 0, 12, 0);
      fs.closeSync(fd);
      const kind = detectImageKind(buf);
      if (!kind) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ success: false, message: 'Rásim faylı jaramlı emes' });
      }
      const curExt = path.extname(req.file.filename).toLowerCase();
      if (curExt !== kind.ext && !(curExt === '.jpeg' && kind.ext === '.jpg')) {
        const nextName = req.file.filename.slice(0, -curExt.length) + kind.ext;
        const nextPath = path.join(path.dirname(req.file.path), nextName);
        fs.renameSync(req.file.path, nextPath);
        req.file.filename = nextName;
        req.file.path = nextPath;
        req.file.mimetype = kind.mime;
      }
      return next();
    } catch {
      try {
        if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      } catch {
        /* ignore */
      }
      return res.status(400).json({ success: false, message: 'Rásim tekseriw qátesi' });
    }
  });
}

export function publicAvatarUrl(storedName) {
  if (!storedName) return null;
  return `/uploads/avatars/${encodeURIComponent(storedName)}`;
}

export function deleteStoredAvatar(storedNameOrUrl) {
  if (!storedNameOrUrl) return;
  let name = String(storedNameOrUrl);
  if (name.startsWith('/uploads/avatars/')) {
    name = decodeURIComponent(name.slice('/uploads/avatars/'.length));
  }
  if (name.includes('..') || name.includes('/') || name.includes('\\')) return;
  if (!name.startsWith('a-')) return;
  const full = path.join(getAvatarsDir(), name);
  try {
    if (fs.existsSync(full)) fs.unlinkSync(full);
  } catch {
    /* ignore */
  }
}
