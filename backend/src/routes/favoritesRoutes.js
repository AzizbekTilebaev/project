import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  addFavorite,
  clearFavorites,
  listFavorites,
  removeFavorite,
  syncFavorites,
} from '../services/favoritesService.js';

const router = Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const items = await listFavorites(req.user.id);
    res.json({ success: true, items, count: items.length });
  } catch (err) {
    next(err);
  }
});

router.post('/sync', requireAuth, async (req, res, next) => {
  try {
    const items = await syncFavorites(req.user.id, req.body?.items || []);
    res.json({ success: true, items, count: items.length });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    await addFavorite(req.user.id, req.body || {});
    const items = await listFavorites(req.user.id);
    res.status(201).json({ success: true, items, count: items.length });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
});

router.delete('/:titleId', requireAuth, async (req, res, next) => {
  try {
    await removeFavorite(req.user.id, req.params.titleId);
    const items = await listFavorites(req.user.id);
    res.json({ success: true, items, count: items.length });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
});

router.delete('/', requireAuth, async (req, res, next) => {
  try {
    await clearFavorites(req.user.id);
    res.json({ success: true, items: [], count: 0 });
  } catch (err) {
    next(err);
  }
});

export default router;
