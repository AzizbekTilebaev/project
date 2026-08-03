import { Router } from 'express';
import * as bilingual from '../services/bilingualDictService.js';
import * as adamAtlari from '../services/adamAtlariService.js';
import * as imla from '../services/imlaService.js';

const router = Router();

router.get('/stats', async (_req, res, next) => {
  try {
    const data = await bilingual.getDictStats();
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

router.get('/kaa-months', async (_req, res, next) => {
  try {
    const data = await bilingual.getKaaMonthNames();
    res.json({
      success: true,
      language: 'qaraqalpaqsha',
      label: 'Qaraqalpaq tilindegi anʼanavıy oy atamaları',
      data,
    });
  } catch (e) {
    next(e);
  }
});

router.get('/kaa-culture', async (_req, res, next) => {
  try {
    const data = await bilingual.getKaaCulture();
    if (!data) return res.status(404).json({ error: 'Tabılmadı' });
    res.json({ success: true, language: 'qaraqalpaqsha', data });
  } catch (e) {
    next(e);
  }
});

router.get('/uzb-kaa/search', async (req, res, next) => {
  try {
    const result = await bilingual.searchUzbKaa(req.query.q, Number(req.query.limit) || 30);
    res.json({ success: true, ...result });
  } catch (e) {
    next(e);
  }
});

router.get('/uzb-kaa', async (req, res, next) => {
  try {
    const result = await bilingual.listUzbKaa({
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 40,
      letter: req.query.letter || undefined,
    });
    res.json({ success: true, ...result });
  } catch (e) {
    next(e);
  }
});

router.get('/uzb-kaa/:id', async (req, res, next) => {
  try {
    const data = await bilingual.getUzbKaaById(req.params.id);
    if (!data) return res.status(404).json({ error: 'Tabılmadı' });
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

for (const lang of ['en', 'ru']) {
  router.get(`/${lang}/search`, async (req, res, next) => {
    try {
      const result = await bilingual.searchBilingual(lang, req.query.q, Number(req.query.limit) || 30);
      res.json({ success: true, ...result });
    } catch (e) {
      next(e);
    }
  });

  router.get(`/${lang}`, async (req, res, next) => {
    try {
      const result = await bilingual.listBilingual(lang, {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 40,
        letter: req.query.letter || undefined,
      });
      res.json({ success: true, ...result });
    } catch (e) {
      next(e);
    }
  });

  router.get(`/${lang}/:id`, async (req, res, next) => {
    try {
      const data = await bilingual.getBilingualById(lang, req.params.id);
      if (!data) return res.status(404).json({ error: 'Tabılmadı' });
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  });
}

router.get('/frazeologiya/search', async (req, res, next) => {
  try {
    const result = await bilingual.searchFrazeologiya({
      q: req.query.q || '',
      limit: Number(req.query.limit) || 50,
      offset: Number(req.query.offset) || 0,
    });
    res.json({ success: true, ...result });
  } catch (e) {
    next(e);
  }
});

router.get('/frazeologiya', async (req, res, next) => {
  try {
    const result = await bilingual.searchFrazeologiya({
      q: req.query.q || '',
      limit: Number(req.query.limit) || 50,
      offset: Number(req.query.offset) || 0,
    });
    res.json({ success: true, ...result });
  } catch (e) {
    next(e);
  }
});

router.get('/frazeologiya/:id', async (req, res, next) => {
  try {
    const data = await bilingual.getFrazeologiyaById(req.params.id);
    if (!data) return res.status(404).json({ error: 'Tabılmadı' });
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

router.get('/adam-atlari/search', async (req, res, next) => {
  try {
    const result = await adamAtlari.searchAdamAtlari({
      q: req.query.q || '',
      gender: req.query.gender || '',
      limit: Number(req.query.limit) || 50,
      offset: Number(req.query.offset) || 0,
    });
    res.json({ success: true, ...result });
  } catch (e) {
    next(e);
  }
});

router.get('/adam-atlari', async (req, res, next) => {
  try {
    const result = await adamAtlari.searchAdamAtlari({
      q: req.query.q || '',
      gender: req.query.gender || '',
      limit: Number(req.query.limit) || 50,
      offset: Number(req.query.offset) || 0,
    });
    res.json({ success: true, ...result });
  } catch (e) {
    next(e);
  }
});

router.get('/adam-atlari/:id', async (req, res, next) => {
  try {
    const data = await adamAtlari.getAdamAtariById(req.params.id);
    if (!data) return res.status(404).json({ error: 'Tabılmadı' });
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

router.get('/imla/search', async (req, res, next) => {
  try {
    const result = await imla.searchImla({
      q: req.query.q || '',
      letter: req.query.letter || '',
      source: req.query.source || '',
      limit: Number(req.query.limit) || 50,
      offset: Number(req.query.offset) || 0,
    });
    res.json({ success: true, ...result });
  } catch (e) {
    next(e);
  }
});

router.get('/imla/letters', async (req, res, next) => {
  try {
    const data = await imla.getImlaLetters(req.query.source || '');
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

router.get('/imla/sources', async (_req, res, next) => {
  try {
    const data = await imla.getImlaSourceStats();
    res.json({ success: true, data, sources: imla.IMLA_SOURCES });
  } catch (e) {
    next(e);
  }
});

router.get('/imla', async (req, res, next) => {
  try {
    const result = await imla.searchImla({
      q: req.query.q || '',
      letter: req.query.letter || '',
      source: req.query.source || '',
      limit: Number(req.query.limit) || 50,
      offset: Number(req.query.offset) || 0,
    });
    res.json({ success: true, ...result });
  } catch (e) {
    next(e);
  }
});

router.get('/imla/:id', async (req, res, next) => {
  try {
    const data = await imla.getImlaById(req.params.id);
    if (!data) return res.status(404).json({ error: 'Tabılmadı' });
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

router.get('/links/:titleId', async (req, res, next) => {
  try {
    const soz = req.query.soz || '';
    const data = await bilingual.getLinksForTitle(req.params.titleId, soz);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

export default router;
