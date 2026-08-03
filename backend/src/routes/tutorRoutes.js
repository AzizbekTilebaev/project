import { Router } from 'express';
import { requireActor } from '../middleware/actor.js';
import {
  getOrCreateDailySession,
  answerTutorItem,
  getMistakes,
  updateTutorPlan,
  updateTutorSchedulePrefs,
  getReminderStatus,
} from '../services/tutorService.js';

const router = Router();

router.get('/daily', requireActor, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    const session = await getOrCreateDailySession(req.actor.id, {
      timezoneOffsetMinutes: Number(req.query?.tzOffset) || 0,
      force: String(req.query?.force || '') === '1',
    });
    res.json({ success: true, ...session });
  } catch (err) {
    next(err);
  }
});

router.post('/daily/answer', requireActor, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    const result = await answerTutorItem(req.actor.id, {
      sessionId: req.body?.sessionId,
      mistakeId: req.body?.mistakeId,
      optionIndex: req.body?.optionIndex,
      answer: req.body?.answer ?? req.body?.text,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
});

router.put('/daily/plan', requireActor, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    const session = await updateTutorPlan(req.actor.id, {
      sessionId: req.body?.sessionId,
      orderedMistakeIds: req.body?.orderedMistakeIds,
      scheduledTime: req.body?.scheduledTime,
      scheduledDays: req.body?.scheduledDays,
    });
    res.json({ success: true, ...session });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
});

router.put('/daily/schedule', requireActor, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    const prefs = await updateTutorSchedulePrefs(req.actor.id, {
      scheduledTime: req.body?.scheduledTime,
      scheduledDays: req.body?.scheduledDays,
    });
    res.json({ success: true, ...prefs });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
});

router.get('/mistakes', requireActor, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    const data = await getMistakes(req.actor.id);
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
});

router.get('/reminder', requireActor, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    const reminder = await getReminderStatus(req.actor.id, {
      timezoneOffsetMinutes: Number(req.query?.tzOffset) || 0,
    });
    res.json({ success: true, reminder });
  } catch (err) {
    next(err);
  }
});

export default router;
