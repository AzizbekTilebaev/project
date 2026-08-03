/**
 * Allowlist for user/admin-supplied URLs stored or returned by the API.
 */

export function sanitizeAvatarUrl(url) {
  if (url == null || url === '') return null;
  const s = String(url).trim().slice(0, 500);
  if (!s) return null;

  if (s.startsWith('/uploads/avatars/')) {
    const name = s.slice('/uploads/avatars/'.length);
    if (!name || name.includes('..') || name.includes('/') || name.includes('\\')) return null;
    return `/uploads/avatars/${encodeURIComponent(decodeURIComponent(name))}`;
  }

  try {
    const u = new URL(s);
    if (u.protocol !== 'https:') return null;
    const host = u.hostname.toLowerCase();
    const ok =
      host === 'googleusercontent.com' ||
      host.endsWith('.googleusercontent.com') ||
      host === 'ggpht.com' ||
      host.endsWith('.ggpht.com') ||
      host === 'lh3.google.com';
    if (!ok) return null;
    return u.toString().slice(0, 500);
  } catch {
    return null;
  }
}

export function isSafeMediaUrl(url) {
  if (url == null || url === '') return false;
  const s = String(url).trim();
  if (!s || s.includes('\\') || s.toLowerCase().startsWith('javascript:')) return false;
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
