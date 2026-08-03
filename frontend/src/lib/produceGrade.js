/**
 * Soft produce grading — backend `produceGrade.js` menen bir xil.
 * Guest/offline immersion catch path ushın.
 */
import searchFold from './searchFold.js';
import { levenshtein, maxEditDistance } from './editDistance.js';

export function produceSoftMaxDistance(len) {
  const n = Number(len) || 0;
  if (n < 4) return 0;
  return Math.min(maxEditDistance(n), 2);
}

export function glossSoftMaxDistance(len) {
  const n = Number(len) || 0;
  if (n < 8) return 0;
  if (n < 20) return Math.min(maxEditDistance(n), 2);
  return Math.min(maxEditDistance(n), 4);
}

/**
 * @returns {{ correct: boolean, nearMiss: boolean }}
 */
export function gradeProduceSubmission(accepted = [], submitted, opts = {}) {
  const softMax =
    typeof opts.softMaxDistance === 'function'
      ? opts.softMaxDistance
      : produceSoftMaxDistance;
  const raw =
    typeof submitted === 'object' && submitted != null ? submitted.answer : submitted;
  const folded = searchFold(raw);
  if (!folded) return { correct: false, nearMiss: false };

  const list = Array.isArray(accepted) ? accepted : [];
  const targets = [];
  for (const a of list) {
    const t = searchFold(a);
    if (!t) continue;
    if (t === folded) return { correct: true, nearMiss: false };
    targets.push(t);
  }

  for (const target of targets) {
    const max = softMax(target.length);
    if (max > 0 && levenshtein(folded, target) <= max) {
      return { correct: true, nearMiss: true };
    }
  }
  return { correct: false, nearMiss: false };
}

export function gradeGlossProduceSubmission(accepted = [], submitted) {
  return gradeProduceSubmission(accepted, submitted, {
    softMaxDistance: glossSoftMaxDistance,
  });
}

/** Immersion local/offline — lemma accepted list. */
export function buildProduceAccepted(lemma) {
  const raw = String(lemma || '').trim();
  if (!raw) return [];
  const folded = searchFold(raw);
  return [...new Set([raw, folded].filter(Boolean))];
}

/**
 * Guest/offline immersion produce — server `gradeImmersionProduce` parity.
 * @returns {{ correct: boolean, nearMiss: boolean }}
 */
export function gradeImmersionProduceLocal({ lemma, answer } = {}) {
  const accepted = buildProduceAccepted(lemma);
  if (!accepted.length) return { correct: false, nearMiss: false };
  return gradeProduceSubmission(accepted, answer);
}
