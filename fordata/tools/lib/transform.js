const DEFAULT_CATEGORY = 'белгисиз';

const LATIN_CONFUSABLES = {
  A: 'А', B: 'В', C: 'С', E: 'Е', F: 'Ғ', H: 'Н', I: 'І', K: 'К',
  M: 'М', O: 'О', P: 'Р', T: 'Т', X: 'Х', Y: 'У',
  a: 'а', c: 'с', e: 'е', f: 'ғ', i: 'і', o: 'о', p: 'р', x: 'х', y: 'у',
};

function collapseCaseDuplicate(token) {
  const chars = [...token];
  for (let index = 0; index < chars.length - 1; index++) {
    const current = chars[index];
    const next = chars[index + 1];
    const isUpper = current !== current.toLocaleLowerCase('kk');
    const isNextLower = next === next.toLocaleLowerCase('kk');
    if (
      isUpper &&
      isNextLower &&
      current.toLocaleLowerCase('kk') === next.toLocaleLowerCase('kk')
    ) {
      if (index === 0) {
        chars.splice(index + 1, 1);
      } else {
        chars.splice(index, 1);
        index--;
      }
    }
  }
  return chars.join('');
}

/** Conservative OCR cleanup used before importing new dictionary data. */
export function cleanOcrText(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/\u00a0/g, ' ')
    .split(/(\s+)/)
    .map((token) => {
      const hasLatin = /[A-Za-z]/.test(token);
      const hasCyrillic = /[\u0400-\u04ff]/u.test(token);
      const scriptFixed =
        hasLatin && hasCyrillic
          ? token.replace(/[A-Za-z]/g, (char) => LATIN_CONFUSABLES[char] || char)
          : token;
      return collapseCaseDuplicate(scriptFixed);
    })
    .join('')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/** Strip trailing POS crumbs from headword. Keep roman numerals (homonyms). */
export function cleanTitle(raw) {
  let t = cleanOcrText(String(raw || ''));
  // trailing POS like " Ф." / " ат." only when clearly a separate token
  t = t.replace(/\s+(ат|ф|кел|б)\.?$/i, '');
  return t.trim();
}

export function normalizeSoz(soz) {
  return soz.toLocaleLowerCase('kk');
}

/** A sentence is an illustrative example ONLY if it ends with a citation "(Author)". */
const CITATION_END_RE = /\(([^)]{1,80})\)\s*\.?\s*$/;

/**
 * Split definition text into a clean definition + citation-backed examples.
 *
 * Rules (conservative, author-driven):
 *  - Only text ending with "(Author)" becomes an example.
 *  - Author-less text ALWAYS stays in the definition (never a fake example).
 *  - Inline parentheses like "(шағылдырмаўы)" mid-sentence are not citations.
 */
export function splitExamples(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return { definition: '', example: [] };

  // Split into sentences on period + whitespace, but:
  //  - never inside parentheses (citations like "(Д. Насыров, О.Доспанов)" contain periods)
  //  - never after one-letter abbreviations ("т. б.", "ҳ. б.")
  const sentences = trimmed
    .split(/(?<=[^\s.]{2}\.)\s+(?![^(]*\))/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length < 2) {
    return { definition: trimmed, example: [] };
  }

  const defParts = [];
  const example = [];
  let inExamples = false;

  for (const s of sentences) {
    const hasCitation = CITATION_END_RE.test(s);

    if (hasCitation) {
      inExamples = true;
      const m = s.match(/^(.*?)\s*\(([^)]{1,80})\)\s*\.?\s*$/s);
      if (m && m[1].trim().length >= 3) {
        example.push({
          example: m[1].trim().replace(/[.,;\s]+$/, ''),
          author: m[2].trim(),
          order: example.length + 1,
        });
      } else {
        // citation but no meaningful lead text — keep whole sentence in definition
        defParts.push(s);
        inExamples = false;
      }
    } else if (inExamples && example.length) {
      // continuation line of a multi-line quote (e.g. poem) before next citation
      example[example.length - 1].example += ' ' + s.replace(/\.$/, '').trim();
    } else {
      defParts.push(s);
    }
  }

  const definition = defParts.join(' ').trim();
  if (!definition || example.length === 0) {
    // no clean split possible — keep everything as definition
    return { definition: trimmed, example: [] };
  }
  return { definition, example };
}

function mapIdioms(idioms) {
  if (!Array.isArray(idioms) || !idioms.length) return [];
  return idioms
    .map((idm, idx) => {
      const phrase = cleanOcrText(idm.idiom || '');
      const description = cleanOcrText(idm.idiom_text || '');
      if (!phrase) return null;
      // Uzoq, izohsiz "idiom" odatda OCR'da birikib ketgan paragraf bo'ladi.
      if (phrase.length > 120 && !description) return null;
      return {
        phrase: phrase.slice(0, 255),
        description: description || null,
        order: idm.sort_order || idx + 1,
      };
    })
    .filter(Boolean);
}

/**
 * Transform fordata page entries → import-nested payload.
 * @returns {{ items: object[], skipped: { index: number, reason: string }[] }}
 */
export function transformPage(entries, { skipIndexes = [] } = {}) {
  const skipSet = new Set(skipIndexes);
  const items = [];
  const skipped = [];

  entries.forEach((entry, i) => {
    if (skipSet.has(i)) {
      skipped.push({ index: i, reason: 'validation_skip' });
      return;
    }

    const soz = cleanTitle(entry.title);
    if (!soz) {
      skipped.push({ index: i, reason: 'empty_title' });
      return;
    }

    const descriptions = [];
    const defs = Array.isArray(entry.definitions) ? entry.definitions : [];

    defs.forEach((def) => {
      const cats = (Array.isArray(def.categorys) ? def.categorys : [])
        .map((c) => String(c).trim())
        .filter(Boolean);
      const refCategory = cats.find((category) => /^[кқ]\.$/iu.test(category));
      const inlineRefTarget = refCategory
        ? cats.find((category) => !/^[кқ]\.$/iu.test(category))
        : null;
      let text = cleanOcrText(def.text || '');
      let category = cats.length ? cats.join(' ') : DEFAULT_CATEGORY;

      // Source'dagi ref-only yozuvlar va "categorys": ["к.", "тигиў."] holatlari.
      if (!text || text === '.' || text === '...') {
        const target = cleanOcrText(inlineRefTarget || entry.ref_word || '');
        if (!target || (!refCategory && !entry.ref)) return;
        text = target.replace(/[.\s]+$/g, '');
        category = refCategory || cleanOcrText(entry.ref) || 'к.';
      }

      const { definition, example } = splitExamples(text);
      const validExamples = example.filter((item) => item.example?.trim());
      const idioms = mapIdioms(def.idioms);

      const desc = {
        category,
        definition,
        // Source'dagi takrorlangan/gap order_sort'larni tabiiy ketma-ketlikka keltirish.
        order: descriptions.length + 1,
      };
      if (validExamples.length) desc.example = validExamples;
      if (idioms.length) desc.idioms = idioms;
      descriptions.push(desc);
    });

    if (!descriptions.length) {
      skipped.push({
        index: i,
        reason: entry.ref || entry.ref_word ? 'ref_only' : 'no_usable_definitions',
      });
      return;
    }

    const item = {
      soz,
      normalized: normalizeSoz(soz),
      descriptions,
    };

    if (entry.etymology && String(entry.etymology).trim()) {
      item.etymology = {
        description: cleanOcrText(String(entry.etymology)),
        etymology_type: 'unknown',
      };
    }

    if (entry.compound && String(entry.compound).trim()) {
      item.temp_id = `compound:${String(entry.compound).trim()}`;
    }

    items.push(item);
  });

  return { items, skipped };
}
