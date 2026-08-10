/**
 * Instagram-uslubidagi login username (unikal).
 * At (displayName) — erkin; username — @login, unikal.
 */

const RESERVED = new Set([
  'admin',
  'administrator',
  'root',
  'api',
  'support',
  'help',
  'null',
  'undefined',
  'me',
  'profile',
  'login',
  'register',
  'settings',
  'system',
  'qaraqalpaq',
  'moderator',
  'owner',
]);

/** @returns {string} normalized lowercase username */
export function normalizeUsername(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^@+/, '');
}

/**
 * @param {string} raw
 * @returns {{ ok: true, username: string } | { ok: false, error: string, statusCode?: number }}
 */
export function validateUsername(raw) {
  const username = normalizeUsername(raw);
  if (!username) {
    return { ok: false, error: 'Login (username) kerek', statusCode: 400 };
  }
  if (username.length < 3 || username.length > 30) {
    return { ok: false, error: 'Login 3–30 belgi bolıwı kerek', statusCode: 400 };
  }
  if (!/^[a-z][a-z0-9._]*$/.test(username)) {
    return {
      ok: false,
      error: 'Login: birinshi hárip, keyin a-z, 0-9, . yamasa _',
      statusCode: 400,
    };
  }
  if (username.includes('..') || username.endsWith('.') || username.endsWith('_')) {
    return { ok: false, error: 'Login formatı nadurıs', statusCode: 400 };
  }
  if (RESERVED.has(username)) {
    return { ok: false, error: 'Bul login band (sistema)', statusCode: 409 };
  }
  return { ok: true, username };
}

/** Email yoki at dan username usınısı. */
export function suggestUsernameBase(seed) {
  const raw = String(seed || '')
    .trim()
    .toLowerCase()
    .split('@')[0]
    .normalize('NFKD')
    .replace(/[^\w.]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^\.+|\.+$/g, '')
    .replace(/^_+|_+$/g, '');
  let base = raw.replace(/[^a-z0-9._]/g, '');
  if (!/^[a-z]/.test(base)) base = `u${base}`;
  base = base.slice(0, 24) || 'user';
  const checked = validateUsername(base);
  return checked.ok ? checked.username : 'user';
}

export function looksLikeEmail(value) {
  return String(value || '').includes('@');
}
