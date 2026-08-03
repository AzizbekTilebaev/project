import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  addRecentWord,
  clearRecentWords,
  listRecentWords,
  syncRecentWords,
} from '../services/recentWordsService.js';

const router = Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const items = await listRecentWords(req.user.id);
    res.json({ success: true, items, count: items.length });
  } catch (err) {
    next(err);
  }
});

router.post('/sync', requireAuth, async (req, res, next) => {
  try {
    const items = await syncRecentWords(req.user.id, req.body?.items || []);
    res.json({ success: true, items, count: items.length });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    await addRecentWord(req.user.id, req.body || {});
    const items = await listRecentWords(req.user.id);
    res.status(201).json({ success: true, items, count: items.length });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
    next(err);
  }
});

router.delete('/', requireAuth, async (req, res, next) => {
  try {
    await clearRecentWords(req.user.id);
    res.json({ success: true, items: [], count: 0 });
  } catch (err) {
    next(err);
  }
});

export default router;

