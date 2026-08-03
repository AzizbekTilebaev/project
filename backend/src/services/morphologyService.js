/**
 * Qaraqalpaq tili morfologiyalıq segmenteri — sózdi TÚBİR + QOSIMTA'larǵa bóledi.
 *
 * Algoritm: qaǵıydaǵa tiykarlanǵan, oń jaqtan (sóz sońınan) eń uzın affiksti
 * tabıp tazalaw (longest-match). Affiks inventarı: qqAffixes.js
 * (derek — apertium-kaa lexc+twol + PDF jasaw qosımtaları).
 *
 * Tártip (tübirden sırtqa): jasaw(4) → kóplik(3) → tartım(2) → seplik(1)/feyil(0)/clitic.
 * Sonlıqtan sóz sońınan tazalaǵanda: clitic/seplik/feyil → tartım → kóplik → jasaw.
 *
 * Morphophonology (apertium twol qısqasha): unlı arasındagı sońǵı qatań undosh
 * juwasaǵı (p↔b, k↔g, q↔ǵ, t↔d) — sózlik tekseriwde stem variantları qollanıladı.
 *
 * isRoot(candidate) — sózliktegi bar-joqlıqtı tekseretuǵın optsional funktsiya.
 */

import { toLatin, toCyrillic, detectScript } from '../utils/qqScript.js';
import { AFFIXES, SLOT_RANK, VOWELS } from '../data/qqAffixes.js';

const MIN_ROOT_LEN = 2; // tübir eń kem 2 hárip
const MAX_SEGMENTS = 6; // qátelesken (endless) tazalawdı sheklew

/** Apertium twol: intervocalic voicing undo — surface stem → lemma candidate */
const DEVOICE_FINAL = { b: 'p', g: 'k', ǵ: 'q', d: 't' };
const VOICE_FINAL = { p: 'b', k: 'g', q: 'ǵ', t: 'd' };

/** Sózlik lemma (bas forma) ushın: jasaw + dawıs (caus/pass/coop). Seplik/tartım/kóplik joq. */
const LEMMA_VOICE_IDS = new Set(['v-caus', 'v-pass', 'v-coop']);
const ROMAN_TAIL_RE = /\s+[ivxlcіvх]+\.?$/i;

/**
 * Tübir kandidatınıń morphophonologiyalıq variantları (kitab↔kitap, bilezig↔bilezik).
 */
export function stemVariants(stem) {
  const s = String(stem || '');
  const out = new Set([s]);
  if (s.length < 2) return [...out];
  const last = s[s.length - 1];
  const base = s.slice(0, -1);
  // Apertium: q→g'/ǵ, k→g (intervocalic). Undo: g → k|q, ǵ → q
  if (last === 'g') {
    out.add(base + 'k');
    out.add(base + 'q');
  } else if (last === 'ǵ') {
    out.add(base + 'q');
  } else if (DEVOICE_FINAL[last]) {
    out.add(base + DEVOICE_FINAL[last]);
  }
  if (VOICE_FINAL[last]) out.add(base + VOICE_FINAL[last]);
  // g' / ǵ orthography (apertium Latn_1991 vs 2016)
  if (s.includes("g'")) out.add(s.replace(/g'/g, 'ǵ'));
  if (s.includes('ǵ')) out.add(s.replace(/ǵ/g, "g'"));
  return [...out];
}

function anyVariantMatches(stem, pred) {
  if (!pred) return false;
  return stemVariants(stem).some((v) => pred(v));
}

function preferredRoot(stem, pred) {
  if (!pred) return stem;
  for (const v of stemVariants(stem)) {
    if (pred(v)) return v;
  }
  return stem;
}

// Kanonik latın (kishi hárip) — segmentleў tek usı formada isleydi
// Ы→Í (bas hárip) → toLowerCase() "í"; affiks formaları "ı" — birlestiremiz.
function canonical(word) {
  return toLatin(String(word || ''))
    .toLowerCase()
    .replace(/í/g, 'ı')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Sózlik bas formadan rim raqam / homonym indeksi (І, II, …) */
export function stripLemmaNoise(word) {
  let s = canonical(word);
  s = s.replace(ROMAN_TAIL_RE, '').trim();
  return s;
}

function isLemmaAffix(affix) {
  return affix.slot === 'derivation' || LEMMA_VOICE_IDS.has(affix.id);
}

function hasVowel(str) {
  for (const ch of str) if (VOWELS.has(ch)) return true;
  return false;
}

// Bir affiks formasın stemniń sońınan tazalap kóriw — nátiyje nızamlı ma?
function tryStrip(stem, form, { allowShort }) {
  if (!stem.endsWith(form)) return null;
  const residue = stem.slice(0, stem.length - form.length);
  if (residue.length < MIN_ROOT_LEN) return null;
  if (!hasVowel(residue)) return null; // tübir unlısız bolmaydı
  if (!allowShort && form.length < 2) return null; // sózliksiz rejimde qısqa affiksti almaymız
  return residue;
}

/**
 * Berilgen stem ushın barlıq nızamlı tazalaw variantların tabadı.
 * Omonim formalarda qaysı oqılıw abzal: atawısh (nominal) yamasa feyil.
 * preferVerb=false — atawısh oqılıw aldın, feyil sońında.
 */
function slotWeight(rank, preferVerb) {
  if (rank === SLOT_RANK.verb || rank === SLOT_RANK.clitic) return preferVerb ? -1 : 100;
  return rank; // nominal: seplik(1) < tartım(2) < kóplik(3) < jasaw(4)
}

function candidateStrips(stem, maxRank, allowShort, preferVerb = false) {
  const out = [];
  for (const affix of AFFIXES) {
    const rank = SLOT_RANK[affix.slot];
    if (rank < maxRank) continue; // sırtqı slotqa qaytıp bolmaydı
    for (const form of affix.forms) {
      const residue = tryStrip(stem, form, { allowShort });
      if (residue != null) out.push({ affix, form, residue, rank });
    }
  }
  out.sort(
    (a, b) =>
      b.form.length - a.form.length ||
      slotWeight(a.rank, preferVerb) - slotWeight(b.rank, preferVerb)
  );
  return out;
}

/** Sózlik lemma ushın kandidatlar — tek jasaw + dawıs; seplik/tartım joq. */
function candidateStripsLemma(stem) {
  const out = [];
  for (const affix of AFFIXES) {
    if (!isLemmaAffix(affix)) continue;
    const rank = SLOT_RANK[affix.slot];
    for (const form of affix.forms) {
      // Lemma rejimde 2-hárip formalar da (ıw, lı) ruxsat — isRoot baǵdarlaydı
      const residue = tryStrip(stem, form, { allowShort: true });
      if (residue != null && residue.length >= MIN_ROOT_LEN) {
        out.push({ affix, form, residue, rank });
      }
    }
  }
  out.sort((a, b) => b.form.length - a.form.length || b.residue.length - a.residue.length);
  return out;
}

/**
 * Sózlik bas formasın túbir+qosımtaǵa bóledi (BFS).
 * Maqset: eń qısqa anıq túbir (isRoot) + oǵan jetetuǵın jol.
 */
function segmentLemma(word, { isRoot = null } = {}) {
  const latin = stripLemmaNoise(word);
  if (latin.length < MIN_ROOT_LEN) {
    return { rootLatin: latin, layers: [] };
  }

  const known = (stem) => (isRoot ? anyVariantMatches(stem, isRoot) : false);

  // BFS: stem → layers (sırttan ishke, peel tártibi)
  // Anıq túbir: eń UZIN belgisiz-emes stem (artıq bóliwden saqlanıw: azıw+las+ıw, az+ıw+las+ıw emes).
  const surfaceLen = latin.length;
  const queue = [{ stem: latin, layers: [] }];
  const seen = new Set([latin]);
  let bestKnown = known(latin) ? { stem: latin, layers: [] } : null;
  let bestApprox = { stem: latin, layers: [] };

  while (queue.length) {
    const cur = queue.shift();
    if (cur.layers.length >= MAX_SEGMENTS) continue;

    if (known(cur.stem)) {
      if (!bestKnown) {
        bestKnown = cur;
      } else {
        const bestBare = bestKnown.layers.length === 0 && bestKnown.stem.length === surfaceLen;
        const curDecomp = cur.layers.length > 0;
        // Sózliktegi bas forma ózi lemma: ápiwayı -ıw/-ım (ayıw≠ay+ıw) menen bólmeymiz.
        // Kúshli dórendi: ≥2 qosımta yamasa ≥3 hárip jasaw (-lıq, -shı, -sız, -las…).
        const strongDecomp =
          cur.layers.length >= 2 ||
          (cur.layers.length === 1 && cur.layers[0].form.length >= 3);
        if (bestBare && curDecomp && strongDecomp) {
          bestKnown = cur;
        } else if (!bestBare && curDecomp) {
          if (
            cur.stem.length > bestKnown.stem.length ||
            (cur.stem.length === bestKnown.stem.length &&
              cur.layers.length < bestKnown.layers.length)
          ) {
            bestKnown = cur;
          }
        }
      }
    } else if (cur.layers.length > bestApprox.layers.length) {
      bestApprox = cur;
    }

    const cands = candidateStripsLemma(cur.stem);
    for (const c of cands.slice(0, 10)) {
      // Qısqa (-lı/-ma): tek qaldıq anıq túbir bolsa.
      // -ıw (atawısh feyil) hám dawıs (-tır/-ıl) — ara stem belgisiz bolsa da dawam.
      const openEnded = c.affix.id === 'der-iw' || LEMMA_VOICE_IDS.has(c.affix.id);
      if (c.form.length < 3 && !openEnded && !known(c.residue)) continue;
      if (seen.has(c.residue)) continue;
      seen.add(c.residue);
      queue.push({
        stem: c.residue,
        layers: [...cur.layers, { affix: c.affix, form: c.form, rank: c.rank }],
      });
    }
  }

  const pick = bestKnown || bestApprox;
  return {
    rootLatin: preferredRoot(pick.stem, isRoot),
    layers: pick.layers,
  };
}

/**
 * Sózdi segmentlerge bóledi.
 * @param {string} word — qálegen jazıwda (latın/kirill)
 * @param {object} [opts]
 * @param {(latinRoot:string)=>boolean} [opts.isRoot] — sózlik tekseriwshi
 * @param {boolean} [opts.lemmaMode] — sózlik bas forma (dórendi) ushın
 * @returns {{ rootLatin:string, layers:Array }} layers — sırttan ishke qaray
 */
function segment(word, { isRoot = null, preferVerb = false, lemmaMode = false } = {}) {
  if (lemmaMode) return segmentLemma(word, { isRoot });

  const latin = canonical(word);
  const layers = []; // [{ affix, form, rank }] — sırttan ishke
  let stem = latin;
  let maxRank = 0;

  while (layers.length < MAX_SEGMENTS) {
    // Tolıq sóz sózlikte bolsa (mısalı "eken") — qosımta dep bóliwge bolmaydı
    if (isRoot && anyVariantMatches(stem, isRoot)) break;

    const cands = candidateStrips(stem, maxRank, Boolean(isRoot), preferVerb);
    if (!cands.length) break;

    let chosen = null;
    if (isRoot) {
      chosen = cands.find((c) => anyVariantMatches(c.residue, isRoot)) || null;
      if (!chosen && anyVariantMatches(stem, isRoot)) break;
      if (!chosen) {
        chosen =
          cands.find((c) => c.rank === SLOT_RANK.derivation && c.form.length >= 4) ||
          cands.find((c) => c.rank !== SLOT_RANK.derivation) ||
          null;
      }
      if (!chosen) break;
    } else {
      // Jasaw: ≥3 ( -sız, -shı ) ruxsat, qaldıq ≥3; qısqa 2-hárip jasaw (-lı) tek sózlikte
      chosen =
        cands.find(
          (c) =>
            c.rank !== SLOT_RANK.derivation ||
            (c.form.length >= 3 && c.residue.length >= 3)
        ) || null;
      if (!chosen) break;
    }

    layers.push({ affix: chosen.affix, form: chosen.form, rank: chosen.rank });
    stem = chosen.residue;
    maxRank = chosen.rank === SLOT_RANK.derivation ? SLOT_RANK.derivation : chosen.rank + 1;
  }

  return { rootLatin: preferredRoot(stem, isRoot), layers };
}

function display(latinText, script) {
  return script === 'cyrillic' ? toCyrillic(latinText) : latinText;
}

/**
 * Toliq talqılaw — UI ushın tayın obъekt.
 * @param {boolean} [opts.lemmaMode] — sózlik bas formaların dórendi bóliw (taxminiy)
 */
export async function analyzeWord(
  word,
  { script = null, isRoot = null, preferVerb = false, lemmaMode = false } = {}
) {
  const raw = String(word || '').trim();
  const outScript = script || (detectScript(raw) === 'latin' ? 'latin' : 'cyrillic');
  const baseLatin = lemmaMode ? stripLemmaNoise(raw) : canonical(raw);

  const empty = {
    input: raw,
    script: outScript,
    root: display(baseLatin, outScript),
    rootLatin: baseLatin,
    rootIsKnown: false,
    segments: [],
    suffixes: [],
    hasSuffixes: false,
    lemmaMode: Boolean(lemmaMode),
    approximate: Boolean(lemmaMode),
  };
  if (!raw || baseLatin.length < MIN_ROOT_LEN) return empty;

  let syncIsRoot = null;
  if (typeof isRoot === 'function') {
    const probes = lemmaMode
      ? collectLemmaRootProbes(baseLatin)
      : collectRootProbes(baseLatin);
    const known = new Set();
    await Promise.all(
      probes.map(async (p) => {
        try {
          if (await isRoot(p)) known.add(p);
        } catch {
          /* tekseriw sátsiz — elemey ótemiz */
        }
      })
    );
    syncIsRoot = (cand) => known.has(cand);
  }

  const { rootLatin, layers } = segment(raw, {
    isRoot: syncIsRoot,
    preferVerb,
    lemmaMode,
  });

  const ordered = [...layers].reverse();
  const suffixes = ordered.map((l) => ({
    text: display(l.form, outScript),
    latin: l.form,
    slot: l.affix.slot,
    role: display(l.affix.role, outScript),
    gloss: display(l.affix.gloss, outScript),
  }));

  const rootIsKnown = syncIsRoot ? anyVariantMatches(rootLatin, syncIsRoot) : false;
  const rootSeg = {
    text: display(rootLatin, outScript),
    latin: rootLatin,
    slot: 'root',
    role: display('tübir', outScript),
    gloss: '',
    isRoot: true,
    isKnown: rootIsKnown,
  };

  const displaySplit = [rootLatin, ...suffixes.map((s) => s.latin)].join(' + ');

  return {
    input: raw,
    script: outScript,
    root: display(rootLatin, outScript),
    rootLatin,
    rootIsKnown,
    segments: [rootSeg, ...suffixes],
    suffixes,
    hasSuffixes: suffixes.length > 0,
    displaySplit,
    lemmaMode: Boolean(lemmaMode),
    approximate: Boolean(lemmaMode),
  };
}

function collectRootProbes(latin) {
  const probes = new Set();
  const walk = (stem, maxRank, depth) => {
    if (depth > MAX_SEGMENTS) return;
    for (const v of stemVariants(stem)) probes.add(v);
    const cands = candidateStrips(stem, maxRank, true);
    for (const c of cands.slice(0, 3)) {
      const nextRank =
        c.rank === SLOT_RANK.derivation ? SLOT_RANK.derivation : c.rank + 1;
      walk(c.residue, nextRank, depth + 1);
    }
  };
  walk(latin, 0, 0);
  return [...probes];
}

function collectLemmaRootProbes(latin) {
  const probes = new Set();
  const walk = (stem, depth) => {
    if (depth > MAX_SEGMENTS) return;
    for (const v of stemVariants(stem)) probes.add(v);
    for (const c of candidateStripsLemma(stem).slice(0, 8)) {
      walk(c.residue, depth + 1);
    }
  };
  walk(latin, 0);
  return [...probes];
}

export default { analyzeWord, stemVariants, stripLemmaNoise };
