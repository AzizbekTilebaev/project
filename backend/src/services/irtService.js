/** Pure IRT helpers (3PL-lite). No DB. */

export function logisticProb(theta, a = 1, b = 0, c = 0.2) {
  const aa = Number.isFinite(a) ? a : 1;
  const bb = Number.isFinite(b) ? b : 0;
  const cc = Math.min(0.35, Math.max(0, Number.isFinite(c) ? c : 0.2));
  const z = aa * (theta - bb);
  const p = 1 / (1 + Math.exp(-z));
  return cc + (1 - cc) * p;
}

export function itemInfo(theta, a = 1, b = 0, c = 0.2) {
  const p = logisticProb(theta, a, b, c);
  const q = 1 - p;
  const aa = Number.isFinite(a) ? a : 1;
  const cc = Math.min(0.35, Math.max(0, Number.isFinite(c) ? c : 0.2));
  if (p <= cc || p >= 1) return 0;
  const numer = aa * aa * Math.pow(p - cc, 2) * q;
  const denom = p * Math.pow(1 - cc, 2);
  return denom > 0 ? numer / denom : 0;
}

/**
 * One-step Newton update for theta given a batch of responses.
 * responses: [{ a, b, c, correct: boolean }]
 */
export function updateTheta(theta, responses, { min = -3, max = 3 } = {}) {
  let th = Number.isFinite(theta) ? theta : 0;
  const items = Array.isArray(responses) ? responses : [];
  if (!items.length) return { theta: th, se: 1 };

  for (let iter = 0; iter < 8; iter++) {
    let first = 0;
    let second = 0;
    for (const r of items) {
      const a = r.a ?? 1;
      const b = r.b ?? 0;
      const c = r.c ?? 0.2;
      const p = logisticProb(th, a, b, c);
      const u = r.correct ? 1 : 0;
      const w = itemInfo(th, a, b, c);
      first += ((u - p) * a) / Math.max(p * (1 - p), 1e-6);
      second -= w;
    }
    if (Math.abs(second) < 1e-6) break;
    th -= first / second;
    th = Math.min(max, Math.max(min, th));
  }

  let infoSum = 0;
  for (const r of items) {
    infoSum += itemInfo(th, r.a ?? 1, r.b ?? 0, r.c ?? 0.2);
  }
  const se = infoSum > 0 ? 1 / Math.sqrt(infoSum) : 1;
  return { theta: th, se };
}

/** Pick unseen item maximizing information at current theta. */
export function selectNextItem(items, theta, seenIds = new Set()) {
  const seen = seenIds instanceof Set ? seenIds : new Set(seenIds);
  let best = null;
  let bestInfo = -1;
  for (const item of items) {
    const id = String(item.id);
    if (seen.has(id)) continue;
    const info = itemInfo(theta, item.a ?? item.irt_discrimination, item.b ?? item.irt_difficulty, item.c ?? item.irt_guessing);
    if (info > bestInfo) {
      bestInfo = info;
      best = item;
    }
  }
  return best;
}

export function estimateFromPValue(pValue) {
  const n = Number(pValue);
  // Number.isFinite (not ||) so a genuine p-value of 0 (always missed) isn't
  // mistaken for "missing" and silently replaced by the 0.5 fallback.
  const p = Math.min(0.99, Math.max(0.01, Number.isFinite(n) ? n : 0.5));
  // Rough: harder items have lower p → higher b
  return -Math.log(p / (1 - p));
}

export function difficultyFromLevel(level) {
  const l = String(level || '').toLowerCase();
  if (l === 'beginner' || l === 'baslawish') return -1;
  if (l === 'advanced' || l === 'joqari') return 1;
  return 0;
}
