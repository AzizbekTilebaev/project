/**
 * Client-side URL / path allowlists (open-redirect + XSS sinks).
 */

/** Post-login redirect: only same-origin relative paths. */
export function safeInternalPath(from, fallback = '/profile') {
  if (typeof from !== 'string') return fallback;
  const path = from.trim();
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return fallback;
  if (path.includes('://')) return fallback;
  return path;
}

/** Media / file / avatar src — relative app paths or http(s) only. */
export function isSafeMediaUrl(url) {
  if (url == null || url === '') return false;
  const s = String(url).trim();
  if (!s || s.includes('\\')) return false;
  const lower = s.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:text/html')) return false;
  if (s.startsWith('/') && !s.startsWith('//')) {
    return !s.includes('..');
  }
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

export function safeMediaUrl(url, fallback = '') {
  return isSafeMediaUrl(url) ? String(url).trim() : fallback;
}

/** Dev-only reset links must stay on our reset-password route. */
export function safeResetDevUrl(url) {
  if (!import.meta.env.DEV) return '';
  if (!isSafeMediaUrl(url) && !(typeof url === 'string' && url.startsWith('/'))) return '';
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const u = new URL(url, base);
    if (u.origin !== base) return '';
    if (!u.pathname.startsWith('/reset-password')) return '';
    return u.pathname + u.search + u.hash;
  } catch {
    return '';
  }
}
