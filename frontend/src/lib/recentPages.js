/**
 * Sońǵı kirilgen sahifalar — localStorage (bas bette 3 ta).
 */

import { emitResumeChanged } from './resumeEvents';

export const RECENT_PAGES_KEY = 'app:recent-pages:v1';
const MAX_ITEMS = 12;

const SKIP_EXACT = new Set([
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
]);

/** @type {Array<{ test: (p: string) => boolean, labelKey: string, icon: string, group: string }>} */
const RULES = [
  { test: (p) => p.startsWith('/dictionary/game'), labelKey: 'sozOyinlari', icon: 'gamepad', group: 'dict-game' },
  { test: (p) => p.startsWith('/dictionary/immersion'), labelKey: 'dawisliSozler', icon: 'sparkle', group: 'immersion' },
  { test: (p) => p.startsWith('/dictionary/favorites'), labelKey: 'yoqtirilganlar', icon: 'heart', group: 'favorites' },
  { test: (p) => p.startsWith('/dictionary/recent'), labelKey: 'practiceRecent', icon: 'book', group: 'recent-words' },
  { test: (p) => p.startsWith('/dictionary'), labelKey: 'sozlik', icon: 'book', group: 'dictionary' },
  { test: (p) => p.startsWith('/games'), labelKey: 'oyinlar', icon: 'trophy', group: 'games' },
  { test: (p) => p.startsWith('/quiz/statistics'), labelKey: 'statistika', icon: 'chart', group: 'stats' },
  { test: (p) => p.startsWith('/quiz'), labelKey: 'testler', icon: 'trophy', group: 'quiz' },
  { test: (p) => p.startsWith('/crossword'), labelKey: 'krossvord', icon: 'layers', group: 'crossword' },
  { test: (p) => p.startsWith('/literature/qaraqalpaq-tili') || p.startsWith('/qoidalar'), labelKey: 'qaraqalpaqTili', icon: 'grammar', group: 'til' },
  {
    test: (p) =>
      p.startsWith('/literature') ||
      p.startsWith('/kitapxana') ||
      p.startsWith('/books') ||
      p.startsWith('/writers') ||
      p.startsWith('/jumbaqlar'),
    labelKey: 'kitapxana',
    icon: 'scroll',
    group: 'literature',
  },
  { test: (p) => p.startsWith('/facts'), labelKey: 'qiziqarliShort', icon: 'sparkle', group: 'facts' },
  { test: (p) => p.startsWith('/english'), labelKey: 'englishShort', icon: 'grammar', group: 'english' },
  { test: (p) => p.startsWith('/tutor'), labelKey: 'uyretiwshi', icon: 'tutor', group: 'tutor' },
  { test: (p) => p.startsWith('/profile'), labelKey: 'profil', icon: 'users', group: 'profile' },
  { test: (p) => p.startsWith('/community'), labelKey: 'jamiyet', icon: 'users', group: 'community' },
  { test: (p) => p.startsWith('/settings'), labelKey: 'sazlawlar', icon: 'layers', group: 'settings' },
  { test: (p) => p.startsWith('/faq'), labelKey: 'faqShort', icon: 'sparkle', group: 'faq' },
  { test: (p) => p.startsWith('/about'), labelKey: 'aboutShort', icon: 'book', group: 'about' },
];

function resolveMeta(pathname) {
  const path = String(pathname || '').split('?')[0].split('#')[0] || '/';
  for (const rule of RULES) {
    if (rule.test(path)) {
      return { labelKey: rule.labelKey, icon: rule.icon, group: rule.group, path };
    }
  }
  return { labelKey: 'basBet', icon: 'home', group: path, path };
}

function shouldSkip(pathname) {
  const path = String(pathname || '').split('?')[0].split('#')[0] || '/';
  if (SKIP_EXACT.has(path)) return true;
  if (path.startsWith('/admin')) return true;
  return false;
}

export function readRecentPages(limit = 3) {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_PAGES_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((x) => x && typeof x.path === 'string' && x.labelKey)
      .slice(0, Math.max(0, limit));
  } catch {
    return [];
  }
}

/**
 * @param {string} pathname
 * @returns {Array<{ path: string, labelKey: string, icon: string, group: string, at: number }>|null}
 */
export function recordRecentPage(pathname) {
  if (typeof window === 'undefined') return null;
  if (shouldSkip(pathname)) return null;

  const meta = resolveMeta(pathname);
  const entry = {
    path: meta.path,
    labelKey: meta.labelKey,
    icon: meta.icon,
    group: meta.group,
    at: Date.now(),
  };

  let prev = [];
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_PAGES_KEY) || '[]');
    if (Array.isArray(raw)) prev = raw;
  } catch {
    prev = [];
  }

  const next = [entry, ...prev.filter((x) => x && x.group !== entry.group)].slice(0, MAX_ITEMS);
  try {
    localStorage.setItem(RECENT_PAGES_KEY, JSON.stringify(next));
  } catch {
    /* quota */
  }
  emitResumeChanged();
  return next;
}
