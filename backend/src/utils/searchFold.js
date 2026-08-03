/**
 * Qidiruv uchun yagona "folded" fazo: lotin (diakritikali/diakritikasiz)
 * va kirill yozuvlari bitta ko'rinishga keltiriladi.
 *
 * Masalan: "jaqsı", "jaqsi", "ЖАҚСЫ" -> "жакси"
 */

const LATIN_DIGRAPHS = [
  ['sh', 'ш'],
  ['ch', 'ч'],
  ['ya', 'я'],
  ['yu', 'ю'],
  ['yo', 'е'],
  ['ng', 'н'], // ń o'rniga ng yozadiganlar uchun
];

const LATIN_SINGLE = {
  a: 'а', á: 'а', b: 'б', c: 'ц', d: 'д', e: 'е', f: 'ф',
  g: 'г', ǵ: 'г', h: 'х', i: 'и', ı: 'и', j: 'ж', k: 'к',
  l: 'л', m: 'м', n: 'н', ń: 'н', o: 'о', ó: 'о', p: 'п',
  q: 'к', r: 'р', s: 'с', t: 'т', u: 'у', ú: 'у', v: 'в',
  w: 'у', x: 'х', y: 'й', z: 'з',
};

const CYRILLIC_FOLD = {
  ә: 'а', ө: 'о', ү: 'у', ұ: 'у', ў: 'у',
  қ: 'к', ғ: 'г', ң: 'н', ҳ: 'х',
  ы: 'и', і: 'и', э: 'е', ё: 'е',
};

export default function searchFold(text) {
  let s = String(text || '')
    .toLocaleLowerCase('kk')
    .normalize('NFC')
    .trim();
  if (!s) return '';

  for (const [digraph, replacement] of LATIN_DIGRAPHS) {
    s = s.split(digraph).join(replacement);
  }

  let out = '';
  for (const ch of s) {
    if (LATIN_SINGLE[ch]) out += LATIN_SINGLE[ch];
    else if (CYRILLIC_FOLD[ch]) out += CYRILLIC_FOLD[ch];
    else out += ch;
  }

  return out
    .replace(/[^\u0430-\u044fa-z0-9\s-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}
