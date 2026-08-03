import searchFold from './searchFold.js';

/**
 * Birinshi lemma tokenin _____ menen almastırıw.
 * Token shegarası — substring false positive joq.
 * @returns {string} ózgermegen sentence eger hit joq bolsa
 */
export function clozeWordInSentence(sentence, word) {
  const target = searchFold(word);
  if (!target) return String(sentence || '');
  const parts = String(sentence || '').split(/([\p{L}\p{N}’'-]+)/gu);
  let replaced = false;
  return parts
    .map((part) => {
      if (!replaced && searchFold(part) === target) {
        replaced = true;
        return '_____';
      }
      return part;
    })
    .join('');
}
