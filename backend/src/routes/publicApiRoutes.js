import { Router } from 'express';
import { requireApiKey, createApiClient } from '../middleware/apiKey.js';
import { listQuizzes, getQuizPublic } from '../services/quizService.js';
import TusindirmeService from '../services/tusindirmeService.js';
import { listImmersionForWord } from '../services/immersionService.js';
import { pools } from '../config/db.js';
import { requireImportKey } from '../middleware/security.js';

const db = pools.statistika;
const router = Router();
const dict = new TusindirmeService();

router.get('/manifest', async (_req, res, next) => {
  try {
    const [[row]] = await db.query(`SELECT * FROM content_manifest WHERE id = 1`);
    res.json({
      success: true,
      schemaVersion: row?.schema_version || '2.0.0',
      contentVersion: row?.content_version || 'unknown',
      notes: row?.notes || null,
      updatedAt: row?.updated_at || null,
    });
  } catch (err) {
    next(err);
  }
});

/** Owner/import key can mint partner keys (no partner API key required) */
router.post('/clients', requireImportKey, async (req, res, next) => {
  try {
    const client = await createApiClient(req.body || {});
    res.status(201).json({ success: true, client });
  } catch (err) {
    next(err);
  }
});

router.use(requireApiKey);

router.get('/dictionary/search', async (req, res, next) => {
  try {
    const result = await dict.searchSoz(req.query.q, Number(req.query.limit) || 20);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

router.get('/dictionary/words/:id', async (req, res, next) => {
  try {
    const word = await dict.getSozById(req.params.id);
    if (!word) return res.status(404).json({ success: false, error: 'Tabılmadı' });
    const immersion = await listImmersionForWord(req.params.id).catch(() => []);
    res.json({ success: true, word, immersion });
  } catch (err) {
    next(err);
  }
});

router.get('/quizzes', async (_req, res, next) => {
  try {
    const quizzes = await listQuizzes();
    res.json({ success: true, quizzes });
  } catch (err) {
    next(err);
  }
});

router.get('/quizzes/:id', async (req, res, next) => {
  try {
    const quiz = await getQuizPublic(req.params.id);
    if (!quiz) return res.status(404).json({ success: false, error: 'Tabılmadı' });
    res.json({ success: true, quiz });
  } catch (err) {
    next(err);
  }
});

export default router;
