/**
 * Alifbe háribin canonical kirill formaǵa keltiriw (F→Ф, Q→Қ, Ǵ→Ғ).
 * Letter filter / st_let ushın.
 */
import { toCyrillic, toLatin } from './qqScript.js';

const KK_ALPHABET = 'АӘБВГҒДЕЁЖЗИЙКҚЛМНҢОӨПРСТУҮЎФХҲЦЧШЩЪЫІЬЭЮЯ';

/** Homonym rim (I, II, XV-XVI) — st_let esaplawda esapqa alınbaydı */
const ROMAN_PREFIX_RE = /^(?:[IVXLCivxlcІі]{1,8}(?:-[IVXLCivxlcІі]{1,8})?\s+)/;

/**
 * Sózdin canonical st_let (úlken kirill hárip).
 */
export function stLetFromSoz(soz) {
  let s = String(soz || '').trim();
  if (!s) return '';
  s = s.replace(ROMAN_PREFIX_RE, '');
  // "ғарқ іі" — birinshi hárip
  const first = s.charAt(0);
  if (!first) return '';
  const cyr = toCyrillic(first).charAt(0) || first;
  return cyr.toLocaleUpperCase('kk');
}

/**
 * API letter param (F / f / Ф / ф / Ǵ …) → izlew variantları.
 */
export function letterMatchVariants(letter) {
  const raw = String(letter || '').trim();
  if (!raw) return [];
  const ch = Array.from(raw)[0];
  if (!ch) return [];

  const cyr = (toCyrillic(ch).charAt(0) || ch).toLocaleUpperCase('kk');
  const cyrLower = cyr.toLocaleLowerCase('kk');
  const lat = toLatin(cyr).charAt(0) || '';
  const latUpper = lat.toLocaleUpperCase('en-US');
  const latLower = lat.toLocaleLowerCase('en-US');

  const out = new Set([ch, cyr, cyrLower]);
  if (lat) {
    out.add(lat);
    out.add(latUpper);
    out.add(latLower);
  }
  // special: ғ also match Ǵ ǵ
  if (cyr === 'Ф') ['F', 'f'].forEach((x) => out.add(x));
  if (cyr === 'Ғ') ['Ǵ', 'ǵ'].forEach((x) => out.add(x)); // G/g → Г, bul emes
  if (cyr === 'Қ') ['Q', 'q'].forEach((x) => out.add(x));
  if (cyr === 'Ң') ['Ń', 'ń'].forEach((x) => out.add(x));
  if (cyr === 'Ө') ['Ó', 'ó'].forEach((x) => out.add(x));
  if (cyr === 'Ү') ['Ú', 'ú'].forEach((x) => out.add(x));
  if (cyr === 'Ў') ['W', 'w'].forEach((x) => out.add(x));
  if (cyr === 'Ә') ['Á', 'á'].forEach((x) => out.add(x));
  if (cyr === 'Ҳ') ['H', 'h'].forEach((x) => out.add(x));
  if (cyr === 'Г') ['G', 'g'].forEach((x) => out.add(x));

  return [...out].filter(Boolean);
}

export function canonicalLetter(letter) {
  const vars = letterMatchVariants(letter);
  const cyr = vars.find((v) => KK_ALPHABET.includes(v.toLocaleUpperCase('kk')));
  if (cyr) return cyr.toLocaleUpperCase('kk');
  const ch = String(letter || '').charAt(0);
  return (toCyrillic(ch).charAt(0) || ch).toLocaleUpperCase('kk');
}

export { KK_ALPHABET };
