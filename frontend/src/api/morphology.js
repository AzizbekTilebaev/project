import { getAnonymousId } from '../lib/anonymousId';
import { makeApiError } from '../lib/apiErrors';

const API_BASE = '/api/morphology';

async function request(path, options = {}) {
  const headers = {
    Accept: 'application/json',
    'X-Anonymous-Id': getAnonymousId(),
    ...options.headers,
  };
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw makeApiError(data, res.status);
  }
  return data;
}

/**
 * Sózdi TÚBİR + QOSIMTA'larǵa bóledi.
 * @param {string} word
 * @param {{ script?: 'latin'|'cyrillic' }} [opts]
 * @returns {Promise<{ analysis: object }>}
 */
export async function analyzeMorphology(word, { script } = {}) {
  const q = new URLSearchParams();
  q.set('word', String(word || '').trim());
  if (script === 'latin' || script === 'cyrillic') q.set('script', script);
  return request(`/analyze?${q.toString()}`);
}
