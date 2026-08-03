import { Router } from 'express';
import { requireActor } from '../middleware/actor.js';
import { optionalAuth } from '../middleware/auth.js';
import {
  buildQuotaStatus,
  getActorQuotaRow,
  incrementWordViews,
  assertCanViewWord,
} from '../services/quotaService.js';

const router = Router();

router.get('/me', requireActor, optionalAuth, async (req, res, next) => {
  try {
    const row = await getActorQuotaRow(req.actor.id);
    const status = buildQuotaStatus(row, { isAuthenticated: Boolean(req.user) });
    res.json({ success: true, ...status });
  } catch (err) {
    next(err);
  }
});

router.post('/word-view', requireActor, optionalAuth, async (req, res, next) => {
  try {
    await assertCanViewWord(req.actor.id, { isAuthenticated: Boolean(req.user) });
    const status = await incrementWordViews(req.actor.id);
    res.json({ success: true, ...status, wordId: req.body?.wordId || null });
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
