import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import { ensureImmersionDir, detectKind } from '../services/immersionService.js';

const ALLOWED = new Set(['.glb', '.mp4', '.webm', '.mp3', '.ogg', '.wav']);

function getMaxBytes(kind) {
  if (kind === 'video') return (Number(process.env.IMMERSION_MAX_VIDEO_MB) || 100) * 1024 * 1024;
  if (kind === 'model3d') return (Number(process.env.IMMERSION_MAX_3D_MB) || 50) * 1024 * 1024;
  return (Number(process.env.IMMERSION_MAX_AUDIO_MB) || 15) * 1024 * 1024;
}

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    try {
      cb(null, ensureImmersionDir());
    } catch (err) {
      cb(err);
    }
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomBytes(16).toString('hex')}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED.has(ext)) {
    const err = new Error('Tek GLB, MP4/WebM, MP3/OGG/WAV');
    err.statusCode = 400;
    return cb(err);
  }
  const kind = detectKind(file.originalname, file.mimetype);
  if (!kind) {
    const err = new Error('Fayl túri qabıl etilmeydi');
    err.statusCode = 400;
    return cb(err);
  }
  file._immersionKind = kind;
  cb(null, true);
}

export const immersionUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 },
});

export function enforceImmersionSize(req, res, next) {
  if (!req.file) return next();
  const kind = req.file._immersionKind || detectKind(req.file.originalname, req.file.mimetype);
  const max = getMaxBytes(kind);
  if (req.file.size > max) {
    return res.status(400).json({ success: false, error: 'Fayl júdá úlken' });
  }
  next();
}
