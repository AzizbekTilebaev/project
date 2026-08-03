/** Shared literature UI helpers — no external deps. */

import { emitResumeChanged } from '../../lib/resumeEvents';

export const SCRIPT_KEY = 'literature:script';
export const READER_PREFS_KEY = 'literature:readerPrefs';
export const BOOK_PROGRESS_KEY = 'books:progress';
export const TIMELINE_OPEN_KEY = 'literature:timelineOpen';

export const CYRILLIC_LETTERS = [
  'А', 'Ә', 'Б', 'В', 'Г', 'Ғ', 'Д', 'Е', 'Ё', 'Ж', 'З', 'И', 'Й', 'К', 'Қ', 'Л', 'М', 'Н', 'Ң',
  'О', 'Ө', 'П', 'Р', 'С', 'Т', 'У', 'Ү', 'Ў', 'Ф', 'Х', 'Ҳ', 'Ц', 'Ч', 'Ш', 'Щ', 'Ы', 'Э', 'Ю', 'Я', 'І',
];

export const LATIN_LETTERS = [
  'A', 'Á', 'B', 'D', 'E', 'F', 'G', 'Ǵ', 'H', 'I', 'Í', 'J', 'K', 'L', 'M', 'N', 'Ń',
  'O', 'Ó', 'P', 'Q', 'R', 'S', 'T', 'U', 'Ú', 'V', 'W', 'X', 'Y', 'Z',
];

/** Canonical: 'cyrillic' | 'latin'. Accepts legacy 'original'. */
export function normalizeUiScript(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'latin') return 'latin';
  return 'cyrillic';
}

export function readScript() {
  try {
    return normalizeUiScript(localStorage.getItem(SCRIPT_KEY));
  } catch {
    return 'cyrillic';
  }
}

export function writeScript(script) {
  const next = normalizeUiScript(script);
  try {
    localStorage.setItem(SCRIPT_KEY, next);
    const prefs = JSON.parse(localStorage.getItem(READER_PREFS_KEY) || '{}');
    prefs.script = next;
    localStorage.setItem(READER_PREFS_KEY, JSON.stringify(prefs));
    window.dispatchEvent(new CustomEvent('qaraqalpaq:script-change', { detail: next }));
  } catch {
    /* ignore */
  }
  return next;
}

export function readReaderPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(READER_PREFS_KEY) || '{}');
    // Prefer shared SCRIPT_KEY so list pages and reader stay in sync
    const script = normalizeUiScript(
      localStorage.getItem(SCRIPT_KEY) || raw.script
    );
    return {
      fontSize: Math.min(28, Math.max(14, Number(raw.fontSize) || 18)),
      theme: ['day', 'sepia', 'dark'].includes(raw.theme) ? raw.theme : 'day',
      script,
    };
  } catch {
    return { fontSize: 18, theme: 'day', script: 'cyrillic' };
  }
}

export function writeReaderPrefs(prefs) {
  const next = {
    fontSize: Math.min(28, Math.max(14, Number(prefs.fontSize) || 18)),
    theme: ['day', 'sepia', 'dark'].includes(prefs.theme) ? prefs.theme : 'day',
    script: normalizeUiScript(prefs.script),
  };
  try {
    localStorage.setItem(READER_PREFS_KEY, JSON.stringify(next));
    localStorage.setItem(SCRIPT_KEY, next.script);
  } catch {
    /* ignore */
  }
  return next;
}

export function readTimelineOpen(defaultOpen = false) {
  try {
    const v = localStorage.getItem(TIMELINE_OPEN_KEY);
    if (v === null) return defaultOpen;
    return v === '1';
  } catch {
    return defaultOpen;
  }
}

export function writeTimelineOpen(open) {
  try {
    localStorage.setItem(TIMELINE_OPEN_KEY, open ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function readBookProgressMap() {
  try {
    return JSON.parse(localStorage.getItem(BOOK_PROGRESS_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

export function writeBookProgressLocal(bookId, patch) {
  const all = readBookProgressMap();
  all[bookId] = {
    ...(all[bookId] || {}),
    ...patch,
    updatedAt: Date.now(),
  };
  try {
    localStorage.setItem(BOOK_PROGRESS_KEY, JSON.stringify(all));
    emitResumeChanged();
  } catch {
    /* ignore */
  }
  return all;
}

/**
 * Resume chip ushın kitap progressın óshiriw (local).
 * @param {string|null} bookId — null = sońǵı continue kitap
 */
export function clearBookContinue(bookId = null) {
  const map = readBookProgressMap();
  const target =
    bookId != null && String(bookId).trim()
      ? String(bookId).trim()
      : getContinueBook()?.bookId || null;
  if (!target || !map[target]) return;
  try {
    delete map[target];
    localStorage.setItem(BOOK_PROGRESS_KEY, JSON.stringify(map));
    emitResumeChanged();
  } catch {
    /* ignore */
  }
}

/**
 * Sońǵı oqılǵan (tamam bolmaǵan) kitap — Home «Dawam etiw».
 * @returns {{ bookId: string, section: number, percent: number|null, href: string, updatedAt: number }|null}
 */
export function getContinueBook() {
  const map = readBookProgressMap();
  let best = null;
  for (const [bookId, raw] of Object.entries(map)) {
    if (!bookId || !raw || typeof raw !== 'object') continue;
    const percent = raw.percent != null ? Number(raw.percent) : null;
    const done = Boolean(raw.done);
    if (done && (percent == null || percent >= 99)) continue;
    const updatedAt = Number(raw.updatedAt) || 0;
    if (!best || updatedAt > best.updatedAt) {
      const section = Number.isFinite(Number(raw.section)) ? Number(raw.section) : 0;
      best = {
        bookId: String(bookId),
        section,
        percent: Number.isFinite(percent) ? percent : null,
        updatedAt,
        href: `/books/${encodeURIComponent(bookId)}/read${
          section > 0 ? `?section=${section}` : ''
        }`,
      };
    }
  }
  return best;
}

/** Split biography into safe plain-text paragraphs (strips tags, no HTML render). */
export function biographyToParagraphs(raw) {
  if (Array.isArray(raw)) {
    return raw.map((p) => String(p || '').trim()).filter(Boolean);
  }
  let text = String(raw || '');
  if (!text.trim()) return [];
  text = text
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/\s*p\s*>/gi, '\n')
    .replace(/<\s*p[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  return text
    .split(/\n+/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

export function pickWriterName(writer, script = 'cyrillic') {
  if (!writer) return '';
  if (script === 'latin') {
    return writer.nameLatin || writer.poetNameLatin || writer.name || writer.poetName || '';
  }
  return (
    writer.nameCyrillic ||
    writer.nameOriginal ||
    writer.poetNameOriginal ||
    writer.name ||
    writer.poetName ||
    ''
  );
}

export function pickWriterBio(writer, script = 'cyrillic') {
  if (!writer) return [];
  // Alifba maydonların áhmiyetli qılıń — biographyParagraphs eski skriptten
  // qalıp qalıwı múmkin (toggle waqtında).
  if (script === 'latin') {
    const latin =
      writer.biographyLatin ||
      (Array.isArray(writer.biographyParagraphs) &&
      writer.biographyParagraphs.length &&
      !/[\u0400-\u04FF]/.test(writer.biographyParagraphs.join('\n'))
        ? writer.biographyParagraphs.join('\n\n')
        : '') ||
      writer.biography ||
      '';
    return biographyToParagraphs(latin);
  }
  const cyr =
    writer.biographyCyrillic ||
    writer.biographyPlainOriginal ||
    writer.biographyOriginal ||
    (Array.isArray(writer.biographyParagraphs) && writer.biographyParagraphs.length
      ? writer.biographyParagraphs.join('\n\n')
      : '') ||
    writer.biography ||
    writer.bio ||
    '';
  return biographyToParagraphs(cyr);
}

export function themeClasses(theme) {
  if (theme === 'dark') {
    return {
      shell: 'bg-[#1a1c1e] text-[#e8e4dc]',
      paper: 'bg-[#242628] border-white/10 text-[#e8e4dc]',
      muted: 'text-[#e8e4dc]/70',
      bar: 'bg-[#2c2e32]/90 border-white/10',
    };
  }
  if (theme === 'sepia') {
    return {
      shell: 'bg-[#f3e6c8] text-[#3d2f1e]',
      paper: 'bg-[#f7edd4] border-[#c4a574]/35 text-[#3d2f1e]',
      muted: 'text-[#3d2f1e]/65',
      bar: 'bg-[#efe0ba]/95 border-[#c4a574]/30',
    };
  }
  return {
    shell: 'bg-parchment text-ink',
    paper: 'bg-white/75 border-ink/[0.08] text-ink',
    muted: 'text-ink/60',
    bar: 'bg-white/80 border-ink/10',
  };
}
