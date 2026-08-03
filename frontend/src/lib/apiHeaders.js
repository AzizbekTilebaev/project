import { getAnonymousId } from './anonymousId';

const TOKEN_KEY = 'app:auth_token';

export function getStoredAuthToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredAuthToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/** Umumiy API headerlar: anonim ID + ixtiyoriy Bearer. */
export function apiHeaders(extra = {}) {
  const headers = {
    Accept: 'application/json',
    'X-Anonymous-Id': getAnonymousId(),
    ...extra,
  };
  const token = getStoredAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}
