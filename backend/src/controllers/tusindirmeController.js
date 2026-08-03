import TusindirmeGetServices from '../services/tusindirmeService.js';
import resHelp from '../utils/resHelper.js';
import { validateTitlesArray } from '../validators/title.validator.js';
import { clampInt } from '../middleware/security.js';
import {
  listPendingSuggestions,
  listGhostTitles,
  activateGhostTitles,
  updateDescriptionText,
  updateExampleText,
  updateIdiomPhrase,
  updateIdiomDescText,
  createExample as createExampleRecord,
  deleteExample as deleteExampleRecord,
  createIdiom as createIdiomRecord,
  deleteIdiom as deleteIdiomRecord,
  createDescriptionForTitle,
  deleteDescriptionRecord,
  createTitleWithSense,
  renameTitle as renameTitleRecord,
  deactivateTitle as deactivateTitleRecord,
  reactivateTitle as reactivateTitleRecord,
  addSenseSynonym as addSenseSynonymRecord,
  removeSenseSynonym as removeSenseSynonymRecord,
  addSenseAntonym as addSenseAntonymRecord,
  removeSenseAntonym as removeSenseAntonymRecord,
  addCompoundComponent as addCompoundComponentRecord,
  removeCompound as removeCompoundRecord,
  addWordRelation as addWordRelationRecord,
  removeWordRelation as removeWordRelationRecord,
  createSuggestion,
  voteSuggestion,
  moderateSuggestion,
  listModeratorSuggestions as listModeratorSuggestionsService,
  listMySuggestions as listMySuggestionsService,
} from '../services/communityService.js';
const response = new resHelp();


class TusindirmeController {
  getServices = new TusindirmeGetServices();

  // GET /api/tusindirme/sozler?page=1&limit=50&pos=&theme=
  getAllSozler = async (req, res, next) => {
    try {
      const page = clampInt(req.query.page, { min: 1, max: 10000, fallback: 1 });
      const limit = clampInt(req.query.limit, { min: 1, max: 100, fallback: 50 });
      const pos = typeof req.query.pos === 'string' ? req.query.pos.slice(0, 32) : undefined;
      const theme = typeof req.query.theme === 'string' ? req.query.theme.slice(0, 32) : undefined;
      const result = await this.getServices.getAllSozler(page, limit, { pos, theme });
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  };

  // GET /api/tusindirme/pos
  getPosList = async (req, res, next) => {
    try {
      const result = await this.getServices.getPosList();
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  };

  // GET /api/tusindirme/themes
  getThemeList = async (req, res, next) => {
    try {
      const result = await this.getServices.getThemeList();
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  };

  // GET /api/tusindirme/dashboard
  getDashboard = async (req, res, next) => {
    try {
      const data = await this.getServices.getDashboard();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  // GET /api/tusindirme/soz/:id
  getSozById = async (req, res, next) => {
    try {
      const { id } = req.params;
      const word = await this.getServices.getSozById(id);
      if (!word) {
        return res.status(404).json({ success: false, message: 'Sóz tabılmadı' });
      }
      const payload = { success: true, data: word };
      if (req.wordQuota) payload.quota = req.wordQuota;
      res.json(payload);
    } catch (err) {
      next(err);
    }
  };

  // GET /api/tusindirme/alphabet
  getAlphabet = async (req, res, next) => {
    try {
      const data = await this.getServices.getAlphabet();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };
  // GET /api/tusindirme/search?q=...
  searchSoz = async (req, res, next) => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q.slice(0, 100) : '';
      const limit = clampInt(req.query.limit, { min: 1, max: 50, fallback: 20 });
      const result = await this.getServices.searchSoz(q, limit, req.ip, req.user?.id);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  };

  // GET /api/tusindirme/curated — premium 50 curated words
  getCurated = async (req, res, next) => {
    try {
      const result = await this.getServices.getCurated();
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  };

  // GET /api/tusindirme/letter/:letter?page=1&limit=50
  getSozlerByLetter = async (req, res, next) => {
    try {
      const letter = String(req.params.letter || '').slice(0, 4);
      const page = clampInt(req.query.page, { min: 1, max: 10000, fallback: 1 });
      const limit = clampInt(req.query.limit, { min: 1, max: 100, fallback: 50 });
      const result = await this.getServices.getSozlerByLetter(letter, page, limit);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  };

  // GET /api/tusindirme/top?type=search&limit=100
  getTopSozler = async (req, res, next) => {
    try {
      const type = req.query.type === 'view' ? 'view' : 'search';
      const limit = clampInt(req.query.limit, { min: 1, max: 100, fallback: 50 });
      const result = await this.getServices.getTopSozler(type, limit);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  };

  // GET /api/tusindirme/word-of-day
  getWordOfDay = async (req, res, next) => {
    try {
      const word = await this.getServices.getWordOfDay();
      if (!word) {
        return res.status(404).json({ success: false, message: 'Sóz tabılmadı' });
      }
      res.json({ success: true, data: word });
    } catch (err) {
      next(err);
    }
  };

  getWordOfDayCheckin = async (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store');
      const { resolveActorScope } = await import('../services/quotaService.js');
      const { getWordOfDayCheckinStatus } = await import('../services/wordOfDayCheckinService.js');
      const actorIds = await resolveActorScope(req.actor.id, req.user?.id || null);
      const checkin = await getWordOfDayCheckinStatus(req.actor.id, {
        timezoneOffsetMinutes: Number(req.query?.tzOffset) || 0,
        actorIds,
      });
      res.json({ success: true, checkin });
    } catch (err) {
      next(err);
    }
  };

  claimWordOfDayCheckin = async (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store');
      const { resolveActorScope } = await import('../services/quotaService.js');
      const { claimWordOfDay } = await import('../services/wordOfDayCheckinService.js');
      const actorIds = await resolveActorScope(req.actor.id, req.user?.id || null);
      const result = await claimWordOfDay(req.actor.id, {
        timezoneOffsetMinutes: Number(req.body?.tzOffset ?? req.query?.tzOffset) || 0,
        actorIds,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  };

  claimComboChest = async (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store');
      const chestService = await import('../services/comboChestService.js');
      const result = await chestService.claimComboChest(
        req.actor.id,
        req.body?.chestId || req.params?.chestId
      );
      res.json({ success: true, ...result });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  };

  // GET /api/tusindirme/quiz — legacy without answers disabled for clients
  getQuiz = async (req, res, next) => {
    try {
      // Prefer server-bound rounds via POST /quiz/start
      res.set('Cache-Control', 'no-store');
      const count = clampInt(req.query.count, { min: 3, max: 20, fallback: 10 });
      if (!req.actor?.id) {
        return res.status(400).json({
          success: false,
          message: 'X-Anonymous-Id kerek. POST /quiz/start qollanıń.',
        });
      }
      const { startDictRound } = await import('../services/dictGameService.js');
      const result = await startDictRound(req.actor.id, count);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  };

  startDictQuiz = async (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store');
      const count = clampInt(req.body?.count ?? req.query.count, {
        min: 3,
        max: 20,
        fallback: 10,
      });
      const titleIds = Array.isArray(req.body?.titleIds)
        ? req.body.titleIds.map(String).filter(Boolean).slice(0, 40)
        : [];
      const source = String(req.body?.source || '')
        .trim()
        .toLowerCase()
        .slice(0, 32);
      const { startDictRound } = await import('../services/dictGameService.js');
      const result = await startDictRound(req.actor.id, count, { titleIds, source });
      res.status(201).json({
        success: true,
        ...result,
        source: source || (titleIds.length ? 'custom' : 'all'),
      });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  };

  checkDictQuiz = async (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store');
      const { checkDictAnswer } = await import('../services/dictGameService.js');
      const result = await checkDictAnswer(req.actor.id, req.params.roundId, {
        questionId: req.body?.questionId,
        optionIndex: req.body?.optionIndex,
        answer: req.body?.answer,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  };

  answerDictQuiz = async (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store');
      const { answerDictRound } = await import('../services/dictGameService.js');
      const result = await answerDictRound(req.actor.id, req.params.roundId, req.body?.answers);
      res.json({ success: true, ...result });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  };

  dictQuizHistory = async (req, res, next) => {
    try {
      const { listDictRoundsForActor } = await import('../services/dictGameService.js');
      const rounds = await listDictRoundsForActor(req.actor.id, req.query?.limit);
      res.json({ success: true, rounds });
    } catch (err) {
      next(err);
    }
  };

  // GET /api/tusindirme/random
  getRandomSoz = async (req, res, next) => {
    try {
      const word = await this.getServices.getRandomSoz();
      if (!word) {
        return res.status(404).json({ success: false, message: 'Hesh qanday sóz joq' });
      }
      res.json({ success: true, data: word });
    } catch (err) {
      next(err);
    }
  };



  importNested = async (req, res, next) => {
    try {
      const items = req.body;
      if (!Array.isArray(items) || items.length === 0 || items.length > 200) {
        return response.error(res, 'Import dizimi 1–200 elementten ibarat bolıwı kerek', 400);
      }
      const isValid = validateTitlesArray(items);
      if (!isValid) {
        return response.error(res, 'validatsiya qatesi', 400, validateTitlesArray.errors);
      }
      const result = await this.getServices.insertNested(items);
      return response.success(res, result, 'import tamamlandi');
    } catch (err) {
      next(err);
    }
  };

  listSuggestions = async (req, res, next) => {
    try {
      const rows = await listPendingSuggestions({
        descriptionId: req.query.descriptionId || null,
        mainTitleId: req.query.mainTitleId || null,
        limit: req.query.limit,
        viewerActorKey: req.actor?.key || null,
      });
      res.json({ success: true, suggestions: rows });
    } catch (err) {
      next(err);
    }
  };

  listMySuggestions = async (req, res, next) => {
    try {
      if (!req.actor?.key) {
        return res.status(400).json({ success: false, message: 'X-Anonymous-Id kerek' });
      }
      const items = await listMySuggestionsService({
        actorKey: req.actor.key,
        status: req.query.status || 'all',
        limit: req.query.limit,
      });
      res.json({ success: true, suggestions: items, count: items.length });
    } catch (err) {
      next(err);
    }
  };

  listModeratorSuggestions = async (req, res, next) => {
    try {
      const data = await listModeratorSuggestionsService({
        status: req.query.status || 'pending',
        type: req.query.type || '',
        page: req.query.page,
        limit: req.query.limit,
      });
      res.json({ success: true, ...data });
    } catch (err) {
      next(err);
    }
  };

  createSuggestion = async (req, res, next) => {
    try {
      if (!req.actor?.key) {
        return res.status(400).json({ success: false, message: 'X-Anonymous-Id kerek' });
      }
      const result = await createSuggestion(req.actor.key, req.body);
      res.status(201).json({ success: true, ...result });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  };

  voteSuggestion = async (req, res, next) => {
    try {
      if (!req.actor?.key) {
        return res.status(400).json({ success: false, message: 'X-Anonymous-Id kerek' });
      }
      const result = await voteSuggestion(req.actor.key, req.params.id, req.body?.vote);
      res.json({ success: true, ...result });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  };

  moderateSuggestion = async (req, res, next) => {
    try {
      const result = await moderateSuggestion(req.params.id, {
        approve: Boolean(req.body?.approve),
        note: req.body?.note || null,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  };

  listGhostTitles = async (req, res, next) => {
    try {
      const result = await listGhostTitles({
        page: req.query.page,
        limit: req.query.limit,
        q: req.query.q || '',
      });
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  };

  activateGhostTitles = async (req, res, next) => {
    try {
      const result = await activateGhostTitles(req.body?.titleIds);
      if (result.activated > 0) {
        this.getServices.invalidateCaches();
      }
      res.json({ success: true, ...result });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  };

  updateDescription = async (req, res, next) => {
    try {
      const body = req.body || {};
      const result = await updateDescriptionText(req.params.id, {
        description: 'description' in body ? body.description : undefined,
        category: 'category' in body ? body.category : undefined,
        activate: Boolean(body.activate),
      });
      if (result.activated) {
        this.getServices.invalidateCaches();
      }
      res.json({ success: true, ...result });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  };

  updateExample = async (req, res, next) => {
    try {
      const result = await updateExampleText(req.params.id, { example: req.body?.example });
      res.json({ success: true, ...result });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  };

  updateIdiom = async (req, res, next) => {
    try {
      const result = await updateIdiomPhrase(req.params.id, { phrase: req.body?.phrase });
      res.json({ success: true, ...result });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  };

  updateIdiomDesc = async (req, res, next) => {
    try {
      const result = await updateIdiomDescText(req.params.id, {
        description: req.body?.description,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  };

  createExample = async (req, res, next) => {
    try {
      const result = await createExampleRecord(req.params.id, {
        example: req.body?.example,
        author: req.body?.author ?? null,
      });
      res.status(201).json({ success: true, ...result });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  };

  deleteExample = async (req, res, next) => {
    try {
      const result = await deleteExampleRecord(req.params.id);
      res.json({ success: true, ...result });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  };

  createIdiom = async (req, res, next) => {
    try {
      const result = await createIdiomRecord(req.params.id, {
        phrase: req.body?.phrase,
        description: req.body?.description ?? null,
      });
      res.status(201).json({ success: true, ...result });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  };

  deleteIdiom = async (req, res, next) => {
    try {
      const result = await deleteIdiomRecord(req.params.id);
      res.json({ success: true, ...result });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  };

  createDescription = async (req, res, next) => {
    try {
      const result = await createDescriptionForTitle(req.params.id, {
        description: req.body?.description,
        category: req.body?.category ?? null,
      });
      this.getServices.invalidateCaches();
      res.status(201).json({ success: true, ...result });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  };

  deleteDescription = async (req, res, next) => {
    try {
      const result = await deleteDescriptionRecord(req.params.id);
      this.getServices.invalidateCaches();
      res.json({ success: true, ...result });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  };

  createTitle = async (req, res, next) => {
    try {
      const result = await createTitleWithSense({
        word: req.body?.word,
        description: req.body?.description,
        category: req.body?.category ?? null,
      });
      this.getServices.invalidateCaches();
      res.status(201).json({ success: true, ...result });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({
          success: false,
          message: err.message,
          ...(err.titleId ? { titleId: err.titleId, word: err.word } : {}),
        });
      }
      next(err);
    }
  };

  renameTitle = async (req, res, next) => {
    try {
      const result = await renameTitleRecord(req.params.id, { word: req.body?.word });
      if (result.changed) {
        this.getServices.invalidateCaches();
      }
      res.json({ success: true, ...result });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({
          success: false,
          message: err.message,
          ...(err.titleId ? { titleId: err.titleId, word: err.word } : {}),
        });
      }
      next(err);
    }
  };

  deactivateTitle = async (req, res, next) => {
    try {
      const result = await deactivateTitleRecord(req.params.id);
      if (result.deactivated) {
        this.getServices.invalidateCaches();
      }
      res.json({ success: true, ...result });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  };

  reactivateTitle = async (req, res, next) => {
    try {
      const result = await reactivateTitleRecord(req.params.id);
      if (result.activated) {
        this.getServices.invalidateCaches();
      }
      res.json({ success: true, ...result });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  };

  addSenseSynonym = async (req, res, next) => {
    try {
      const result = await addSenseSynonymRecord(req.body?.descriptionId, { word: req.body?.word });
      res.status(201).json({ success: true, ...result });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  };

  removeSenseSynonym = async (req, res, next) => {
    try {
      const result = await removeSenseSynonymRecord(
        req.body?.descriptionId,
        req.body?.targetDescriptionId
      );
      res.json({ success: true, ...result });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  };

  addSenseAntonym = async (req, res, next) => {
    try {
      const result = await addSenseAntonymRecord(req.body?.descriptionId, { word: req.body?.word });
      res.status(201).json({ success: true, ...result });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  };

  removeSenseAntonym = async (req, res, next) => {
    try {
      const result = await removeSenseAntonymRecord(
        req.body?.descriptionId,
        req.body?.targetDescriptionId
      );
      res.json({ success: true, ...result });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  };

  addCompound = async (req, res, next) => {
    try {
      const result = await addCompoundComponentRecord(req.body?.mainTitleId, { word: req.body?.word });
      res.status(201).json({ success: true, ...result });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  };

  removeCompound = async (req, res, next) => {
    try {
      const result = await removeCompoundRecord(req.params.id);
      res.json({ success: true, ...result });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  };

  addWordRelation = async (req, res, next) => {
    try {
      const result = await addWordRelationRecord(req.body?.titleId, {
        word: req.body?.word,
        type: req.body?.type,
      });
      res.status(201).json({ success: true, ...result });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  };

  removeWordRelation = async (req, res, next) => {
    try {
      const result = await removeWordRelationRecord(req.params.id);
      res.json({ success: true, ...result });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  };

}

export default TusindirmeController;