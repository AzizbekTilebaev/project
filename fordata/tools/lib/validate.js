import { looksLikeCategory } from './known-categories.js';

const PAGE_NUM_RE = /\b\d{2,4}\b/;
const GLUED_LEMMA_RE = /[A-Za-zА-ЯӘҒҚҢӨҮҰҺІа-яәғқңөүұһі]{2,}[A-ZА-ЯӘҒҚҢӨҮҰҺІ]{2,}/;

/**
 * Validate one fordata page (array of entries).
 * @returns {{ ok: boolean, errors: string[], warnings: string[], skipEntries: number[] }}
 */
export function validatePage(entries, { allowShubhali = false } = {}) {
  const errors = [];
  const warnings = [];
  const skipEntries = [];

  if (!Array.isArray(entries)) {
    return { ok: false, errors: ['Root must be an array'], warnings, skipEntries };
  }
  if (entries.length === 0) {
    return { ok: false, errors: ['Page has no entries'], warnings, skipEntries };
  }

  entries.forEach((entry, i) => {
    const prefix = `[${i}]`;
    const reasons = entry._suspicious_reasons || [];

    if (!allowShubhali && reasons.length) {
      warnings.push(`${prefix} has _suspicious_reasons: ${reasons.join(', ')}`);
    }

    if (!entry.title || !String(entry.title).trim()) {
      errors.push(`${prefix} empty title`);
      skipEntries.push(i);
      return;
    }

    const title = String(entry.title).trim();
    if (/\s[фФ]\.?$/.test(title) || /\sат\.?$/i.test(title)) {
      warnings.push(`${prefix} title may include trailing POS: "${title}"`);
    }

    if (!Array.isArray(entry.definitions) || entry.definitions.length === 0) {
      // intentional cross-ref only
      if (entry.ref || entry.ref_word) {
        warnings.push(`${prefix} ref-only entry (no definitions) — will skip import`);
        skipEntries.push(i);
        return;
      }
      errors.push(`${prefix} no definitions`);
      skipEntries.push(i);
      return;
    }

    const orders = entry.definitions.map((d) => d.order_sort);
    const unique = new Set(orders);
    if (unique.size !== orders.length) {
      warnings.push(`${prefix} duplicate order_sort: ${orders.join(',')}`);
    }
    const sorted = [...orders].sort((a, b) => a - b);
    for (let k = 0; k < sorted.length; k++) {
      if (sorted[k] !== k + 1 && sorted[0] === 1) {
        // allow non-1 start but flag gaps
        if (k > 0 && sorted[k] !== sorted[k - 1] + 1 && sorted[k] !== sorted[k - 1]) {
          warnings.push(`${prefix} order_sort gap: ${orders.join(',')}`);
          break;
        }
      }
    }

    let usableDef = false;
    entry.definitions.forEach((def, j) => {
      const dp = `${prefix}.def[${j}]`;
      const text = (def.text || '').trim();
      const cats = Array.isArray(def.categorys) ? def.categorys : [];
      const categoryReference =
        cats.some((category) => /^[кқ]\.$/iu.test(String(category).trim())) &&
        cats.some((category) => !/^[кқ]\.$/iu.test(String(category).trim()));

      if (!text || text === '.' || text === '...') {
        if ((entry.ref && entry.ref_word) || categoryReference) {
          warnings.push(`${dp} empty text restored from reference metadata`);
          usableDef = true;
        } else {
          // Boshqa yaroqli ma'nolar bo'lsa transform bu bo'sh qoldiqni xavfsiz tashlaydi.
          warnings.push(`${dp} empty definition text — skipped`);
        }
      } else {
        usableDef = true;
        if (PAGE_NUM_RE.test(text) && text.length < 40) {
          warnings.push(`${dp} possible page number noise in short text`);
        }
        if (GLUED_LEMMA_RE.test(text)) {
          warnings.push(`${dp} possible OCR glued lemma`);
        }
      }

      for (const c of cats) {
        if (!looksLikeCategory(c) && c.trim().length > 2) {
          // definition words wrongly in categorys
          if (/[а-яәғқңөүұһі]{4,}/i.test(c) && !c.includes('.')) {
            errors.push(`${dp} category looks like definition word: "${c}"`);
          } else {
            warnings.push(`${dp} unusual category: "${c}"`);
          }
        }
      }

      if (Array.isArray(def.idioms)) {
        def.idioms.forEach((idm, k) => {
          const phrase = (idm.idiom || '').trim();
          const gloss = (idm.idiom_text || '').trim();
          if (phrase.length > 120 && !gloss) {
            warnings.push(`${dp}.idiom[${k}] long_idiom_phrase (empty idiom_text)`);
          }
        });
      }
    });

    if (!usableDef) {
      skipEntries.push(i);
    }
  });

  const ok = errors.length === 0 && entries.length > skipEntries.length;
  return { ok, errors, warnings, skipEntries: [...new Set(skipEntries)] };
}
