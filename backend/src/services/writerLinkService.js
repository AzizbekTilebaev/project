/**
 * Resolve dictionary example authors → literature_writers (shayırlar).
 */
import { DB } from '../config/db.js';
import db from '../config/dictionary.db.js';
import {
  authorMatchKeys,
  isNonPersonAuthor,
  normalizeAuthorName,
  searchFold,
} from '../utils/glossStructure.js';

let cache = null;
let cacheAt = 0;
const TTL_MS = 10 * 60 * 1000;

function emptyIndex() {
  return {
    byFold: new Map(),
    bySurname: new Map(),
  };
}

function addSurname(index, surname, writer) {
  if (!surname || surname.length < 3) return;
  if (!index.bySurname.has(surname)) index.bySurname.set(surname, []);
  const list = index.bySurname.get(surname);
  if (!list.some((w) => w.id === writer.id)) list.push(writer);
}

function registerFold(index, fold, writer) {
  if (!fold) return;
  if (!index.byFold.has(fold)) index.byFold.set(fold, writer);
  const tokens = fold.split(/\s+/).filter(Boolean);
  if (tokens.length) addSurname(index, tokens[tokens.length - 1], writer);
  if (tokens.length === 1) addSurname(index, tokens[0], writer);
}

async function loadIndex() {
  const now = Date.now();
  if (cache && now - cacheAt < TTL_MS) return cache;

  const index = emptyIndex();
  try {
    const [writers] = await db.query(
      `SELECT id, slug, poet_name_original AS nameOriginal, poet_name_latin AS nameLatin
       FROM \`${DB.poets}\`.literature_writers`
    );
    const writerById = new Map();
    for (const w of writers) {
      const writer = {
        id: w.id,
        slug: w.slug,
        name: w.nameLatin || w.nameOriginal,
      };
      writerById.set(w.id, writer);
      for (const raw of [w.nameLatin, w.nameOriginal]) {
        const fold = searchFold(normalizeAuthorName(raw));
        registerFold(index, fold, writer);
        if (fold) {
          const sorted = fold.split(/\s+/).filter(Boolean).sort().join(' ');
          registerFold(index, sorted, writer);
        }
      }
    }

    const [aliases] = await db.query(
      `SELECT writer_id AS writerId, alias_original AS aliasOriginal,
              alias_latin AS aliasLatin, alias_fold AS aliasFold
       FROM \`${DB.poets}\`.writer_aliases`
    );
    for (const a of aliases) {
      const writer = writerById.get(a.writerId);
      if (!writer) continue;
      for (const raw of [a.aliasFold, a.aliasLatin, a.aliasOriginal]) {
        const fold = searchFold(normalizeAuthorName(raw)) || String(a.aliasFold || '').trim();
        registerFold(index, fold, writer);
      }
    }

    cache = index;
    cacheAt = now;
    return index;
  } catch (err) {
    console.warn('[writerLink] index load failed:', err.message);
    cache = emptyIndex();
    cacheAt = now;
    return cache;
  }
}

function resolveAgainstIndex(index, author) {
  if (!author || isNonPersonAuthor(author)) return null;

  for (const key of authorMatchKeys(author)) {
    const hit = index.byFold.get(key);
    if (hit) return hit;
  }

  const fold = searchFold(normalizeAuthorName(author));
  if (!fold) return null;

  let initial = null;
  let surname = null;
  const spaced = fold.match(/^([а-яa-z])\s+([а-яa-z]{3,})$/u);
  if (spaced) {
    initial = spaced[1];
    surname = spaced[2];
  } else {
    const glued = fold.replace(/\s+/g, '').match(/^([а-яa-z])([а-яa-z]{3,})$/u);
    if (glued) {
      initial = glued[1];
      surname = glued[2];
    }
  }

  if (initial && surname) {
    const cands = index.bySurname.get(surname) || [];
    const matched = cands.filter((w) => {
      const nameFold = searchFold(w.name);
      const tokens = nameFold.split(/\s+/).filter(Boolean);
      return tokens.some((t) => t.length > 1 && t.startsWith(initial) && t !== surname);
    });
    if (matched.length === 1) return matched[0];
    if (cands.length === 1) return cands[0];
  }

  const tokens = fold.split(/\s+/).filter(Boolean);
  if (tokens.length === 1) {
    const cands = index.bySurname.get(tokens[0]) || [];
    if (cands.length === 1) return cands[0];
  }

  return null;
}

export async function resolveAuthor(author) {
  const index = await loadIndex();
  return resolveAgainstIndex(index, author);
}

export async function resolveAuthors(authors) {
  const index = await loadIndex();
  const out = new Map();
  for (const raw of authors || []) {
    const key = String(raw || '').trim();
    if (!key || out.has(key)) continue;
    out.set(key, resolveAgainstIndex(index, key));
  }
  return out;
}

export async function linkExampleAuthors(examples) {
  if (!Array.isArray(examples) || !examples.length) return examples || [];
  const authors = examples.map((ex) => ex.author).filter(Boolean);
  const map = await resolveAuthors(authors);
  return examples.map((ex) => {
    const hit = ex.author ? map.get(String(ex.author).trim()) : null;
    return {
      ...ex,
      authorId: hit?.id || ex.authorId || null,
      authorSlug: hit?.slug || ex.authorSlug || null,
      authorName: hit?.name || null,
    };
  });
}

export async function linkSenseAuthors(senses) {
  if (!Array.isArray(senses) || !senses.length) return senses || [];
  const authors = [];
  for (const s of senses) {
    for (const ex of s.examples || []) {
      if (ex.author) authors.push(ex.author);
    }
  }
  const map = await resolveAuthors(authors);
  return senses.map((s) => ({
    ...s,
    examples: (s.examples || []).map((ex) => {
      const hit = ex.author ? map.get(String(ex.author).trim()) : null;
      return {
        ...ex,
        authorId: hit?.id || null,
        authorSlug: hit?.slug || null,
        authorName: hit?.name || null,
      };
    }),
  }));
}

export function clearWriterLinkCache() {
  cache = null;
  cacheAt = 0;
}
