import { Router } from 'express';
import {
  listCrosswords,
  getCrosswordPublic,
  validateGuess,
  listCrosswordsAdmin,
  getCrosswordAdmin,
  upsertCrossword,
  deleteCrossword,
  recordSoloCompletion,
  listCrosswordStatsForActor,
} from '../services/crosswordService.js';
import { requireActor } from '../middleware/actor.js';
import { optionalAuth } from '../middleware/auth.js';
import { assertCanPlayCrossword } from '../services/quotaService.js';
import { requirePermission, PERMISSIONS } from '../middleware/rbac.js';
import { loginLegacyOrAccount } from '../services/adminAccountsService.js';

const router = Router();
const canManageCrosswords = requirePermission(PERMISSIONS.MANAGE_CROSSWORDS);

router.get('/', async (_req, res, next) => {
  try {
    const crosswords = await listCrosswords();
    res.json({ success: true, crosswords });
  } catch (err) {
    next(err);
  }
});

router.get('/stats/me', requireActor, async (req, res, next) => {
  try {
    const stats = await listCrosswordStatsForActor(req.actor.id, req.query?.limit);
    res.json({ success: true, stats });
  } catch (err) {
    next(err);
  }
});

router.post('/admin/login', async (req, res, next) => {
  try {
    const result = await loginLegacyOrAccount(req.body || {});
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

router.get('/admin/list', canManageCrosswords, async (req, res, next) => {
  try {
    const data = await listCrosswordsAdmin({
      q: req.query.q || '',
      difficulty: req.query.difficulty || '',
      published: req.query.published ?? '',
      page: req.query.page,
      limit: req.query.limit,
    });
    res.json({ success: true, crosswords: data.items, ...data });
  } catch (err) {
    next(err);
  }
});

/** Orqaga mos: query params bilan /admin ham ishlaydi. */
router.get('/admin', canManageCrosswords, async (req, res, next) => {
  try {
    const data = await listCrosswordsAdmin({
      q: req.query.q || '',
      difficulty: req.query.difficulty || '',
      published: req.query.published ?? '',
      page: req.query.page,
      limit: req.query.limit,
    });
    res.json({ success: true, crosswords: data.items, ...data });
  } catch (err) {
    next(err);
  }
});

router.get('/admin/:id', canManageCrosswords, async (req, res, next) => {
  try {
    const crossword = await getCrosswordAdmin(req.params.id);
    if (!crossword) return res.status(404).json({ success: false, error: 'Tabılmadı' });
    res.json({ success: true, crossword });
  } catch (err) {
    next(err);
  }
});

router.post('/admin', canManageCrosswords, async (req, res, next) => {
  try {
    const crossword = await upsertCrossword(req.body || {});
    res.status(201).json({ success: true, crossword });
  } catch (err) {
    next(err);
  }
});

router.put('/admin/:id', canManageCrosswords, async (req, res, next) => {
  try {
    const crossword = await upsertCrossword(req.body || {}, { id: req.params.id });
    res.json({ success: true, crossword });
  } catch (err) {
    next(err);
  }
});

router.delete('/admin/:id', canManageCrosswords, async (req, res, next) => {
  try {
    const result = await deleteCrossword(req.params.id);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requireActor, optionalAuth, async (req, res, next) => {
  try {
    // Mehmonlar krossvordtı kóre aladı; juwap/guess dizim talap etedi.
    const crossword = await getCrosswordPublic(req.params.id);
    if (!crossword) return res.status(404).json({ success: false, error: 'Tabılmadı' });
    res.json({ success: true, crossword });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/guess', requireActor, optionalAuth, async (req, res, next) => {
  try {
    await assertCanPlayCrossword(req.actor.id, { isAuthenticated: Boolean(req.user) });
    const result = await validateGuess(req.params.id, {
      wordIndex: req.body?.wordIndex,
      answer: req.body?.answer,
    }, { actorId: req.actor.id });
    res.json({ success: true, ...result });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
        code: err.code,
      });
    }
    next(err);
  }
});

router.post('/:id/complete', requireActor, optionalAuth, async (req, res, next) => {
  try {
    await assertCanPlayCrossword(req.actor.id, { isAuthenticated: Boolean(req.user) });
    await recordSoloCompletion(req.actor.id, req.params.id, {
      seconds: req.body?.seconds,
      score: req.body?.score,
    });
    res.json({ success: true });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
        code: err.code,
      });
    }
    next(err);
  }
});

export default router;
