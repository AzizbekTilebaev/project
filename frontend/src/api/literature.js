import { getAnonymousId } from '../lib/anonymousId';

const API_BASE = '/api/literature';

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

/** Paginated writers list: q, letter, script (original|latin), page, limit */
export async function fetchWriters(params = {}) {
  return request(`/writers${buildQuery(params)}`);
}

/** Writer biography + linked books by slug */
export async function fetchWriterBySlug(slug, params = {}) {
  return request(`/writers/${encodeURIComponent(slug)}${buildQuery(params)}`);
}

/** Works catalog (optional writer/filter/script) */
export async function fetchWorks(params = {}) {
  return request(`/works${buildQuery(params)}`);
}

/** Pieces / sections for a work (book id) */
export async function fetchWorkPieces(id, params = {}) {
  return request(`/works/${encodeURIComponent(id)}/pieces${buildQuery(params)}`);
}

/** Convenience: authors linked to a book via works list or pieces payload */
export async function fetchBookLiterature(id, params = {}) {
  const [piecesRes, worksRes] = await Promise.all([
    fetchWorkPieces(id, params).catch(() => null),
    fetchWorks({ ...params, bookId: id, limit: 1 }).catch(() => null),
  ]);
  return {
    pieces: piecesRes?.pieces || piecesRes?.items || [],
    work: piecesRes?.work || worksRes?.works?.[0] || worksRes?.items?.[0] || null,
    writers: piecesRes?.writers || worksRes?.writers || [],
    meta: piecesRes || worksRes || {},
  };
}
