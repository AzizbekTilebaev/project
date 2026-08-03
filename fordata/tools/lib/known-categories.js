/** Known POS / domain abbreviation codes from the Karakalpak dictionary. */
export const KNOWN_CATEGORY_CODES = new Set([
  'ат.',
  'ф.',
  'кел.',
  'сөйл.',
  'сөйл.т.',
  'аўыс.',
  'э rem.',
  'э.',
  'ж.',
  'р.',
  'б.',
  'н.',
  'м.',
  'т.',
  'қ.',
  'д.',
  'с.',
  'ү.',
  'и.',
  'о.',
  'х.',
  'п.',
  'ш.',
  'г.',
  'к.',
  'л.',
  'в.',
  'ч.',
  'ц.',
  'ю.',
  'я.',
  'ә.',
  'ғ.',
  'қ.',
  'ң.',
  'ө.',
  'ү.',
  'ұ.',
  'һ.',
  'і.',
  'диалек.',
  'диал.',
  'көне.',
  'жаңа.',
  'редк.',
  'поэт.',
  'груб.',
  'ласк.',
  'увелич.',
  'уменьш.',
  'собир.',
  'перен.',
  'прям.',
]);

/** Looser match: ends with dot, short token, looks like POS abbr. */
export function looksLikeCategory(token) {
  if (!token || typeof token !== 'string') return false;
  const t = token.trim();
  if (KNOWN_CATEGORY_CODES.has(t)) return true;
  // e.g. "ат.", "сөйл.т.", "ф."
  if (/^[\p{L}]{1,12}(\.[\p{L}]{1,8})*\.?$/u.test(t) && t.length <= 16 && t.includes('.')) {
    return true;
  }
  return false;
}
