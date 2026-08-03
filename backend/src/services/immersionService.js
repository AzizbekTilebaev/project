import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { pools, DB } from '../config/db.js';
import { signBookFileAccess } from '../utils/signedUrl.js';
import { buildProduceAccepted } from './tutorService.js';
import { gradeProduceSubmission } from '../utils/produceGrade.js';

const db = pools.ai;

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

export function getImmersionDir() {
  const configured = process.env.IMMERSION_UPLOAD_DIR;
  if (configured) {
    return path.isAbsolute(configured)
      ? configured
      : path.resolve(process.cwd(), configured);
  }
  return path.join(process.cwd(), 'public', 'uploads', 'immersion');
}

export function ensureImmersionDir() {
  const dir = getImmersionDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const MAGIC = {
  glb: [[0x67, 0x6c, 0x54, 0x46]], // glTF
  mp4: [[0x00, 0x00, 0x00], [0x66, 0x74, 0x79, 0x70]], // ftyp at offset 4 loosely
  webm: [[0x1a, 0x45, 0xdf, 0xa3]],
  mp3: [[0xff, 0xfb], [0x49, 0x44, 0x33]],
  ogg: [[0x4f, 0x67, 0x67, 0x53]],
  wav: [[0x52, 0x49, 0x46, 0x46]],
};

export function detectKind(filename, mime) {
  const ext = path.extname(String(filename || '')).toLowerCase();
  if (ext === '.glb') return 'model3d';
  if (ext === '.mp4' || ext === '.webm') return 'video';
  if (ext === '.mp3' || ext === '.ogg' || ext === '.wav') return 'audio';
  if (mime?.startsWith('video/')) return 'video';
  if (mime?.startsWith('audio/')) return 'audio';
  if (mime === 'model/gltf-binary') return 'model3d';
  return null;
}

export function validateMagicBytes(filePath, kind) {
  const fd = fs.openSync(filePath, 'r');
  const buf = Buffer.alloc(16);
  fs.readSync(fd, buf, 0, 16, 0);
  fs.closeSync(fd);

  if (kind === 'model3d') {
    return buf.slice(0, 4).toString('ascii') === 'glTF';
  }
  if (kind === 'video') {
    // MP4: bytes 4-7 often 'ftyp'; webm EBML
    if (buf.slice(4, 8).toString('ascii') === 'ftyp') return true;
    if (buf[0] === 0x1a && buf[1] === 0x45) return true;
    return false;
  }
  if (kind === 'audio') {
    if (buf.slice(0, 3).toString('ascii') === 'ID3') return true;
    if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return true;
    if (buf.slice(0, 4).toString('ascii') === 'OggS') return true;
    if (buf.slice(0, 4).toString('ascii') === 'RIFF') return true;
    return false;
  }
  return false;
}

export async function resolveTitleId(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;
  try {
    if (/^[0-9a-f-]{8,36}$/i.test(value)) {
      const [[byId]] = await pools.tusindirme.query(
        `SELECT id FROM titles WHERE id = ? AND status = 1 LIMIT 1`,
        [value]
      );
      if (byId?.id) return byId.id;
    }
    const [[row]] = await pools.tusindirme.query(
      `SELECT id FROM titles
       WHERE status = 1 AND (soz = ? OR normalized = ? OR search_key = ?)
       ORDER BY status DESC LIMIT 1`,
      [value, value, value]
    );
    return row?.id || null;
  } catch {
    return null;
  }
}

export async function createImmersionAsset({ titleId, role = 'primary', file, adminId = null }) {
  if (!file) throw httpError('Fayl kerek');
  const kind = detectKind(file.originalname, file.mimetype);
  if (!kind) throw httpError('Tek GLB, MP4/WebM, MP3/OGG/WAV');
  if (!validateMagicBytes(file.path, kind)) {
    try {
      fs.unlinkSync(file.path);
    } catch {
      /* ignore */
    }
    throw httpError('Fayl mazmunı (magic) qabıl etilmegen');
  }

  const resolvedTitleId = await resolveTitleId(titleId);
  if (!resolvedTitleId) {
    try {
      fs.unlinkSync(file.path);
    } catch {
      /* ignore */
    }
    throw httpError('Sóz tabılmadı — anıq sóz yamasa jaramlı title_id kerek', 404);
  }

  const roleSafe = ['primary', 'alt', 'subtitle'].includes(String(role))
    ? String(role)
    : 'primary';

  const id = crypto.randomUUID();
  await db.query(
    `INSERT INTO immersion_assets
     (id, title_id, kind, role, original_name, stored_name, mime_type, file_size, status, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ready', ?)`,
    [
      id,
      resolvedTitleId,
      kind,
      roleSafe,
      String(file.originalname || '').slice(0, 255),
      path.basename(file.filename || file.path),
      file.mimetype || null,
      file.size || null,
      adminId,
    ]
  );
  return getAssetPublic(id);
}

export async function getAssetPublic(id) {
  const [[row]] = await db.query(`SELECT * FROM immersion_assets WHERE id = ? LIMIT 1`, [id]);
  if (!row) return null;
  const access = signBookFileAccess(`immersion:${id}`, 10 * 60);
  return {
    id: row.id,
    titleId: row.title_id,
    kind: row.kind,
    role: row.role,
    originalName: row.original_name,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    status: row.status,
    fileAccess: {
      ...access,
      url: `/api/immersion/${id}/file?exp=${access.exp}&sig=${access.sig}`,
    },
  };
}

export async function listImmersionForWord(titleId) {
  const [rows] = await db.query(
    `SELECT id FROM immersion_assets WHERE title_id = ? AND status = 'ready' ORDER BY created_at`,
    [titleId]
  );
  const out = [];
  for (const r of rows) {
    out.push(await getAssetPublic(r.id));
  }
  return out;
}

/**
 * Ready immersiya sózler — title + soz (cross-db join).
 * Browse: q / letter / kind + offset pagination.
 */
export async function listReadyImmersionWords({
  limit = 40,
  offset = 0,
  q = '',
  letter = '',
  kind = '',
} = {}) {
  const lim = Math.min(80, Math.max(1, Number(limit) || 40));
  const off = Math.max(0, Math.min(10000, Number(offset) || 0));
  const needle = String(q || '').trim().slice(0, 80);
  const letch = String(letter || '').trim().slice(0, 8);
  const kindRaw = String(kind || '').trim().toLowerCase();
  const kindSafe = ['audio', 'video', 'model3d'].includes(kindRaw) ? kindRaw : '';

  const whereParts = [
    `ia.status = 'ready'`,
    `ia.title_id IS NOT NULL`,
    `ia.title_id <> ''`,
  ];
  const params = [];

  if (needle) {
    whereParts.push(
      `(t.soz LIKE ? OR t.normalized LIKE ? OR t.search_key LIKE ? OR ia.title_id = ?)`
    );
    const like = `%${needle}%`;
    params.push(like, like, like, needle);
  }
  if (letch) {
    whereParts.push(`t.soz LIKE ?`);
    params.push(`${letch}%`);
  }

  const having = kindSafe ? `SUM(ia.kind = ?) > 0` : '1=1';
  const havingParams = kindSafe ? [kindSafe] : [];

  const fromSql = `
     FROM immersion_assets ia
     INNER JOIN \`${DB.tusindirme}\`.titles t
       ON t.id = ia.title_id AND t.status = 1
     WHERE ${whereParts.join(' AND ')}
     GROUP BY ia.title_id, t.soz
     HAVING ${having}`;

  const [[countRow]] = await db.query(
    `SELECT COUNT(*) AS total FROM (
       SELECT ia.title_id
       ${fromSql}
     ) AS ready_words`,
    [...params, ...havingParams]
  );
  const total = Number(countRow?.total) || 0;

  const [rows] = await db.query(
    `SELECT
        ia.title_id AS titleId,
        t.soz AS soz,
        SUM(ia.kind = 'audio') AS audioCount,
        SUM(ia.kind = 'video') AS videoCount,
        SUM(ia.kind = 'model3d') AS modelCount,
        COUNT(*) AS assetCount
     ${fromSql}
     ORDER BY t.soz ASC
     LIMIT ? OFFSET ?`,
    [...params, ...havingParams, lim, off]
  );

  const words = rows.map((r) => ({
    titleId: r.titleId,
    soz: r.soz,
    assetCount: Number(r.assetCount) || 0,
    kinds: {
      audio: Number(r.audioCount) || 0,
      video: Number(r.videoCount) || 0,
      model3d: Number(r.modelCount) || 0,
    },
    hasAudio: Number(r.audioCount) > 0,
  }));

  return {
    words,
    total,
    limit: lim,
    offset: off,
    hasMore: off + words.length < total,
  };
}

export async function listAllImmersion({ q = '', orphansOnly = false } = {}) {
  const needle = String(q || '').trim().slice(0, 80);
  const params = [];
  let where = '1=1';
  if (needle) {
    where += ' AND (ia.title_id = ? OR t.soz LIKE ? OR t.normalized LIKE ? OR t.search_key LIKE ?)';
    const like = `%${needle}%`;
    params.push(needle, like, like, like);
  }
  if (orphansOnly) {
    where += ' AND (ia.title_id IS NULL OR ia.title_id = \'\' OR t.id IS NULL OR t.status <> 1)';
  }
  const [rows] = await db.query(
    `SELECT ia.id,
            ia.title_id AS titleId,
            ia.kind,
            ia.role,
            ia.original_name AS originalName,
            ia.mime_type AS mimeType,
            ia.file_size AS fileSize,
            ia.status,
            ia.created_at AS createdAt,
            t.soz AS soz,
            t.status AS titleStatus,
            CASE
              WHEN ia.title_id IS NULL OR ia.title_id = '' OR t.id IS NULL OR t.status <> 1 THEN 1
              ELSE 0
            END AS isOrphan
     FROM immersion_assets ia
     LEFT JOIN \`${DB.tusindirme}\`.titles t ON t.id = ia.title_id
     WHERE ${where}
     ORDER BY ia.created_at DESC
     LIMIT 200`,
    params
  );
  return rows.map((r) => ({
    id: r.id,
    titleId: r.titleId,
    kind: r.kind,
    role: r.role,
    originalName: r.originalName,
    mimeType: r.mimeType,
    fileSize: r.fileSize,
    status: r.status,
    createdAt: r.createdAt,
    soz: r.soz || null,
    isOrphan: Boolean(Number(r.isOrphan)),
  }));
}

/**
 * Orphan / qáte title_id ni jaramlı sózge baylanıstırıw; role da jańalaw múmkin.
 */
export async function reattachImmersionAsset(id, { titleId, role } = {}) {
  const assetId = String(id || '').trim();
  if (!assetId) throw httpError('Asset id kerek', 400);

  const [[existing]] = await db.query(
    `SELECT id, title_id, role FROM immersion_assets WHERE id = ? LIMIT 1`,
    [assetId]
  );
  if (!existing) throw httpError('Asset tabılmadı', 404);

  const updates = [];
  const params = [];

  if (titleId != null && String(titleId).trim() !== '') {
    const resolvedTitleId = await resolveTitleId(titleId);
    if (!resolvedTitleId) {
      throw httpError('Sóz tabılmadı — anıq sóz yamasa jaramlı title_id kerek', 404);
    }
    updates.push('title_id = ?');
    params.push(resolvedTitleId);
  }

  if (role != null && String(role).trim() !== '') {
    const roleSafe = ['primary', 'alt', 'subtitle'].includes(String(role))
      ? String(role)
      : null;
    if (!roleSafe) throw httpError('Rol: primary | alt | subtitle', 400);
    updates.push('role = ?');
    params.push(roleSafe);
  }

  if (!updates.length) {
    throw httpError('titleId yamasa role kerek', 400);
  }

  params.push(assetId);
  await db.query(`UPDATE immersion_assets SET ${updates.join(', ')} WHERE id = ?`, params);
  return getAssetPublic(assetId);
}

export async function deleteImmersion(id) {
  const [[row]] = await db.query(`SELECT stored_name FROM immersion_assets WHERE id = ?`, [id]);
  if (!row) throw httpError('Asset tabılmadı', 404);
  const full = path.join(getImmersionDir(), row.stored_name);
  try {
    if (fs.existsSync(full)) fs.unlinkSync(full);
  } catch {
    /* ignore */
  }
  await db.query(`DELETE FROM immersion_assets WHERE id = ?`, [id]);
  return { deleted: true };
}

export async function resolveStoredPath(id) {
  const [[row]] = await db.query(`SELECT * FROM immersion_assets WHERE id = ? LIMIT 1`, [id]);
  if (!row) return null;
  const full = path.join(getImmersionDir(), row.stored_name);
  if (!full.startsWith(getImmersionDir())) return null;
  return { row, full };
}

/**
 * Sof: tıńlawdan keyin typed produce bahası.
 * @returns {{ correct: boolean, nearMiss: boolean }}
 */
export function gradeImmersionProduce({ lemma, answer } = {}) {
  const accepted = buildProduceAccepted(lemma);
  if (!accepted.length) return { correct: false, nearMiss: false };
  return gradeProduceSubmission(accepted, answer);
}

/**
 * Authed: seed (idempotent) + soft grade + immersion SRS touch.
 */
export async function submitImmersionProduce(
  actorId,
  { dictTitleId, answer, prompt = null } = {}
) {
  const id = String(dictTitleId || '').trim();
  const submitted = String(answer ?? '').trim();
  if (!actorId) throw httpError('Actor kerek', 401);
  if (!id) throw httpError('titleId kerek', 400);
  if (!submitted) throw httpError('Sózdi jazıń', 400);

  let lemma = String(prompt || '').trim();
  if (!lemma) {
    try {
      const TusindirmeModel = (await import('../models/tusindirme.model.js')).default;
      const row = await new TusindirmeModel().getSozById(id);
      lemma = row?.soz ? String(row.soz).trim() : '';
    } catch {
      lemma = '';
    }
  }
  if (!lemma) throw httpError('Sóz tabılmadı', 404);

  const { seedImmersionListenCard, touchMistakeBankByDictTitle } = await import(
    './mistakeBankService.js'
  );
  await seedImmersionListenCard(actorId, { dictTitleId: id, prompt: lemma });

  const graded = gradeImmersionProduce({ lemma, answer: submitted });
  await touchMistakeBankByDictTitle(actorId, id, {
    correct: graded.correct,
    prompt: lemma,
    fallbackSource: 'immersion',
  });

  return {
    correct: graded.correct,
    nearMiss: graded.nearMiss,
    correctLemma: lemma,
  };
}

// silence unused
void MAGIC;
