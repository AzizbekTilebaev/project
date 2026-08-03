/**
 * Kitap paragrafında basılatuǵın sóz tokenleri.
 */

/** @returns {string[]} */
export function splitTappableParts(text) {
  return String(text || '').split(/([\p{L}\p{N}’'\u2019-]+)/gu);
}

/** Harip tokeni (≥3) — tıńlaw / punktuatciya emes. */
export function isTappableLemma(part) {
  const raw = String(part || '');
  if (!/^[\p{L}\p{N}]/u.test(raw)) return false;
  const letters = raw.replace(/[’'\u2019-]+/g, '');
  return letters.length >= 3 && /[\p{L}]{3,}/u.test(letters);
}
