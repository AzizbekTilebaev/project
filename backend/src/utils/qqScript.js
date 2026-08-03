/**
 * Qaraqalpaq jazıwları arasında best-effort transliteratsiya:
 *   Cyrillic (А Ә Б ... Ў Ү Ң) <-> Latin (A Á B ... W Ú Ń)
 *
 * - Punktuatsiya, sanlar hám qatar boluwları (line breaks) saqlanadı.
 * - Belgisiz simvollar ózgerissiz qaldırıladı.
 * - normalizeSource() aralas jazılǵan tekstlerdi tazalaydı
 *   (latın schwa Ə/ə -> kirill Ә/ә, ӊ -> ң, CRLF -> LF).
 *
 * Lossy jaǵdaylar (best-effort, hújjetlengen):
 * - ъ/ь latında túsip qaladı; щ -> sh; э -> e; ё -> yo (keri: й+о).
 * - Kirill "йа"/"йу" izbe-izligi keri aylandırǵanda "я"/"ю" boladı —
 *   milliy orfografiyada bul ádette durıs forma.
 * - Bas hárip Ы = "Í" (I-acute), bas hárip И = "I".
 */

// --- normalizeSource -------------------------------------------------------

const SOURCE_FIXES = new Map([
  ['\u018F', '\u04D8'], // Ə (latın capital schwa) -> Ә (kirill)
  ['\u0259', '\u04D9'], // ə (latın small schwa)   -> ә (kirill)
  ['\u04C9', '\u04A2'], // Ӊ (en with tail)        -> Ң
  ['\u04CA', '\u04A3'], // ӊ                       -> ң
  ['\u2018', "'"],
  ['\u2019', "'"],
  ['\u02BB', "'"],
  ['\u02BC', "'"],
]);

/**
 * Derek tekstti import aldınan tazalaydı: NFC, BOM alıp taslaw,
 * aralas schwa/ń formaların birlestiriw, CRLF -> LF.
 * Mazmun, punktuatsiya hám qatar boluwları saqlanadı.
 */
export function normalizeSource(text) {
  let s = String(text ?? '');
  if (!s) return '';
  s = s.replace(/^\uFEFF/, '').normalize('NFC');
  s = s.replace(/\r\n?/g, '\n');
  let out = '';
  for (const ch of s) out += SOURCE_FIXES.get(ch) ?? ch;
  return out;
}

/**
 * Eski apostrof-Lotin (`g'`, `n'`, `o'`, `u'`, `a'`, `i'`) → standart QQ Latin.
 * Telegram / eski manbalar ushın. Digraflar (sh/ch) saqlanadı.
 */
export function normalizeApostropheLatin(text) {
  let s = normalizeSource(text);
  if (!s) return '';
  // Order matters: longer / more specific first
  const pairs = [
    [/g['`´]/gi, (m) => (m[0] === 'G' ? 'Ǵ' : 'ǵ')],
    [/n['`´]/gi, (m) => (m[0] === 'N' ? 'Ń' : 'ń')],
    [/o['`´]/gi, (m) => (m[0] === 'O' ? 'Ó' : 'ó')],
    [/u['`´]/gi, (m) => (m[0] === 'U' ? 'Ú' : 'ú')],
    [/a['`´']/gi, (m) => (m[0] === 'A' ? 'Á' : 'á')],
    [/i['`´']/gi, (m) => (m[0] === 'I' ? 'Í' : 'ı')],
  ];
  for (const [re, fn] of pairs) s = s.replace(re, fn);
  return s;
}

// --- Cyrillic -> Latin -----------------------------------------------------

const CYR_TO_LAT = {
  а: 'a', ә: 'á', б: 'b', в: 'v', г: 'g', ғ: 'ǵ', д: 'd', е: 'e',
  ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k', қ: 'q', л: 'l',
  м: 'm', н: 'n', ң: 'ń', о: 'o', ө: 'ó', п: 'p', р: 'r', с: 's',
  т: 't', у: 'u', ў: 'w', ү: 'ú', ф: 'f', х: 'x', ҳ: 'h', ц: 'c',
  ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'ı', ь: '', э: 'e',
  ю: 'yu', я: 'ya',
  // qoңsı álipbelerden kirip qalǵan háripler (aralas dereklerde ushırasadı)
  і: 'i', ұ: 'u',
};

// --- Latin -> Cyrillic -----------------------------------------------------

// Digraflar dáslep tekseriledi. "yo" áyne túrde alınbaydı:
// "yosh" sıyaqlı sózler buzılmawı ushın (ё júdá siyrek, rus sózlerinde ǵana).
const LAT_DIGRAPHS = {
  sh: 'ш', ch: 'ч', ya: 'я', yu: 'ю',
};

const LAT_TO_CYR = {
  a: 'а', á: 'ә', b: 'б', c: 'ц', d: 'д', e: 'е', f: 'ф', g: 'г',
  ǵ: 'ғ', h: 'ҳ', i: 'и', ı: 'ы', í: 'ы', j: 'ж', k: 'к', l: 'л',
  m: 'м', n: 'н', ń: 'ң', o: 'о', ó: 'ө', p: 'п', q: 'қ', r: 'р',
  s: 'с', t: 'т', u: 'у', ú: 'ү', v: 'в', w: 'ў', x: 'х', y: 'й',
  z: 'з',
};

// --- case helpers ----------------------------------------------------------

function isUpper(ch) {
  return Boolean(ch) && ch !== ch.toLowerCase() && ch === ch.toUpperCase();
}

function isLetter(ch) {
  return Boolean(ch) && /\p{L}/u.test(ch);
}

/**
 * Kóp háripli natiyjege (mısalı "sh", "ya") derek háriptiń registrin
 * qollanadı: qasındaǵı háripler de úlken bolsa "SH", bolmasa "Sh".
 */
function applyCase(mapped, srcUpper, neighborUpper) {
  if (!srcUpper || !mapped) return mapped;
  if (mapped.length === 1) return mapped.toUpperCase();
  return neighborUpper
    ? mapped.toUpperCase()
    : mapped[0].toUpperCase() + mapped.slice(1);
}

// --- toLatin ----------------------------------------------------------------

/**
 * Kirill tekstti Qaraqalpaq latınına aylandıradı (best-effort).
 * Aldın normalizeSource() qollanıladı, sonlıqtan aralas Ə/ӊ da isleydi.
 */
export function toLatin(text) {
  // Apostrof-Lotin kirse — avval standartlaştırıp, keyin qayta aylandırmaymız
  let s = normalizeSource(text);
  if (!s) return '';
  if (detectScript(s) === 'latin' || /[a-zA-Z]['`´]/.test(s)) {
    s = normalizeApostropheLatin(s);
  }
  // Aralas yamasa qalǵan kirill háripleri bar bolsa — dáim map qilamız
  // (erte return Cyrillic leak beredi: "Qaraqalpaq Ж" → "...Ж").
  const chars = Array.from(s);
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const lower = ch.toLowerCase();
    const mapped = CYR_TO_LAT[lower];
    if (mapped === undefined) {
      out += ch;
      continue;
    }
    if (ch === 'Ы') {
      out += 'Í'; // "ı".toUpperCase() latın álipbesinde Í dep jazıladı
      continue;
    }
    const next = chars[i + 1];
    const prev = chars[i - 1];
    const neighborUpper =
      (isLetter(next) && isUpper(next)) ||
      (!isLetter(next) && isLetter(prev) && isUpper(prev));
    out += applyCase(mapped, isUpper(ch), neighborUpper);
  }
  return out;
}

// --- toCyrillic -------------------------------------------------------------

/**
 * Qaraqalpaq latın tekstin kirillge aylandıradı (best-effort).
 * Digraflar (sh, ch, ya, yu) registrge qaramastan tanıladı.
 * Kirill háripler ózgerissiz qaldırıladı (aralas tekst qáwipsiz).
 */
export function toCyrillic(text) {
  const s = normalizeApostropheLatin(normalizeSource(text));
  if (!s) return '';
  const chars = Array.from(s);
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const code = ch.codePointAt(0);
    if (code >= 0x0400 && code <= 0x04ff) {
      out += ch;
      continue;
    }
    const lower = ch.toLowerCase();
    const next = chars[i + 1];
    if (next !== undefined) {
      const pair = lower + next.toLowerCase();
      const di = LAT_DIGRAPHS[pair];
      if (di !== undefined) {
        out += isUpper(ch) ? di.toUpperCase() : di;
        i += 1;
        continue;
      }
    }
    if (ch === 'İ') {
      out += 'И';
      continue;
    }
    const mapped = LAT_TO_CYR[lower];
    if (mapped === undefined) {
      out += ch;
      continue;
    }
    out += isUpper(ch) ? mapped.toUpperCase() : mapped;
  }
  return out;
}

// --- detectScript -----------------------------------------------------------

const LATIN_EXTRA = new Set(['á', 'ǵ', 'ń', 'ó', 'ú', 'ı', 'í', 'Á', 'Ǵ', 'Ń', 'Ó', 'Ú', 'Í']);

/**
 * Teksttiń tiykarǵı jazıwın anıqlaydı.
 * @returns {'cyrillic'|'latin'|'mixed'|'unknown'}
 */
export function detectScript(text) {
  const s = String(text ?? '');
  let cyr = 0;
  let lat = 0;
  for (const ch of s) {
    const code = ch.codePointAt(0);
    if ((code >= 0x0400 && code <= 0x04ff) || code === 0x018f || code === 0x0259) cyr += 1;
    else if ((code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a) || LATIN_EXTRA.has(ch)) lat += 1;
  }
  const total = cyr + lat;
  if (total === 0) return 'unknown';
  if (cyr / total >= 0.9) return 'cyrillic';
  if (lat / total >= 0.9) return 'latin';
  return 'mixed';
}

// --- import járdemshileri ----------------------------------------------------

/**
 * Jazıwshı atınan turaqlı ASCII slug jasaydı: "Аббазов Сағыйдулла"
 * -> "abbazov-sagiydulla".
 */
export function slugifyWriterName(name) {
  const latin = toLatin(name)
    .toLowerCase()
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return latin || 'writer';
}

/**
 * HTML (<br>, <p> h.t.b.) aralasqan biografiyani taza abzatslarǵa aylandıradı.
 * Abzatslar "\n\n" menen ajıratıladı.
 */
export function stripHtmlToPlain(html) {
  return normalizeSource(html)
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/\s*p\s*>/gi, '\n')
    .replace(/<\s*p[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .split(/\n+/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');
}

/**
 * "1930-1990", "1954", "1824 - ..1878", "1929 - 2008" sıyaqlı jasaw dáwirin jıllarǵa bóledi.
 */
export function parseLifeSpan(lifeSpan) {
  const raw = String(lifeSpan || '').trim();
  if (!raw) return { birthYear: null, deathYear: null };
  const years = raw.match(/\d{3,4}/g);
  if (!years || !years.length) return { birthYear: null, deathYear: null };
  const birthYear = Number(years[0]) || null;
  const deathYear = years.length > 1 ? Number(years[years.length - 1]) || null : null;
  return { birthYear, deathYear };
}

const MONTHS = {
  январ: 1, январь: 1, январьда: 1, января: 1,
  феврал: 2, февраль: 2, февральда: 2, февраля: 2,
  март: 3, мартта: 3, марта: 3,
  апрел: 4, апрель: 4, апрельде: 4, апреля: 4,
  май: 5, майда: 5, мая: 5,
  июн: 6, июнь: 6, июньде: 6, июня: 6,
  июл: 7, июль: 7, июльде: 7, июля: 7,
  август: 8, августта: 8, августа: 8,
  сентябр: 9, сентябрь: 9, сентябрьде: 9, сентября: 9,
  октябр: 10, октябрь: 10, октябрьде: 10, октября: 10,
  ноябр: 11, ноябрь: 11, ноябрьде: 11, ноября: 11,
  декабр: 12, декабрь: 12, декабрьде: 12, декабря: 12,
  // Latin
  yanvar: 1, fevral: 2, mart: 3, aprel: 4, may: 5, iyun: 6, iyul: 7,
  avgust: 8, sentyabr: 9, oktyabr: 10, noyabr: 11, dekabr: 12,
};

function monthFromToken(raw) {
  const t = String(raw || '')
    .toLowerCase()
    .normalize('NFC')
    .replace(/[^\p{L}]/gu, '');
  if (!t) return null;
  if (MONTHS[t]) return MONTHS[t];
  for (const [k, v] of Object.entries(MONTHS)) {
    if (t.startsWith(k.slice(0, Math.min(5, k.length)))) return v;
  }
  return null;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * Biografiyadan tuwılǵan kún/ay/jıl hám jerdi ajıratıp aladı.
 * Mısal: "1930-жылы 5-майда Тахтакөпир районында … туўылған"
 */
export function parseBirthFacts(biography, lifeSpan = '') {
  const plain = stripHtmlToPlain(biography || '');
  const text = plain || String(biography || '');
  const { birthYear: spanBirth, deathYear: spanDeath } = parseLifeSpan(lifeSpan);

  let birthYear = spanBirth;
  let deathYear = spanDeath;
  let birthMonth = null;
  let birthDay = null;
  let birthplace = null;

  // "... 1930-жылы 5-майда ..." yamasa "... 1929-jıl 5-mayda ..."
  const dateRe =
    /(\d{3,4})\s*[-–]?\s*(?:жылы|жыл|jılı|jıl)\s+(?:(\d{1,2})\s*[-–]?\s*)?([A-Za-zА-Яа-яӘәӨөҮүҰұҚқҒғҢңЎўÍıǴǵŃńÚúÓóÁá]+)/giu;
  let m;
  while ((m = dateRe.exec(text)) !== null) {
    const y = Number(m[1]);
    const day = m[2] ? Number(m[2]) : null;
    const month = monthFromToken(m[3]);
    if (y >= 700 && y <= 2100) {
      if (!birthYear) birthYear = y;
      if (birthYear === y && month) {
        birthMonth = month;
        if (day && day >= 1 && day <= 31) birthDay = day;
        break;
      }
    }
  }

  // Latin "1929-jıl 5-mayda"
  if (!birthMonth) {
    const latRe = /(\d{3,4})\s*[-–]?\s*jıl(?:ı)?\s+(\d{1,2})\s*[-–]?\s*([a-záǵıńóú]+)/gi;
    const lm = latRe.exec(text);
    if (lm) {
      const y = Number(lm[1]);
      const day = Number(lm[2]);
      const month = monthFromToken(lm[3]);
      if (y >= 700 && y <= 2100) {
        birthYear = birthYear || y;
        if (month) {
          birthMonth = month;
          if (day >= 1 && day <= 31) birthDay = day;
        }
      }
    }
  }

  // Place before "туўылған" / "tuwılǵan"
  const placeRe =
    /([^.!?\n]{0,120}?)\s*(?:туўылған|тууылған|туылған|tuwılǵan|tuwilgan|tuwılgan)/iu;
  const pm = text.match(placeRe);
  if (pm) {
    let chunk = pm[1]
      .replace(/\s+/g, ' ')
      // "... 1909-жылы " boliminen keyin
      .replace(/^.*?(?:жылы|жыл|jılı|jıl)\s+/iu, '')
      // tek san menen baslanǵan kún-ay tokenin alıp taslaymız ("5-майда"),
      // jer atınıń birinshi sózin emes
      .replace(/^\d{1,2}\s*[-–]?\s*\p{L}+\s*/u, '')
      .replace(/^[,.\s]+|[,.\s]+$/g, '')
      .trim();
    // Keep the trailing place phrase (район / қала / аўыл / rayon ...)
    const placeHit = chunk.match(
      /((?:[А-ЯA-ZÁÓÚÍǴŃӘӨҮҚҒҢЎ][\p{L}'-]{1,40}\s+){0,4}(?:районында|районы|қаласында|қаласы|аўылында|аўылы|посёлогинда|поселкесинде|rayonında|rayonı|qalasında|qalası|awılında|awılı)[^\n,]{0,40})$/iu
    );
    if (placeHit) chunk = placeHit[1].trim();
    // Jıl markerinde toqtap qalǵan yamasa jıl sanı qalǵan chunk — jer atı emes
    const looksLikeYearTail =
      /(?:жылы|жыл|jılı|jıl)$/iu.test(chunk) || /\d{3,4}/.test(chunk);
    if (!looksLikeYearTail && chunk.length >= 4 && chunk.length <= 180) birthplace = chunk;
  }

  let birthPrecision = 'year';
  let birthDate = null;
  if (birthYear && birthMonth && birthDay) {
    birthPrecision = 'day';
    birthDate = `${birthYear}-${pad2(birthMonth)}-${pad2(birthDay)}`;
  } else if (birthYear && birthMonth) {
    birthPrecision = 'month';
    birthDate = `${birthYear}-${pad2(birthMonth)}-01`;
  } else if (birthYear) {
    birthPrecision = 'year';
  }

  return {
    birthYear,
    deathYear,
    birthMonth,
    birthDay,
    birthDate,
    birthPrecision,
    birthplaceOriginal: birthplace,
    birthplaceLatin: birthplace ? toLatin(birthplace) : null,
  };
}

/**
 * Biografiyadan jıl boyınsha ómir jolı (portfolio) hám atalǵan shıǵarmalardı ajıratadı.
 * Mısal gápler:
 *   "Ол 1929-жылы педагогикалық курсты питкерип..."      → education
 *   "1935-жылы ... газетасында мәденият бөлимин басқарады" → career
 *   "Жазыўшылар аўқамына ағза болды"                       → membership
 *   "1942-жылы самолёт апатынан қайтыс болды"              → death
 *   «Қосықлар» (1930), «Жеңилмегенлер» (1940)              → works
 */
export function parseBioTimeline(biography) {
  const plain = stripHtmlToPlain(biography || '');
  const text = plain || String(biography || '');
  if (!text.trim()) return { events: [], works: [] };

  // «Title» (1930) — atalǵan shıǵarmalar
  const works = [];
  const seenWorks = new Set();
  const workRe = /[«"“]([^«»"”]{2,90})[»"”]\s*\(\s*(\d{4})\s*\)/g;
  let wm;
  while ((wm = workRe.exec(text)) !== null) {
    const title = wm[1].replace(/\s+/g, ' ').trim();
    const year = Number(wm[2]);
    const key = title.toLowerCase();
    if (year >= 1000 && year <= 2100 && !seenWorks.has(key)) {
      seenWorks.add(key);
      works.push({ title, year });
    }
  }

  const events = [];
  const pushEvent = (year, kind, sentence) => {
    const clean = String(sentence || '').replace(/\s+/g, ' ').trim();
    if (!clean || clean.length < 8 || clean.length > 400) return;
    if (events.some((e) => e.year === year && e.text === clean)) return;
    events.push({ year, kind, text: clean });
  };

  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  // Segment (jıl átirapındaǵı tekst) boyınsha klassifikaciya —
  // "1832-жылы туўылып, 1897-жылы қайтыс болған" → 1832 birth + 1897 death
  const classifySegment = (seg) => {
    if (/туўыл|тууыл|туыл(?!а)|tuwıl|tuwil/iu.test(seg)) return 'birth';
    if (/қайтыс|қаза\s+бол|дүньядан\s+өт|вафат|qaytıs|qaza\s+bol|ólgen|óledi/iu.test(seg))
      return 'death';
    if (
      /(аўқам|awqam|союз|soyuz)[^.!?]*?(ағза|aǵza|член)/iu.test(seg) ||
      /(ағза|aǵza|член)[^.!?]*?(аўқам|awqam|союз|soyuz)/iu.test(seg)
    )
      return 'membership';
    if (/питкер|тамамла|оқыў|оқыйды|оқыды|студент|институт|курс|мектеб|pitker|tamamla|oqıw|oqıydı|institut|kurs|mekteb/iu.test(seg))
      return 'education';
    if (
      /[«"“][^«»"”]{2,90}[»"”]/.test(seg) &&
      /жариялан|шықты|басыл|жарық\s+көр|жазыл|jarıyalan|shıqtı|basıl|jarıq|jazıl/iu.test(seg)
    )
      return 'work';
    return null;
  };

  const yearRe = /(\d{4})\s*[-–]?\s*(?:жылдан|жылы|жыл|jıldan|jılı|jıl)/giu;
  for (const s of sentences) {
    const matches = [...s.matchAll(yearRe)].filter((m) => {
      const y = Number(m[1]);
      return y >= 1000 && y <= 2100;
    });
    if (!matches.length) continue;

    for (let i = 0; i < matches.length; i += 1) {
      const year = Number(matches[i][1]);
      const segStart = matches[i].index;
      const segEnd = i + 1 < matches.length ? matches[i + 1].index : s.length;
      const segment = s.slice(segStart, segEnd);
      const kind =
        classifySegment(segment) ||
        (matches.length === 1 ? classifySegment(s) : null) ||
        'career';
      pushEvent(year, kind, s);
    }
  }

  // Shıǵarmalar da timeline'ǵa (portfolio kórinisi ushın)
  for (const w of works) {
    if (!events.some((e) => e.year === w.year && e.kind === 'work' && e.text.includes(w.title))) {
      pushEvent(w.year, 'work', `«${w.title}» жарияланды`);
    }
  }

  events.sort((a, b) => a.year - b.year || (a.kind === 'birth' ? -1 : 0));
  return { events, works };
}

/**
 * Tekst juftligin (Kirill + Latin) qáwipsiz jasaydı.
 * Derek qaysı jazıwda bolsa — sol saqlanadı, ekinshi awdarıladı.
 */
export function ensureScriptPair(text) {
  const raw = normalizeSource(text || '');
  if (!raw) return { cyrillic: '', latin: '', sourceScript: 'unknown' };
  const script = detectScript(raw);
  if (script === 'latin') {
    // toLatin() apostrof-Lotinni ham, qalǵan kirill háriplerdi ham tazalaydı
    const latin = toLatin(raw);
    return { cyrillic: toCyrillic(latin), latin, sourceScript: 'latin' };
  }
  if (script === 'cyrillic') {
    return { cyrillic: raw, latin: toLatin(raw), sourceScript: 'cyrillic' };
  }
  // mixed / unknown — best-effort: keep as Cyrillic source if more Cyr letters
  const latin = toLatin(raw);
  const cyrillic = toCyrillic(raw);
  return { cyrillic: cyrillic || raw, latin: latin || raw, sourceScript: script };
}

/**
 * She'r sońındaǵı jıl/sana/jer qatarların tanadan ajıratadı.
 * Mısal: "1966-жыл", "1963- жыл, октябрь", "Нөкис, 1971-жыл"
 */
export function parsePoemTrailingMeta(paragraphs) {
  const paras = Array.isArray(paragraphs) ? [...paragraphs] : [];
  if (!paras.length) {
    return {
      paragraphs: [],
      meta: {
        workYear: null,
        workDateLabelCyrillic: null,
        workDateLabelLatin: null,
        workPlaceCyrillic: null,
        workPlaceLatin: null,
      },
    };
  }

  const metaLines = [];
  const yearLike =
    /^\s*(?:[^\n,]{0,60},\s*)?(\d{4})\s*[-–]?\s*(?:жылы|жыл|jılı|jıl)(?=$|[\s,.;:!?\-–])/iu;
  const explicitPlaceLike =
    /(?:қаласы|қаласында|районы|районында|аўылы|аўылында|поселкеси|поселкесинде|qalası|qalasında|rayonı|rayonında|awılı|awılında|poselkesi|poselkesinde)$/iu;
  const isShortPlace = (line) => {
    const t = String(line || '').trim();
    if (!t || t.length > 80) return false;
    return (
      t.length <= 40 &&
      /^(?:[А-ЯA-ZÁÓÚÍǴŃӘӨҮҚҒҢЎ][\p{L}'-]{1,30}(?:\s+[А-ЯA-ZÁÓÚÍǴŃӘӨҮҚҒҢЎ][\p{L}'-]{1,30}){0,3})$/u.test(
        t
      ) &&
      !/[.!?«»"]/.test(t)
    );
  };
  const canPeelPlace = (line, adjacentLine = '') =>
    isShortPlace(line) &&
    (metaLines.some((x) => yearLike.test(x)) ||
      yearLike.test(adjacentLine) ||
      explicitPlaceLike.test(line));

  while (paras.length > 1) {
    const last = String(paras[paras.length - 1] || '').trim();
    // Multi-line last para: peel trailing short lines
    const lines = last.split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length > 1) {
      let peeled = false;
      while (lines.length > 1) {
        const candidate = lines[lines.length - 1];
        const previous = lines[lines.length - 2] || '';
        if (!yearLike.test(candidate) && !canPeelPlace(candidate, previous)) break;
        metaLines.unshift(lines.pop());
        peeled = true;
      }
      // "Нөкис, 1956-жыл.\nЕскертиўлер: ..." — sana birinshi qatarda,
      // keyin redaktor izohı. Tek tolıq sana qatarın ajıratamız
      // (qosıq qatarı "1941-жыл келди..." qáte alınbaydı).
      const fullYearLine =
        /^\s*(?:[^\n,]{0,40},\s*)?\d{4}\s*[-–]?\s*(?:жылы|жыл|jılı|jıl)[.,;:!?\s]*$/iu;
      if (!peeled && fullYearLine.test(lines[0])) {
        metaLines.unshift(lines.shift());
        peeled = true;
      }
      if (peeled) {
        paras[paras.length - 1] = lines.join('\n');
        continue;
      }
    }
    const previousParagraph = String(paras[paras.length - 2] || '').trim();
    if ((yearLike.test(last) && last.length <= 80) || canPeelPlace(last, previousParagraph)) {
      metaLines.unshift(paras.pop().trim());
      continue;
    }
    break;
  }

  let workYear = null;
  let dateLabel = null;
  let place = null;
  const monthNameRe =
    /(?:январ|феврал|март|апрел|май|мая|июн|июл|август|сентябр|октябр|ноябр|декабр|yanvar|fevral|mart|aprel|may|iyun|iyul|avgust|sentyabr|oktyabr|noyabr|dekabr)/iu;
  const dayMonthRe = new RegExp(
    `^\\d{1,2}\\s*[-–.]?\\s*${monthNameRe.source}`,
    'iu'
  );
  // Oy atı yamasa kún-oy — bul jer atı emes, sana bólegi.
  // Aralas jazıwlı OCR tokenler ("iюn") ushın eki jazıwǵa da aylandırıp tekseremiz.
  const looksLikeDateFragment = (s) => {
    const variants = [s, toCyrillic(s), toLatin(s)].map((v) =>
      String(v || '').replace(/['`´ь]/giu, '')
    );
    return variants.some((v) => dayMonthRe.test(v) || monthNameRe.test(v));
  };

  for (const line of metaLines) {
    const y = line.match(/(\d{4})/);
    if (y) {
      const n = Number(y[1]);
      if (n >= 1000 && n <= 2100) workYear = n;
      dateLabel = dateLabel ? `${line}, ${dateLabel}` : line;
    } else if (looksLikeDateFragment(line)) {
      dateLabel = dateLabel ? `${dateLabel}, ${line}` : line;
    } else if (!place) {
      place = line;
    }
  }

  // Date label ishinde jer atı bolsa ajıratamız:
  // "Нөкис, 1971-жыл" / "1971-жыл, Нөкис" / "18-июнь, 1992жыл. Бийсен аўыл."
  // Tek qısqa, bir qatarlı, tırnaqsız footerler ushın (eskertiw/izoh emes).
  const splittableDateLabel =
    dateLabel && !place && !/\n/.test(dateLabel) && dateLabel.length <= 60 && !/[«»"()]/.test(dateLabel);
  if (splittableDateLabel) {
    const tokens = dateLabel
      .split(/[,;]| (?=\p{Lu}\p{Ll}+\s+(?:аўыл|awıl|аулы|қала|qala))/u)
      .map((tok) => tok.trim().replace(/^[.\s]+|[.\s]+$/g, ''))
      .filter(Boolean);
    if (tokens.length > 1) {
      const dateTokens = [];
      const placeTokens = [];
      for (const tok of tokens) {
        if (/\d{4}/.test(tok) || looksLikeDateFragment(tok)) dateTokens.push(tok);
        else if (tok.length >= 2 && tok.length <= 40 && /\p{L}/u.test(tok))
          placeTokens.push(tok);
        else dateTokens.push(tok);
      }
      if (placeTokens.length && dateTokens.length) {
        dateLabel = dateTokens.join(', ');
        place = placeTokens.join(', ');
      }
    }
  }

  const datePair = dateLabel ? ensureScriptPair(dateLabel) : null;
  const placePair = place ? ensureScriptPair(place) : null;

  return {
    paragraphs: paras,
    meta: {
      workYear,
      workDateLabelCyrillic: datePair?.cyrillic || null,
      workDateLabelLatin: datePair?.latin || null,
      workPlaceCyrillic: placePair?.cyrillic || null,
      workPlaceLatin: placePair?.latin || null,
    },
  };
}

export default {
  toLatin,
  toCyrillic,
  normalizeSource,
  normalizeApostropheLatin,
  detectScript,
  ensureScriptPair,
  slugifyWriterName,
  stripHtmlToPlain,
  parseLifeSpan,
  parseBirthFacts,
  parseBioTimeline,
  parsePoemTrailingMeta,
};
