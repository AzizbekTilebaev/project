import { Router } from 'express';
import { requireActor } from '../middleware/actor.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { resolveActorScope } from '../services/quotaService.js';
import { getMyActivity, getSiteStats, recordHeartbeat } from '../services/statsService.js';

const router = Router();

router.get('/me/activity', requireActor, optionalAuth, async (req, res, next) => {
  try {
    const scope = await resolveActorScope(req.actor.id, req.user?.id || null);
    const data = await getMyActivity(scope, {
      days: req.query?.days,
      period: req.query?.period,
    });
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
});

/** To‘liq sayt statistikasi — faqat auth. Mehmonlarga faqat marketing preview. */
router.get('/site', optionalAuth, async (req, res, next) => {
  try {
    const data = await getSiteStats({ period: req.query?.period });
    if (!req.user) {
      return res.json({
        success: true,
        preview: true,
        authRequired: true,
        // Soft social proof (marketing) — batafsil exitFeedback/events yashirin
        todayActors: data.todayActors,
        activeActors: data.activeActors,
        period: data.period,
      });
    }
    res.json({ success: true, preview: false, ...data });
  } catch (err) {
    next(err);
  }
});

router.post('/heartbeat', requireActor, async (req, res, next) => {
  try {
    await recordHeartbeat(req.actor.id, {
      surface: req.body?.surface,
      durationMs: req.body?.durationMs,
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
