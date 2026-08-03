/**
 * Levenshtein masofasi — qidiruv typo/fuzzy uchun.
 * Qisqa satrlar uchun O(n*m) yetarli.
 */
export function levenshtein(a, b) {
  const s = String(a || '');
  const t = String(b || '');
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;

  const prev = new Array(t.length + 1);
  const curr = new Array(t.length + 1);
  for (let j = 0; j <= t.length; j++) prev[j] = j;

  for (let i = 1; i <= s.length; i++) {
    curr[0] = i;
    const sc = s.charCodeAt(i - 1);
    for (let j = 1; j <= t.length; j++) {
      const cost = sc === t.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= t.length; j++) prev[j] = curr[j];
  }
  return prev[t.length];
}

/** So‘z uzunligiga qarab ruxsat etilgan max masofa */
export function maxEditDistance(len) {
  const n = Number(len) || 0;
  if (n <= 3) return 1;
  if (n <= 6) return 2;
  if (n <= 10) return 3;
  return 4;
}
