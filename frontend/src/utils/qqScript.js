/**
 * Qaraqalpaq latin/kirill UI transliteratsiyası.
 * UI tekstleri latin tilinde jazıladı, kirill rejiminde usı járdemshi arqalı kórsetiledi.
 */
const LAT_DIGRAPHS = {
  sh: 'ш',
  ch: 'ч',
  ya: 'я',
  yu: 'ю',
};

const LAT_TO_CYR = {
  a: 'а', á: 'ә', b: 'б', c: 'ц', d: 'д', e: 'е', f: 'ф', g: 'г',
  ǵ: 'ғ', h: 'ҳ', i: 'и', ı: 'ы', í: 'ы', j: 'ж', k: 'к', l: 'л',
  m: 'м', n: 'н', ń: 'ң', o: 'о', ó: 'ө', p: 'п', q: 'қ', r: 'р',
  s: 'с', t: 'т', u: 'у', ú: 'ү', v: 'в', w: 'ў', x: 'х', y: 'й',
  z: 'з',
};

const CYR_TO_LAT = {
  а: 'a', ә: 'á', б: 'b', в: 'v', г: 'g', ғ: 'ǵ', д: 'd', е: 'e',
  ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k', қ: 'q', л: 'l',
  м: 'm', н: 'n', ң: 'ń', о: 'o', ө: 'ó', п: 'p', р: 'r', с: 's',
  т: 't', у: 'u', ў: 'w', ү: 'ú', ф: 'f', х: 'x', ҳ: 'h', ц: 'c',
  ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'ı', ь: '', э: 'e', ю: 'yu',
  я: 'ya', і: 'i', ұ: 'u',
};

function isUpper(ch) {
  return Boolean(ch) && ch !== ch.toLowerCase() && ch === ch.toUpperCase();
}

function mapLatinSegment(value) {
  const chars = Array.from(value);
  let out = '';
  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i];
    if (/[\u0400-\u04ff]/u.test(ch)) {
      out += ch;
      continue;
    }
    const next = chars[i + 1];
    if (next) {
      const mappedPair = LAT_DIGRAPHS[ch.toLowerCase() + next.toLowerCase()];
      if (mappedPair) {
        out += isUpper(ch) ? mappedPair.toUpperCase() : mappedPair;
        i += 1;
        continue;
      }
    }
    const mapped = LAT_TO_CYR[ch.toLowerCase()];
    out += mapped === undefined ? ch : isUpper(ch) ? mapped.toUpperCase() : mapped;
  }
  return out;
}

export function toCyrillic(text) {
  const source = String(text ?? '').normalize('NFC');
  // API, PDF, UUID, URL sıyaqlı texnikalıq belgilerdi ózgertpeymiz.
  return source
    .split(/(https?:\/\/\S+|[\w.+-]+@[\w.-]+\.\w+|[A-Z0-9_-]{2,})/g)
    .map((part) =>
      /^(https?:\/\/|[\w.+-]+@|[A-Z0-9_-]{2,}$)/.test(part) ? part : mapLatinSegment(part)
    )
    .join('');
}

export function toLatin(text) {
  const chars = Array.from(String(text ?? '').normalize('NFC'));
  let out = '';
  for (const ch of chars) {
    const mapped = CYR_TO_LAT[ch.toLowerCase()];
    if (mapped === undefined) {
      out += ch;
    } else if (ch === 'Ы') {
      out += 'Í';
    } else {
      out += isUpper(ch)
        ? mapped.length > 1
          ? mapped[0].toUpperCase() + mapped.slice(1)
          : mapped.toUpperCase()
        : mapped;
    }
  }
  return out;
}

export function inScript(text, script) {
  return script === 'latin' ? toLatin(text) : toCyrillic(text);
}
