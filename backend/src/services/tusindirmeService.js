import TusindirmeModel from '../models/tusindirme.model.js';
import { pools } from '../config/db.js';
import searchFold from '../utils/searchFold.js';
import { levenshtein, maxEditDistance } from '../utils/editDistance.js';
import IdGenerator from '../utils/id.generate.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  POS_LIST,
  THEME_LIST,
  getPosBySlug,
  getThemeBySlug,
} from '../config/dictionaryTaxonomy.js';
import {
  getSenseRelationsForTitle,
  getCompoundsForTitle,
} from './communityService.js';
import { parseNumberedSenses } from '../utils/glossStructure.js';

const db = pools.tusindirme;
const idGen = new IdGenerator();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CURATED_META = path.resolve(__dirname, '../../../fordata/curated/premium-50.meta.json');
const CURATED_IMPORT = path.resolve(__dirname, '../../../fordata/curated/premium-50.import.json');

// Havola-yozuv (к./қ. = «qara» / «қараң») ni aniqlash: {target} yoki null
// Qabıl etiledi:
//   cat=к.|қ. + nishon
//   "к. фантастикалық." / "қ. егер"
//   "к фантастикалық." (nuqtasız OCR)
function detectReference(category, description) {
  const cat = (category || '').trim().toLowerCase();
  let desc = (description || '').trim();
  if (!desc || desc.length > 60) return null;

  // qavs ichidagi variantlarni olib tashlash: "(ӘГӘРКИ) қ. егер де."
  const cleaned = desc.replace(/\([^)]*\)/g, '').trim();

  // "к е л." / "к ел." = кел. (POS OCR) — havola emes
  if (/^[кқ]\s+е\s*л\s*\./iu.test(cleaned)) return null;
  // "қ ағыў фейилиниң..." = grammatika — havola emes
  if (/^[кқ]\s+\S+\s+фейил/iu.test(cleaned)) return null;

  const isRefCat = cat === 'к.' || cat === 'қ.';
  const refPrefix = cleaned.match(/^(?:[кқ]\.\s+|[кқ]\s+|қараң[\s.:]+|каран[\s.:]+|qarań[\s.:]+)/iu);
  const startsWithRef = Boolean(refPrefix);
  if (!isRefCat && !startsWithRef) return null;

  let target = cleaned;
  if (refPrefix) target = cleaned.slice(refPrefix[0].length);
  target = cleanOcrReference(target.replace(/\.+$/u, '').trim());

  // nishon — qisqa so'z/ibora bo'lishi kerak (to'liq ta'rif emas)
  if (!target || target.length > 30 || target.split(/\s+/).length > 3) return null;
  // POS qoldiqlari
  if (/^(ат|ф|кел|рәў|алм|сан|лин)\.?$/iu.test(target)) return null;
  return target;
}

// Grammatik havola: "азаплаў фейилиниң өзлик дәрежеси." -> { base, form }
// OCR variantlari (өзғелик, дөрежеси, фейилинин ...) ham qamrab olinadi
const GRAMMAR_REF_RE =
  /^(.{2,40}?)[,]?\s+фейил(?:лер)?\S*\s+([а-яёәөүғқңҳіў]+)\s+(д[әөa]реж\S*)/iu;

const FORM_LABELS = new Map([
  ['өзгелик', 'өзгелик дәрежеси'],
  ['өзғелик', 'өзгелик дәрежеси'],
  ['әзгелик', 'өзгелик дәрежеси'],
  ['өзгелек', 'өзгелик дәрежеси'],
  ['шериклик', 'шериклик дәрежеси'],
  ['өзлик', 'өзлик дәрежеси'],
  ['озлик', 'өзлик дәрежеси'],
  ['белгисиз', 'белгисиз дәрежеси'],
  ['белғисиз', 'белгисиз дәрежеси'],
  ['ерксиз', 'ериксиз дәрежеси'],
  ['ериксиз', 'ериксиз дәрежеси'],
  ['түп', 'түп дәрежеси'],
]);

function cleanOcrReference(value) {
  const chars = [...String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()];
  for (let index = 0; index < chars.length - 1; index++) {
    const current = chars[index];
    const next = chars[index + 1];
    if (
      current !== current.toLocaleLowerCase('kk') &&
      next === next.toLocaleLowerCase('kk') &&
      current.toLocaleLowerCase('kk') === next.toLocaleLowerCase('kk')
    ) {
      if (index === 0) {
        chars.splice(index + 1, 1);
      } else {
        chars.splice(index, 1);
        index--;
      }
    }
  }
  return chars.join('');
}

function detectGrammarReference(description) {
  const desc = (description || '').trim();
  if (!desc || desc.length > 220) return null;
  const m = desc.match(GRAMMAR_REF_RE);
  if (!m) return null;

  // bosh so'z: rim raqamlarini olib tashlab lug'atdan izlaymiz
  let base = cleanOcrReference(m[1]).replace(/[,:.]+$/g, '');
  const baseClean = base.replace(/\s+[IVX\u0406\u0425]{1,4}(\s+[IVX\u0406\u0425]{1,4})*$/u, '').trim();
  if (!baseClean || baseClean.split(/\s+/).length > 2) return null;

  const formKey = m[2].toLocaleLowerCase('kk').replace(/[^а-яәөүғқңҳі]/gu, '');
  const form = FORM_LABELS.get(formKey) || `${m[2]} дәрежеси`;

  return { base: baseClean, baseDisplay: base, form };
}

// normalized variantlar: kirill/lotin rim raqamlari va к/қ almashinuvi
function normalizedVariants(word) {
  const base = word.toLocaleLowerCase('kk').trim();
  const variants = new Set([base]);
  variants.add(base.replace(/i/g, '\u0456'));
  variants.add(base.replace(/\u0456/g, 'i'));
  for (const v of [...variants]) {
    variants.add(v.replace(/к/g, '\u049B'));
    variants.add(v.replace(/\u049B/g, 'к'));
  }
  return [...variants];
}

// OCR imlo farqlarini yutish (SQL dagi FOLD bilan bir xil)
function foldKk(word) {
  return word
    .toLocaleLowerCase('kk')
    .trim()
    .replace(/\u049B/g, 'к')
    .replace(/\u0493/g, 'г')
    .replace(/\u04A3/g, 'н')
    .replace(/[\u045E\u04AF\u04B1]/g, 'у')
    .replace(/\u04B3/g, 'х')
    .replace(/\u0456/g, 'i');
}

class TusindirmeService {
  model = new TusindirmeModel();
  #taxonomyCache = {
    pos: { at: 0, data: null },
    themes: { at: 0, data: null },
  };
  #TAXONOMY_TTL_MS = 5 * 60_000;
  #wordOfDayCache = { date: null, data: null };
  #curatedCache = { at: 0, data: null };
  static #CURATED_TTL_MS = 5 * 60 * 1000;

  //Hamme sozler (paginatsiya) — ixtiyoriy pos/theme filtri
  getAllSozler = async (page = 1, limit = 50, { pos, theme } = {}) => {
    const offset = (page - 1) * limit;
    const from = offset + 1;
    const to = offset + limit;
    const range = `${from}-${to}`;

    if (pos) {
      if (!getPosBySlug(pos)) {
        const err = new Error('Nádurıs sóz túrkimi');
        err.statusCode = 400;
        throw err;
      }
      const [data, total] = await Promise.all([
        this.model.getSozlerByPos(pos, limit, offset),
        this.model.getCountByPos(pos),
      ]);
      return {
        page, limit, range, total,
        totalPages: Math.ceil(total / limit) || 0,
        filter: { type: 'pos', value: pos },
        data,
      };
    }

    if (theme) {
      if (!getThemeBySlug(theme)) {
        const err = new Error('Nádurıs mavzu');
        err.statusCode = 400;
        throw err;
      }
      const [data, total] = await Promise.all([
        this.model.getSozlerByTheme(theme, limit, offset),
        this.model.getCountByTheme(theme),
      ]);
      return {
        page, limit, range, total,
        totalPages: Math.ceil(total / limit) || 0,
        filter: { type: 'theme', value: theme },
        data,
      };
    }

    const [data, total] = await Promise.all([
      this.model.getSozler(limit, offset),
      this.model.getTotalSozCount(),
    ]);
    return {
      page, limit, range, total,
      totalPages: Math.ceil(total / limit) || 0,
      data,
    };
  };

  getPosList = async () => {
    const cached = this.#taxonomyCache.pos;
    if (cached.data && Date.now() - cached.at < this.#TAXONOMY_TTL_MS) {
      return cached.data;
    }
    const stats = await this.model.getPosStats();
    const data = {
      data: stats,
      meta: POS_LIST.map(({ slug, label }) => ({ slug, label })),
    };
    this.#taxonomyCache.pos = { at: Date.now(), data };
    return data;
  };

  getThemeList = async () => {
    const cached = this.#taxonomyCache.themes;
    if (cached.data && Date.now() - cached.at < this.#TAXONOMY_TTL_MS) {
      return cached.data;
    }
    const stats = await this.model.getThemeStats();
    const data = {
      data: stats,
      meta: THEME_LIST.map(({ slug, label, blurb }) => ({ slug, label, blurb })),
    };
    this.#taxonomyCache.themes = { at: Date.now(), data };
    return data;
  };

  #dashboardCache = { at: 0, data: null };
  #DASHBOARD_TTL_MS = 60_000;

  invalidateCaches = () => {
    this.#dashboardCache = { at: 0, data: null };
    this.#taxonomyCache = {
      pos: { at: 0, data: null },
      themes: { at: 0, data: null },
    };
    this.#wordOfDayCache = { date: null, data: null };
  };

  getDashboard = async () => {
    const now = Date.now();
    if (this.#dashboardCache.data && now - this.#dashboardCache.at < this.#DASHBOARD_TTL_MS) {
      return this.#dashboardCache.data;
    }

    const [alphabet, pos, themes, totalWords, wordOfDay, topWords] = await Promise.all([
      this.model.getAlphabetStats(),
      this.model.getPosStats(),
      this.model.getThemeStats(),
      this.model.getTotalSozCount(),
      this.getWordOfDay().catch(() => null),
      this.model.getTopSozler('view', 8).catch(() => []),
    ]);
    const data = {
      totalWords,
      alphabet,
      pos,
      themes,
      wordOfDay,
      topWords,
    };
    this.#dashboardCache = { at: now, data };
    return data;
  };

  // Bir title uchun to'liq ma'nolar (misollar, frazeologizmlar, havolalar bilan)
  buildSenses = async (id, resolvedTargets = new Map()) => {
      const aniqlamalar = await this.model.getAniqlamalarBySozId(id);
     // 2. aniqlamalardin idlarin aliw.
        const aniqlamaIds = aniqlamalar.map(a => a.id);
        const examples = await this.model.getMisallarByAniqlamaId(aniqlamaIds)

        // 4.misallardi aniqlama id boyins sortlaw
        const misallarMap = {};
        for (const m of examples) {
          if (!misallarMap[m.descriptions_id]) misallarMap[m.descriptions_id] = [];
          misallarMap[m.descriptions_id].push(m);

        }
              // 5. Har bir aniqlamaga misallardi qosiw
        for (const a of aniqlamalar) {
          a.examples = misallarMap[a.id] || []; // misal bolmasa bos array
        }

        try {
          const { linkExampleAuthors } = await import('./writerLinkService.js');
          const allEx = aniqlamalar.flatMap((a) => a.examples || []);
          const linked = await linkExampleAuthors(allEx);
          const byId = new Map(linked.map((ex) => [ex.id, ex]));
          for (const a of aniqlamalar) {
            a.examples = (a.examples || []).map((ex) => byId.get(ex.id) || ex);
          }
        } catch (err) {
          console.warn('[buildSenses] author link skipped:', err.message);
        }

        const idioms = await this.model.getIdioms(aniqlamaIds);
        const idiomIds = idioms.map(a => a.id);
        const idiomDescs = await this.model.getIdiomDesc(idiomIds);

        const idiomDescMap = {};
        for (const d of idiomDescs) {
          if (!idiomDescMap[d.idioms_id]) idiomDescMap[d.idioms_id] = [];
          idiomDescMap[d.idioms_id].push(d);
        }
        for (const idm of idioms) {
          idm.descriptions = idiomDescMap[idm.id] || [];
        }

        const idiomsMap = {};
        for (const idm of idioms) {
          const key = idm.descriptions_id;
          if (!idiomsMap[key]) idiomsMap[key] = [];
          idiomsMap[key].push(idm);
        }
        for (const a of aniqlamalar) {
          a.idioms = idiomsMap[a.id] || [];
        }

        // Legacy: bir description ichida "1. … 2. … 3. …" qolgan bo'lsa — UI da alohida ma'nolarga ajratish
        const expanded = [];
        for (const a of aniqlamalar) {
          const parts = parseNumberedSenses(a.description || '');
          const canSplit =
            parts.length >= 2 &&
            parts[0].n === 1 &&
            parts.some((p) => p.n === 2) &&
            /(^|\s)1[.)]\s/.test(String(a.description || '')) &&
            /(^|\s)2[.)]\s/.test(String(a.description || ''));
          if (!canSplit) {
            expanded.push(a);
            continue;
          }
          parts.forEach((p, i) => {
            expanded.push({
              ...a,
              id: i === 0 ? a.id : `${a.id}__sense${p.n}`,
              description: p.text,
              sort_order: (Number(a.sort_order) || 1) * 100 + i,
              examples: i === 0 ? a.examples : [],
              idioms: i === 0 ? a.idioms : [],
              virtualSense: i > 0,
            });
          });
        }
        aniqlamalar.length = 0;
        aniqlamalar.push(...expanded);

        // Havola-yozuvlarni aniqlash va nishon so'zga bog'lash
        for (const a of aniqlamalar) {
          const target = detectReference(a.category, a.description);
          if (target) {
            const resolved = await this.resolveTargetTitle(target, resolvedTargets);
            a.reference = {
              target: resolved.soz || target,
              target_id: resolved.id,
              senses: resolved.senses,
            };
            continue;
          }

          // Grammatik havola: "азаплаў фейилиниң өзлик дәрежеси."
          const grammar = detectGrammarReference(a.description);
          if (grammar) {
            const resolved = await this.resolveTargetTitle(grammar.base, resolvedTargets);
            a.grammar_ref = {
              base: resolved.soz || grammar.baseDisplay,
              base_id: resolved.id,
              form: grammar.form,
              senses: resolved.senses,
            };
          }
        }

    return aniqlamalar;
  };

  // Nishon so'zni topib, ma'nolari va misollari bilan qaytarish
  resolveTargetTitle = async (target, cache = null) => {
    const cacheKey = foldKk(target);
    if (cache?.has(cacheKey)) return cache.get(cacheKey);

    const pending = this._resolveTargetTitle(target);
    if (cache) cache.set(cacheKey, pending);
    return pending;
  };

  _resolveTargetTitle = async (target) => {
    let resolved = await this.model.findTitleByNormalizedVariants(
      normalizedVariants(target)
    );
    if (!resolved) {
      resolved = await this.model.findTitleByFolded(foldKk(target));
    }

    let senses = [];
    if (resolved) {
      senses = await this.model.getAniqlamalarBySozId(resolved.id);
      const senseIds = senses.map((sense) => sense.id);
      const examples = await this.model.getMisallarByAniqlamaId(senseIds);
      const examplesBySense = {};
      for (const example of examples) {
        if (!examplesBySense[example.descriptions_id]) {
          examplesBySense[example.descriptions_id] = [];
        }
        examplesBySense[example.descriptions_id].push(example);
      }
      senses = senses.map((sense) => ({
        id: sense.id,
        category: sense.category,
        description: sense.description,
        examples: examplesBySense[sense.id] || [],
      }));
    }

    return {
      id: resolved?.id || null,
      soz: resolved?.soz || null,
      senses,
    };
  };

  // Bitta so‘z va uning to‘liq ma’lumotlari (omonimlari bilan birga)
  getSozById = async (id) => {
    const word = await this.model.getSozById(id);
    if (!word) return null;

    const resolvedTargets = new Map();
    const baseSoz = word.soz.replace(/\s+[IVX\u0406\u0425]+$/u, '').trim();

    // Mustaqil so‘rovlar parallel — kechikishni qisqartirish
    const [aniqlamalar, siblings, neighbors, related] = await Promise.all([
      this.buildSenses(id, resolvedTargets),
      this.model.findHomonyms(baseSoz),
      this.model.getNeighbors(id, baseSoz),
      baseSoz.length >= 3
        ? this.model.findRelatedByPrefix(baseSoz, 8)
        : Promise.resolve([]),
    ]);

    let homonyms = null;
    if (siblings.length > 1) {
      homonyms = await Promise.all(
        siblings.map(async (s) => ({
          id: s.id,
          soz: s.soz,
          roman: s.soz.slice(baseSoz.length).trim() || null,
          aniqlamalar:
            s.id === id ? aniqlamalar : await this.buildSenses(s.id, resolvedTargets),
        }))
      );
    }

    const relationTitleIds = siblings.length > 1 ? siblings.map((s) => s.id) : [id];
    const [relationRows, senseRelations, compounds] = await Promise.all([
      this.model.getWordRelations(relationTitleIds),
      getSenseRelationsForTitle(id).catch(() => []),
      getCompoundsForTitle(id).catch(() => ({ components: [], usedIn: [] })),
    ]);
    const relationSeen = new Set();
    const relations = { synonyms: [], antonyms: [] };
    for (const relation of relationRows) {
      const key = `${relation.type}:${relation.id}`;
      if (relationSeen.has(key) || relationTitleIds.includes(relation.id)) continue;
      relationSeen.add(key);
      const item = {
        id: relation.id,
        relationId: relation.relationId,
        soz: relation.soz,
        note: relation.note || null,
      };
      if (relation.type === 'synonym') relations.synonyms.push(item);
      if (relation.type === 'antonym') relations.antonyms.push(item);
    }

    this.model.incrementViewCount(id).catch(() => {});

    let links = null;
    try {
      const bilingual = await import('./bilingualDictService.js');
      links = await bilingual.getLinksForTitle(id, baseSoz);
    } catch {
      links = null;
    }

    return {
      ...word,
      base_soz: baseSoz,
      aniqlamalar,
      homonyms,
      relations,
      senseRelations,
      compounds,
      related,
      prev: neighbors.prev,
      next: neighbors.next,
      morphology: links?.morphology || null,
      translations: links
        ? {
            uzb: links.uzb || [],
            lexicon: links.lexicon || [],
            en: links.en || [],
            ru: links.ru || [],
          }
        : null,
    };
  };

  // Kun so'zi: sana asosida deterministik — kun davomida o'zgarmaydi
  getWordOfDay = async () => {
    const today = new Date().toISOString().slice(0, 10);
    if (this.#wordOfDayCache.date === today && this.#wordOfDayCache.data) {
      return this.#wordOfDayCache.data;
    }
    let seed = 0;
    for (const ch of today) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;

    const row = await this.model.getWordOfDay(seed);
    if (!row) return null;

    const senses = await this.model.getAniqlamalarBySozId(row.id);
    const first = senses[0] || null;
    let example = null;
    if (first) {
      const examples = await this.model.getMisallarByAniqlamaId([first.id]);
      example = examples.find((e) => e.author) || examples[0] || null;
    }
    const data = {
      id: row.id,
      soz: row.soz,
      date: today,
      category: first?.category || null,
      birinshi_aniqlama: first?.description || null,
      birinshi_misal: example ? { example: example.example, author: example.author } : null,
    };
    this.#wordOfDayCache = { date: today, data };
    return data;
  };

  // Sóz oyını — har savolda 1 to'g'ri + 3 chalg'ituvchi ta'rif
  getQuiz = async (count = 10, { titleIds, padWithPool = false } = {}) => {
    // Omonimlar bir-biriga chalg'ituvchi bo'lmasligi uchun bazaviy so'z bo'yicha dedupe
    const baseOf = (soz) =>
      foldKk(String(soz).replace(/\s+[IVXІХ]+\.?$/u, ''));

    const focusIds = Array.isArray(titleIds)
      ? [...new Set(titleIds.map(String).filter(Boolean))].slice(0, 40)
      : [];

    const focusPool = focusIds.length
      ? await this.model.getQuizPoolByTitleIds(focusIds)
      : [];
    const pool = await this.model.getQuizPool(Math.max(count * 6, 36));

    const seen = new Set();
    const uniqueFocus = [];
    for (const row of focusPool) {
      const key = baseOf(row.soz);
      if (seen.has(key)) continue;
      seen.add(key);
      uniqueFocus.push(row);
    }

    const uniqueAll = [...uniqueFocus];
    for (const row of pool) {
      const key = baseOf(row.soz);
      if (seen.has(key)) continue;
      seen.add(key);
      uniqueAll.push(row);
    }

    // Focus rejim: tek berilgan sózler; padWithPool: fokus + umumıy pool (check-in sowuq start)
    const correctPool =
      focusIds.length && !padWithPool ? uniqueFocus : uniqueAll;
    const target =
      focusIds.length && !padWithPool
        ? Math.min(count, correctPool.length)
        : count;

    const questions = [];
    for (let i = 0; i < correctPool.length && questions.length < target; i++) {
      const correct = correctPool[i];
      const distractors = [];
      for (let j = 1; j <= uniqueAll.length && distractors.length < 3; j++) {
        const candidate = uniqueAll[(i + j * 7) % uniqueAll.length];
        if (
          candidate &&
          candidate.id !== correct.id &&
          !distractors.some((d) => d.id === candidate.id)
        ) {
          distractors.push(candidate);
        }
      }
      if (distractors.length < 3) break;

      const options = [correct, ...distractors]
        .map((row) => ({ text: row.description, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map(({ text }) => text);

      questions.push({
        id: correct.id,
        soz: correct.soz,
        category: correct.category || null,
        options,
        correct: options.indexOf(correct.description),
      });
    }

    return { count: questions.length, data: questions };
  };

  // Qidiruv — avvalo LIKE; bo‘sh bo‘lsa ta'rif, so‘ng typo/fuzzy
  searchSoz = async (query, limit = 20, _ip, _userId) => {
    if (!query || query.trim().length === 0) {
      return { count: 0, data: [], suggestions: [], searchType: 'empty' };
    }

    const q = query.trim();
    const folded = searchFold(q);
    let results = await this.model.likeSearch(q, limit, folded);
    let searchType = 'partial';

    if (results.length === 0 && q.length >= 3) {
      results = await this.model.descriptionSearch(q, limit);
      if (results.length) searchType = 'description';
    }

    // Typo: 1–2 harf xato (masalan jaqsi ↔ jaqsı, saraław ↔ saralaw)
    if (results.length === 0 && folded.length >= 3) {
      const pool = await this.model.fuzzyCandidatePool(folded, { limit: 500 });
      const maxDist = maxEditDistance(folded.length);
      const scored = [];
      for (const row of pool) {
        const key = searchFold(row.search_key || row.normalized || row.soz);
        if (!key) continue;
        const dist = levenshtein(folded, key);
        if (dist > 0 && dist <= maxDist) {
          scored.push({ row, dist, lenDiff: Math.abs(key.length - folded.length) });
        }
      }
      scored.sort((a, b) => a.dist - b.dist || a.lenDiff - b.lenDiff || a.row.soz.length - b.row.soz.length);
      if (scored.length) {
        results = scored.slice(0, limit).map(({ row, dist }) => ({
          id: row.id,
          soz: row.soz,
          normalized: row.normalized,
          st_let: row.st_let,
          birinshi_aniqlama: row.birinshi_aniqlama,
          fuzzyDistance: dist,
        }));
        searchType = 'fuzzy';
      }
    }

    if (results.length === 0) {
      const prefixLen = Math.min(2, q.length);
      const prefix = q.slice(0, prefixLen);
      let suggestions = await this.model.suggestByPrefix(
        prefix,
        Math.min(8, limit),
        folded.slice(0, prefixLen)
      );
      if (!suggestions.length && q.length >= 1) {
        suggestions = await this.model.suggestByPrefix(
          q.charAt(0),
          Math.min(8, limit),
          folded.charAt(0)
        );
      }
      // Prefix ham bo‘sh — eng yaqin fuzzy (yumshoqroq limit)
      if (!suggestions.length && folded.length >= 2) {
        const pool = await this.model.fuzzyCandidatePool(folded, { limit: 600 });
        const maxDist = maxEditDistance(folded.length) + 1;
        const scored = [];
        for (const row of pool) {
          const key = searchFold(row.search_key || row.normalized || row.soz);
          if (!key) continue;
          const dist = levenshtein(folded, key);
          if (dist <= maxDist) scored.push({ row, dist });
        }
        scored.sort((a, b) => a.dist - b.dist);
        suggestions = scored.slice(0, Math.min(8, limit)).map(({ row, dist }) => ({
          id: row.id,
          soz: row.soz,
          normalized: row.normalized,
          birinshi_aniqlama: row.birinshi_aniqlama,
          fuzzyDistance: dist,
        }));
      }
      if (!suggestions.length) {
        const curated = await this.getCurated();
        suggestions = (curated.data || []).slice(0, 6).map((t) => ({
          id: t.id,
          soz: t.soz,
          normalized: t.normalized,
          birinshi_aniqlama: t.birinshi_aniqlama,
        }));
      }
      return {
        count: 0,
        data: [],
        suggestions,
        searchType: 'no_match',
        message: 'Hesh nárse tabılmadı — uqsas sózler:',
      };
    }

    return {
      count: results.length,
      searchType,
      data: results,
      suggestions: [],
      message:
        searchType === 'fuzzy'
          ? 'Anıq sáykes joq — uqsas sózler (imlo/typo):'
          : searchType === 'description'
            ? 'Taʼrif boyınsha tabıldı:'
            : undefined,
    };
  };

  getCuratedSozler = async (sozList) => {
    const titles = await this.model.findTitlesBySozList(sozList);
    if (!titles.length) return { count: 0, data: [] };

    const senseRows = await this.model.getFirstSensesByTitleIds(titles.map((t) => t.id));
    const firstByTitle = new Map();
    const firstSenseIds = [];
    for (const row of senseRows) {
      if (!firstByTitle.has(row.titles_id)) {
        firstByTitle.set(row.titles_id, row);
        firstSenseIds.push(row.id);
      }
    }

    const examples = await this.model.getMisallarByAniqlamaId(firstSenseIds);
    const exampleBySense = new Map();
    for (const example of examples) {
      if (!exampleBySense.has(example.descriptions_id)) {
        exampleBySense.set(example.descriptions_id, example);
      }
    }

    const countRows = await this.model.getSenseCountsByTitleIds(titles.map((t) => t.id));
    const countByTitle = new Map(countRows.map((row) => [row.titles_id, Number(row.total) || 0]));

    const enriched = titles.map((title) => {
      const first = firstByTitle.get(title.id);
      const example = first ? exampleBySense.get(first.id) : null;
      return {
        ...title,
        birinshi_aniqlama: first?.description || null,
        category: first?.category || null,
        aniqlama_sani: countByTitle.get(title.id) || 0,
        birinshi_misal: example
          ? { example: example.example, author: example.author || null }
          : null,
      };
    });

    return { count: enriched.length, data: enriched };
  };

  // Curated (premium-50) — endi MySQL `curated_words` jadvalidan o‘qiladi.
  // fordata/curated fayllari faqat migratsiyagacha fallback bo‘lib qoladi.
  // Aiven: 4 ta round-trip ~2s — 5 daqiqa memory cache.
  getCurated = async () => {
    const now = Date.now();
    if (
      this.#curatedCache.data &&
      now - this.#curatedCache.at < TusindirmeService.#CURATED_TTL_MS
    ) {
      return this.#curatedCache.data;
    }
    let sozList = await this.model.getCuratedSozList();
    if (!sozList.length) sozList = this.readCuratedFromFile();
    const result = await this.getCuratedSozler(sozList);
    this.#curatedCache = { at: now, data: result };
    return result;
  };

  // Legacy fallback: fordata mavjud bo‘lsa fayldan o‘qiydi (bazada seed yo‘q holat uchun)
  readCuratedFromFile = () => {
    if (fs.existsSync(CURATED_META)) {
      const meta = JSON.parse(fs.readFileSync(CURATED_META, 'utf8'));
      return (meta.words || []).map((w) =>
        String(w.title || '')
          .trim()
          .replace(/\s+(ат|ф|кел|б)\.?$/i, '')
      );
    }
    if (fs.existsSync(CURATED_IMPORT)) {
      const items = JSON.parse(fs.readFileSync(CURATED_IMPORT, 'utf8'));
      return items.map((i) => i.soz);
    }
    return [];
  };

  // Eski nom bilan chaqiruvchilar uchun alias
  getCuratedFromFile = async () => this.getCurated();

  // Harf bo‘yicha so‘zlar
  getSozlerByLetter = async (letter, page = 1, limit = 50) => {
    const offset = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.model.getSozlerByLetter(letter, limit, offset),
      this.model.getCountByLetter(letter),
    ]);
    return {
      letter,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data
    };
  };

  // TOP so‘zlar (eng ko‘p qidirilgan yoki ko‘rilgan)
  getTopSozler = async (type = 'search', limit = 100) => {
    const data = await this.model.getTopSozler(type, limit);
    return { type, count: data.length, data };
  };

  // Random soz
  // Servisda
getRandomSoz = async () => {
    // 1. Tasdiqlangan so‘zlar sonini olish
    const total = await this.model.getTotalSozCount();
    if (total === 0) return null;

    // 2. Tasodifiy offset hisoblash
    const randomOffset = Math.floor(Math.random() * total);

    // 3. Bitta so‘zni olish (LIMIT 1, OFFSET randomOffset)
    const sozler = await this.model.getSozler(1, randomOffset);
    if (sozler.length === 0) return null;
    const word = sozler[0];

    // getSozler birinchi ta'rifni allaqachon birinshi_aniqlama sifatida beradi
    return word;
};

  // Maqal-matellar qidiruv
  searchMaqal = async (query, limit = 20) => {
    if (!query || query.trim().length === 0) {
      const data = await this.model.getLatestMaqal(limit);
      return { count: data.length, data };
    }
    const data = await this.model.searchMaqalFulltext(query, limit);
    return { count: data.length, data };
  };

  // Alifbo
  getAlphabet = async () => {
    const data = await this.model.getAlphabetStats();
    return data;
  };


  // title qosiw || id, soz, normalized, st_let
insertNested = async (items) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        let added = 0, skipped = 0;

        for (const item of items) {
            // 1. Title bor-yo'qligi
            const existing = await this.model.findTitleBySoz(
              connection,
              item.soz,
              item.normalized
            );
            if (existing) {
                console.log(`⚠️ "${item.soz}" - bar, taslap ketildi`);
                skipped++;
                continue;
            }

            // 2. Title qo'shish
            const titleId = idGen.generateShortId(8);
            const st_let = item.soz.charAt(0);
            await this.model.insertTitle(connection, titleId, item.soz, item.normalized, st_let);

            // 3. Descriptions
            for (const desc of item.descriptions) {
                const categoryName = (desc.category || '').trim() || 'белгисиз';
                const categoryId = await this.model.findOrCreate(connection, categoryName);
                const descId = idGen.generateShortId(8);
                await this.model.insertDescription(
                    connection,
                    descId,
                    titleId,
                    categoryId,
                    desc.definition,
                    desc.order || 1
                );

                // Misollar (ixtiyoriy)
                if (desc.example && desc.example.length) {
                    for (const ex of desc.example) {
                        if (!ex.example?.trim()) continue;
                        const exId = idGen.generateShortId(8);
                        await this.model.insertExample(connection, exId, descId, ex.example.trim(), ex.author, ex.order || 1);
                    }
                }

                // Idiomalar (ixtiyoriy)
                if (desc.idioms && desc.idioms.length) {
                    for (const idm of desc.idioms) {
                        const phrase = (idm.phrase || '').trim();
                        if (!phrase) continue;
                        const idiomId = idGen.generateShortId(8);
                        await this.model.insertIdiom(
                            connection,
                            idiomId,
                            descId,
                            phrase.slice(0, 255),
                            idm.order || 1
                        );
                        if (idm.description && String(idm.description).trim()) {
                            const idiomDescId = idGen.generateShortId(8);
                            await this.model.insertIdiomDesc(
                                connection,
                                idiomDescId,
                                idiomId,
                                String(idm.description).trim()
                            );
                        }
                    }
                }
            }

            // Etimologiya (ixtiyoriy)
            if (item.etymology?.description) {
                const etId = idGen.generateShortId(8);
                await this.model.insertEtymology(connection, etId, titleId, item.etymology);
            }

            added++;
            console.log(`✅ ${added}. ${item.soz} qosildi`);
        }

        await connection.commit();
        this.invalidateCaches();
        return { added, skipped, total: items.length };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};
}

export default TusindirmeService;