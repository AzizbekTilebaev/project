/**
 * Flat gloss → numbered senses + citation-backed examples.
 * Supports "1." / "2." and "1)" / "2)" markers.
 */
import searchFold from './searchFold.js';

const CITATION_END_RE = /\(([^)]{1,100})\)\s*\.?\s*$/u;

export function normalizeAuthorName(author) {
  return String(author || '')
    .replace(/^(?:shayır|shayir|шайыр)\s+/iu, '')
    .replace(/\s+(?:shayır|shayir|шайыр)\.?$/iu, '')
    .replace(/[\s.,;:–—-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isNonPersonAuthor(author) {
  const a = String(author || '').toLowerCase();
  if (!a || a.length < 2) return true;
  return /газета|журнал|ертек|дастан|сөзлик|словарь|хрестомат|халық|xalıq|máspatsha|маспатша|qaraqalpaq|қарақалпақ\s*тил|из\s*газет|из\s*книг|см\.|қараңыз|тусіндірме/i.test(
    a
  );
}

/**
 * Split one sense/definition blob into definition + examples ending with "(Author)".
 */
export function splitCitationExamples(text) {
  const trimmed = String(text || '').replace(/\s+/g, ' ').trim();
  if (!trimmed) return { definition: '', examples: [] };

  const sentences = trimmed
    .split(/(?<=[^\s.]{2}\.)\s+(?![^(]*\))/u)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length < 2) {
    // single sentence with trailing citation → still extract
    const m = trimmed.match(/^(.*?)\s*\(([^)]{1,100})\)\s*\.?\s*$/su);
    if (m && m[1].trim().length >= 8 && !/[0-9]+[.)]\s*$/.test(m[1])) {
      const author = m[2].trim();
      // Prefer splitting only when lead looks like a full example sentence
      if (/[.!?…]$/.test(m[1].trim()) || m[1].trim().split(/\s+/).length >= 5) {
        return {
          definition: '',
          examples: [
            {
              example: m[1].trim().replace(/[.,;\s]+$/u, ''),
              author,
            },
          ],
        };
      }
    }
    return { definition: trimmed, examples: [] };
  }

  const defParts = [];
  const examples = [];
  let inExamples = false;

  for (const s of sentences) {
    const hasCitation = CITATION_END_RE.test(s);
    if (hasCitation) {
      inExamples = true;
      const m = s.match(/^(.*?)\s*\(([^)]{1,100})\)\s*\.?\s*$/su);
      if (m && m[1].trim().length >= 3) {
        examples.push({
          example: m[1].trim().replace(/[.,;\s]+$/u, ''),
          author: m[2].trim(),
        });
      } else {
        defParts.push(s);
        inExamples = false;
      }
    } else if (inExamples && examples.length) {
      examples[examples.length - 1].example += ` ${s.replace(/\.$/u, '').trim()}`;
    } else {
      defParts.push(s);
    }
  }

  const definition = defParts.join(' ').trim();
  if (!definition && examples.length) {
    return { definition: '', examples };
  }
  if (!definition || !examples.length) {
    return { definition: trimmed, examples: [] };
  }
  return { definition, examples };
}

/**
 * Parse "1) … 2) …" or "1. … 2. …" into sense list.
 * Falls back to a single sense when no markers found.
 */
export function parseNumberedSenses(text) {
  const plain = String(text || '').replace(/\s+/g, ' ').trim();
  if (!plain) return [];

  const senses = [];
  // Prefer ")" style when present (frazeologiya / mixed OCR)
  const parenParts = plain.split(/(?=\b\d+\)\s*)/u);
  let usedParen = false;
  if (parenParts.length > 1 || /^\d+\)\s*/.test(plain)) {
    for (const chunk of parenParts) {
      const m = chunk.trim().match(/^(\d+)\)\s*(.+)$/su);
      if (m) {
        usedParen = true;
        senses.push({ n: Number(m[1]), text: m[2].trim() });
      }
    }
  }

  if (!usedParen) {
    const dotParts = plain.split(/(?=\b\d+\.\s+)/u);
    for (const chunk of dotParts) {
      const m = chunk.trim().match(/^(\d+)\.\s*(.+)$/su);
      if (m) senses.push({ n: Number(m[1]), text: m[2].trim() });
    }
  }

  if (!senses.length) senses.push({ n: 1, text: plain });
  return senses;
}

/**
 * Full structure: numbered senses, each with definition text + citation examples.
 */
export function structureGloss(text) {
  return parseNumberedSenses(text).map((sense) => {
    const { definition, examples } = splitCitationExamples(sense.text);
    return {
      n: sense.n,
      text: definition || sense.text,
      examples: examples.map((ex, i) => ({
        id: null,
        n: i + 1,
        example: ex.example,
        author: normalizeAuthorName(ex.author) || ex.author,
        authorSlug: null,
        authorId: null,
      })),
    };
  });
}

/** Enrich already-parsed senses (e.g. from senses_json) with nested examples. */
export function enrichSensesWithExamples(senses) {
  if (!Array.isArray(senses) || !senses.length) return [];
  return senses.map((s, idx) => {
    if (Array.isArray(s.examples) && s.examples.length) {
      return {
        n: s.n ?? idx + 1,
        text: s.text || '',
        examples: s.examples.map((ex, i) => ({
          id: ex.id ?? null,
          n: ex.n ?? i + 1,
          example: ex.example || ex.text || '',
          author: ex.author || null,
          authorSlug: ex.authorSlug || null,
          authorId: ex.authorId || null,
        })),
      };
    }
    const { definition, examples } = splitCitationExamples(s.text || '');
    return {
      n: s.n ?? idx + 1,
      text: definition || s.text || '',
      examples: examples.map((ex, i) => ({
        id: null,
        n: i + 1,
        example: ex.example,
        author: normalizeAuthorName(ex.author) || ex.author,
        authorSlug: null,
        authorId: null,
      })),
    };
  });
}

export function authorMatchKeys(author) {
  const norm = normalizeAuthorName(author);
  const fold = searchFold(norm);
  if (!fold) return [];
  const keys = new Set([fold]);

  // "и юсупов" / glued "июсупов"
  const glued = fold.replace(/\s+/g, '');
  if (glued !== fold) keys.add(glued);

  const mGlued = glued.match(/^([а-яa-z])([а-яa-z]{3,})$/u);
  if (mGlued) keys.add(`${mGlued[1]} ${mGlued[2]}`);

  const tokens = fold.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) {
    keys.add(tokens[tokens.length - 1]); // surname-only
    keys.add([...tokens].sort().join(' '));
  }

  return [...keys].filter(Boolean);
}

export { searchFold };
