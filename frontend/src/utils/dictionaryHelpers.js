export const FALLBACK_LETTERS = [
  'А', 'Ә', 'Б', 'В', 'Г', 'Ғ', 'Д', 'Е', 'Ё', 'Ж', 'З', 'И', 'Й', 'К', 'Қ', 'Л', 'М', 'Н', 'Ң',
  'О', 'Ө', 'П', 'Р', 'С', 'Т', 'У', 'Ү', 'Ў', 'Ф', 'Х', 'Ҳ', 'Ц', 'Ч', 'Ш', 'Щ', 'Ы', 'Э', 'Ю', 'Я', 'І',
];

/** { before, match, after } yoki null — JSX komponentida chiziladi */
export function splitHighlight(text, query) {
  if (!query?.trim() || !text) return null;
  const q = query.trim();
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return null;
  return {
    before: text.slice(0, i),
    match: text.slice(i, i + q.length),
    after: text.slice(i + q.length),
  };
}

/** Havola-yozuv (к./қ. = «qara») nishonini aniqlash */
export function referenceTarget(entry) {
  const cat = (entry.category || '').trim().toLowerCase();
  const def = (entry.birinshi_aniqlama || '').trim();
  if (!def || def.length > 60) return null;
  const cleaned = def.replace(/\([^)]*\)/g, '').trim();
  const isRefCat = cat === 'к.' || cat === 'қ.';
  const startsWithRef = /^[кқ]\.\s+/.test(cleaned);
  if (!isRefCat && !startsWithRef) return null;
  const target = cleaned.replace(/^[кқ]\.\s*/, '').replace(/\.$/, '').trim();
  if (!target || target.length > 30 || target.split(/\s+/).length > 3) return null;
  return target;
}

/** Grammatik havola: "азаплаў фейилиниң өзлик дәрежеси." -> { base, form } */
export function grammarRefTarget(entry) {
  const def = (entry.birinshi_aniqlama || '').trim();
  if (!def || def.length > 220) return null;
  const m = def.match(
    /^(.{2,40}?)[,]?\s+фейил(?:лер)?\S*\s+([а-яёәөүғқңҳіў]+)\s+д[әөa]реж\S*/iu
  );
  if (!m) return null;
  const base = m[1].trim().replace(/[,:.]+$/g, '');
  if (!base || base.split(/\s+/).length > 3) return null;
  return { base, form: `${m[2]} dárejesi` };
}

const ROMAN_SUFFIX = /\s+[IVX\u0406\u0425]{1,4}$/u;

export function baseWord(soz) {
  return (soz || '').replace(ROMAN_SUFFIX, '').trim();
}

export function groupHomonyms(entries) {
  const groups = [];
  const byBase = new Map();
  for (const entry of entries) {
    const base = baseWord(entry.soz);
    const isHomonym = base !== entry.soz;
    if (isHomonym && byBase.has(base)) {
      byBase.get(base).items.push(entry);
      continue;
    }
    const group = { base, items: [entry] };
    groups.push(group);
    if (isHomonym) byBase.set(base, group);
  }
  return groups;
}

export const CARD_SHELL =
  'group block rounded-2xl border border-ink/[0.07] bg-white/35 hover:bg-white/55 hover:border-teal-800/20 px-5 py-6 md:px-7 md:py-7 transition-all duration-300 hover:shadow-[0_12px_40px_-20px_rgba(28,42,36,0.35)]';
