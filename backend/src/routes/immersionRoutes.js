import { Router } from 'express';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import { requirePermission, PERMISSIONS } from '../middleware/rbac.js';
import { requireActor } from '../middleware/actor.js';
import { immersionUpload, enforceImmersionSize } from '../middleware/immersionUpload.js';
import {
  createImmersionAsset,
  listImmersionForWord,
  listReadyImmersionWords,
  listAllImmersion,
  reattachImmersionAsset,
  deleteImmersion,
  getAssetPublic,
  resolveStoredPath,
  ensureImmersionDir,
  submitImmersionProduce,
} from '../services/immersionService.js';
import { seedImmersionListenCard } from '../services/mistakeBankService.js';
import { verifyBookFileAccess } from '../utils/signedUrl.js';

const router = Router();
const canManageImmersion = requirePermission(PERMISSIONS.MANAGE_IMMERSION);
ensureImmersionDir();

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Upload limiti' },
});

router.get('/word/:titleId', async (req, res, next) => {
  try {
    const assets = await listImmersionForWord(req.params.titleId);
    res.json({ success: true, assets });
  } catch (err) {
    next(err);
  }
});

router.get('/ready', async (req, res, next) => {
  try {
    const result = await listReadyImmersionWords({
      limit: req.query?.limit,
      offset: req.query?.offset,
      q: req.query?.q,
      letter: req.query?.letter,
      kind: req.query?.kind,
    });
    res.json({
      success: true,
      words: result.words,
      count: result.words.length,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
    });
  } catch (err) {
    next(err);
  }
});

/** Authed tıńlaw → mistake_bank introduce (guest local-only). */
router.post('/listen', requireActor, async (req, res, next) => {
  try {
    const titleId = req.body?.titleId ?? req.body?.dictTitleId;
    const prompt = req.body?.prompt ?? req.body?.soz ?? null;
    const result = await seedImmersionListenCard(req.actor.id, {
      dictTitleId: titleId,
      prompt,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

/** Authed: tıńlawdan keyin typed produce → SRS touch. */
router.post('/produce', requireActor, async (req, res, next) => {
  try {
    const titleId = req.body?.titleId ?? req.body?.dictTitleId;
    const result = await submitImmersionProduce(req.actor.id, {
      dictTitleId: titleId,
      answer: req.body?.answer,
      prompt: req.body?.prompt ?? req.body?.soz ?? null,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/file', async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd || process.env.REQUIRE_SIGNED_BOOK_FILES === '1') {
      if (!verifyBookFileAccess(`immersion:${req.params.id}`, req.query.exp, req.query.sig)) {
        return res.status(403).json({ success: false, error: 'Token jaramlı emes' });
      }
    }
    const resolved = await resolveStoredPath(req.params.id);
    if (!resolved || !fs.existsSync(resolved.full)) {
      return res.status(404).json({ success: false, error: 'Fayl joq' });
    }
    res.setHeader('Content-Type', resolved.row.mime_type || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(resolved.row.original_name || 'asset')}`
    );
    fs.createReadStream(resolved.full).pipe(res);
  } catch (err) {
    next(err);
  }
});

router.get('/admin/list', canManageImmersion, async (req, res, next) => {
  try {
    const assets = await listAllImmersion({
      q: req.query.q || '',
      orphansOnly: req.query.orphans === '1' || req.query.orphans === 'true',
    });
    res.json({ success: true, assets });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/admin',
  canManageImmersion,
  uploadLimiter,
  immersionUpload.single('file'),
  enforceImmersionSize,
  async (req, res, next) => {
    try {
      const asset = await createImmersionAsset({
        titleId: req.body?.titleId,
        role: req.body?.role || 'primary',
        file: req.file,
        adminId: req.admin?.sub || null,
      });
      res.status(201).json({ success: true, asset });
    } catch (err) {
      next(err);
    }
  }
);

router.patch('/admin/:id', canManageImmersion, async (req, res, next) => {
  try {
    const asset = await reattachImmersionAsset(req.params.id, {
      titleId: req.body?.titleId ?? req.body?.title_id,
      role: req.body?.role,
    });
    res.json({ success: true, asset });
  } catch (err) {
    next(err);
  }
});

router.delete('/admin/:id', canManageImmersion, async (req, res, next) => {
  try {
    await deleteImmersion(req.params.id);
    res.json({ success: true, deleted: true });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const asset = await getAssetPublic(req.params.id);
    if (!asset) return res.status(404).json({ success: false, error: 'Tabılmadı' });
    res.json({ success: true, asset });
  } catch (err) {
    next(err);
  }
});

export default router;
