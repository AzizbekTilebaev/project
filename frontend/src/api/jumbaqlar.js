import { getAnonymousId } from '../lib/anonymousId';

const API_BASE = '/api/jumbaqlar';

function buildQuery(params = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === '') return;
    q.set(key, String(value));
  });
  const s = q.toString();
  return s ? `?${s}` : '';
}

async function request(path, options = {}) {
  const headers = {
    Accept: 'application/json',
    'X-Anonymous-Id': getAnonymousId(),
    ...options.headers,
  };
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.error || `Server qáteligi: ${res.status}`);
  }
  return data;
}

/** Paginated list: topar, utopar, q, script, page, limit */
export async function fetchJumbaqlar(params = {}) {
  return request(buildQuery(params));
}

export async function fetchJumbaqCategories(params = {}) {
  return request(`/categories${buildQuery(params)}`);
}

export async function fetchRandomJumbaq(params = {}) {
  return request(`/random${buildQuery(params)}`);
}

export async function fetchDailyJumbaq(params = {}) {
  return request(`/daily${buildQuery(params)}`);
}

export async function fetchJumbaqById(id, params = {}) {
  return request(`/${encodeURIComponent(id)}${buildQuery(params)}`);
}

/** Actor reveal/favorite map — requires X-Anonymous-Id */
export async function fetchJumbaqProgress() {
  return request('/progress/me');
}

/**
 * Persist reveal/favorite for anonymous actor.
 * body: { revealed?: boolean, favorited?: boolean }
 */
export async function saveJumbaqProgress(id, progress) {
  return request(`/${encodeURIComponent(id)}/progress`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(progress || {}),
  });
}

/** Typed guess — soft grade; durıs bolsa juwap qaytarıladı. */
export async function guessJumbaqAnswer(id, { answer, script } = {}) {
  return request(`/${encodeURIComponent(id)}/guess`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answer, script }),
  });
}

/** Reveal — juwap + bank seed. */
export async function revealJumbaqAnswer(id, { script } = {}) {
  return request(`/${encodeURIComponent(id)}/reveal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ script }),
  });
}
