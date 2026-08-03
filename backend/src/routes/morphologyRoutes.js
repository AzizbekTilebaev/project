/**
 * /api/morphology — qaraqalpaq sózin TÚBİR + QOSIMTA'larǵa bóletuǵın endpoint.
 * Tübir sózlik (titles) menen tekseriledi, sonlıqtan nátiyje dálirek boladı.
 */

import { Router } from 'express';
import { analyzeWord } from '../services/morphologyService.js';
import TusindirmeModel from '../models/tusindirme.model.js';
import { toCyrillic } from '../utils/qqScript.js';

const router = Router();
const model = new TusindirmeModel();

// OCR / jazıw farqların jutatuǵın fold (tusindirmeService.foldKk menen birdey)
function foldKk(word) {
  return String(word || '')
    .toLocaleLowerCase('kk')
    .trim()
    .replace(/\u049B/g, '\u043A') // қ -> к
    .replace(/\u0493/g, '\u0433') // ғ -> г
    .replace(/\u04A3/g, '\u043D') // ң -> н
    .replace(/[\u045E\u04AF\u04B1]/g, '\u0443') // ў/ү/ұ -> у
    .replace(/\u04B3/g, '\u0445') // ҳ -> х
    .replace(/\u0456/g, 'i'); // і -> i
}

// Sózlikte feyil kategoriyası "ф." dep qısqartıladı (atlıq — "ат.", kelbetlik — "кел.")
const VERB_POS_RE = /^\s*\u0444\.?\s*$|\u0444\u0435\u0439\u0438\u043b|feyil|verb|\u0433\u043b\u0430\u0433\u043e\u043b/i;
// Feyiller sózlikte "-ıw" (infinitiv) formasında turadı: KEL → KELIW
const INFINITIVE_SUFFIXES = ['\u0131w', 'iw', 'uw', '\u00faw'];

async function findTitleByLatin(latinForm) {
  const target = foldKk(toCyrillic(latinForm));
  if (target.length < 2) return null;
  const hit = await model.findTitleByFolded(target);
  if (hit && foldKk(hit.normalized || hit.soz) === target) return hit;
  return null;
}

async function categoryIsVerb(titleId) {
  try {
    const senses = await model.getFirstSensesByTitleIds([titleId]);
    return senses.some((s) => VERB_POS_RE.test(String(s.category || '')));
  } catch {
    return false;
  }
}

// Latın tübir haqqında sózlik maǵlıwmatı: bar-joqlıǵı, feyil pe, sózlik yazıwı. Memolanadı.
const rootInfoMemo = new Map();
async function getRootInfo(latinRoot) {
  const key = foldKk(toCyrillic(latinRoot));
  if (key.length < 2) return { known: false, isVerb: false, titleId: null, headword: null };
  if (rootInfoMemo.has(key)) return rootInfoMemo.get(key);

  let info = { known: false, isVerb: false, titleId: null, headword: null };
  try {
    // 1) Tübir sıpatında (atlıq, kelbetlik, ráwish ...)
    const bare = await findTitleByLatin(latinRoot);
    if (bare) {
      info = {
        known: true,
        isVerb: await categoryIsVerb(bare.id),
        titleId: bare.id,
        headword: bare.soz,
      };
    } else {
      // 2) Feyil bolıwı múmkin: tübir + infinitiv (-ıw) sózlikte bar ma?
      for (const suf of INFINITIVE_SUFFIXES) {
        const hit = await findTitleByLatin(latinRoot + suf);
        if (hit) {
          info = { known: true, isVerb: true, titleId: hit.id, headword: hit.soz };
          break;
        }
      }
    }
  } catch {
    /* DB qátesi — tekseriwsiz dawam etemiz */
  }
  if (rootInfoMemo.size >= 2000) rootInfoMemo.clear();
  rootInfoMemo.set(key, info);
  return info;
}

async function isKnownRoot(latinRoot) {
  return (await getRootInfo(latinRoot)).known;
}

// Kishi keshleme — bir sózdi qayta-qayta talqılaǵanda DB ni tınıshlaydı
const cache = new Map();
const CACHE_MAX = 500;

function endpoint(handler) {
  return async (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store');
      await handler(req, res);
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ success: false, message: error.message });
      }
      next(error);
    }
  };
}

router.get(
  '/analyze',
  endpoint(async (req, res) => {
    const word = String(req.query.word || req.query.q || '').trim().slice(0, 60);
    const script = req.query.script === 'latin' ? 'latin' : req.query.script === 'cyrillic' ? 'cyrillic' : null;
    const verify = req.query.verify !== '0';

    if (!word) {
      return res.status(400).json({ success: false, message: 'word talap etiledi' });
    }

    const key = `${word}|${script || 'auto'}|${verify ? 'v' : 'n'}`;
    if (cache.has(key)) {
      return res.json({ success: true, analysis: cache.get(key), cached: true });
    }

    let analysis = await analyzeWord(word, {
      script,
      isRoot: verify ? isKnownRoot : null,
    });

    // Tübir feyil bolsa — feyil oqılıwın abzal tutıp qayta talqılaymız
    // (mısalı "keldi" → kel + di, "tabıs seplik" emes "ótken máhál").
    if (verify && analysis.rootIsKnown) {
      const info = await getRootInfo(analysis.rootLatin);
      if (info.isVerb) {
        analysis = await analyzeWord(word, {
          script,
          isRoot: isKnownRoot,
          preferVerb: true,
        });
      }
      // Tübirdiń sózlik yazıwın (havola ushın) qosamız
      const finalInfo = await getRootInfo(analysis.rootLatin);
      analysis.rootTitleId = finalInfo.titleId;
      analysis.rootHeadword = finalInfo.headword;
    } else {
      analysis.rootTitleId = null;
      analysis.rootHeadword = null;
    }

    if (cache.size >= CACHE_MAX) cache.clear();
    cache.set(key, analysis);
    res.json({ success: true, analysis });
  })
);

export default router;
