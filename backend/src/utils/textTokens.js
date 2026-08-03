import searchFold from './searchFold.js';

export const KARAKALPAK_STOPWORDS = new Set([
  'ал', 'алдын', 'аркали', 'бар', 'бенен', 'бер', 'бир', 'бул', 'да', 'де', 'деп',
  'еди', 'екен', 'емес', 'енди', 'хам', 'жане', 'жок', 'менен', 'не', 'ол', 'сон',
  'сонда', 'та', 'те', 'тек', 'ушын', 'хамме', 'оз', 'яки',
].map(searchFold));

export function splitSentences(text) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  return (normalized.match(/[^.!?…]+(?:[.!?…]+|$)/gu) || [])
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

export function tokenize(text, { includeStopwords = false, minLength = 2 } = {}) {
  const folded = searchFold(text);
  if (!folded) return [];
  return folded
    .split(/[\s-]+/u)
    .filter((token) => token.length >= minLength)
    .filter((token) => includeStopwords || !KARAKALPAK_STOPWORDS.has(token));
}

export function tokenFrequency(text, options) {
  const frequency = new Map();
  for (const token of tokenize(text, options)) {
    frequency.set(token, (frequency.get(token) || 0) + 1);
  }
  return frequency;
}

export function sourceWords(text) {
  const words = String(text || '').match(/[\p{L}\p{N}’'-]+/gu) || [];
  const seen = new Set();
  return words.filter((word) => {
    const folded = searchFold(word);
    if (!folded || folded.length < 2 || KARAKALPAK_STOPWORDS.has(folded) || seen.has(folded)) {
      return false;
    }
    seen.add(folded);
    return true;
  });
}

export { searchFold };
