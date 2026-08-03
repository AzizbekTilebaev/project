import { Router } from 'express';
import { optionalActor } from '../middleware/actor.js';
import { optionalAuth } from '../middleware/auth.js';
import { saveExitFeedback } from '../services/statsService.js';

const router = Router();

router.post('/exit', optionalActor, optionalAuth, async (req, res, next) => {
  try {
    await saveExitFeedback({
      actorId: req.actor?.id || null,
      userId: req.user?.id || null,
      helpful: Boolean(req.body?.helpful),
      note: req.body?.note || '',
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
