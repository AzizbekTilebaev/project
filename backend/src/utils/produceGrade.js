import searchFold from './searchFold.js';
import { levenshtein, maxEditDistance } from './editDistance.js';

/**
 * Produce / cloze soft typo — qidiruvdan qattıraq.
 * 4 den qısqa: tek exact (false positive qorǵaw).
 * Uzınraq: maxEditDistance, lekin ≤2.
 */
export function produceSoftMaxDistance(len) {
  const n = Number(len) || 0;
  if (n < 4) return 0;
  return Math.min(maxEditDistance(n), 2);
}

/**
 * Gloss (anıqlama) soft — lemma-dan biraz keńirek.
 * <8: exact; 8–19: ≤2; ≥20: ≤4.
 */
export function glossSoftMaxDistance(len) {
  const n = Number(len) || 0;
  if (n < 8) return 0;
  if (n < 20) return Math.min(maxEditDistance(n), 2);
  return Math.min(maxEditDistance(n), 4);
}

/**
 * @param {string[]|*} accepted
 * @param {*} submitted
 * @param {{ softMaxDistance?: (len: number) => number }} [opts]
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

/** Anıqlama produce — gloss soft max. */
export function gradeGlossProduceSubmission(accepted = [], submitted) {
  return gradeProduceSubmission(accepted, submitted, {
    softMaxDistance: glossSoftMaxDistance,
  });
}
