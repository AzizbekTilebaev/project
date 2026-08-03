const API_BASE = '/api/dicts';

async function request(path) {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Accept: 'application/json' } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export async function fetchDictStats() {
  return request('/stats');
}

export async function fetchKaaMonths() {
  return request('/kaa-months');
}

export async function fetchKaaCulture() {
  return request('/kaa-culture');
}

export async function searchUzbKaa(q, limit = 30) {
  return request(`/uzb-kaa/search?q=${encodeURIComponent(q)}&limit=${limit}`);
}

export async function listUzbKaa({ page = 1, limit = 40, letter } = {}) {
  const qs = new URLSearchParams({ page, limit });
  if (letter) qs.set('letter', letter);
  return request(`/uzb-kaa?${qs}`);
}

export async function fetchUzbKaaById(id) {
  return request(`/uzb-kaa/${encodeURIComponent(id)}`);
}

export async function searchBilingual(lang, q, limit = 30) {
  return request(`/${lang}/search?q=${encodeURIComponent(q)}&limit=${limit}`);
}

export async function listBilingual(lang, { page = 1, limit = 40, letter } = {}) {
  const qs = new URLSearchParams({ page, limit });
  if (letter) qs.set('letter', letter);
  return request(`/${lang}?${qs}`);
}

export async function fetchBilingualById(lang, id) {
  return request(`/${lang}/${encodeURIComponent(id)}`);
}

export async function fetchDictLinks(titleId, soz) {
  const qs = soz ? `?soz=${encodeURIComponent(soz)}` : '';
  return request(`/links/${encodeURIComponent(titleId)}${qs}`);
}

export async function searchFrazeologiya({ q = '', limit = 40, offset = 0 } = {}) {
  const qs = new URLSearchParams({ limit, offset });
  if (q) qs.set('q', q);
  return request(`/frazeologiya?${qs}`);
}

export async function fetchFrazeologiyaById(id) {
  return request(`/frazeologiya/${encodeURIComponent(id)}`);
}

export async function searchAdamAtlari({ q = '', gender = '', limit = 40, offset = 0 } = {}) {
  const qs = new URLSearchParams({ limit, offset });
  if (q) qs.set('q', q);
  if (gender) qs.set('gender', gender);
  return request(`/adam-atlari?${qs}`);
}

export async function fetchAdamAtariById(id) {
  return request(`/adam-atlari/${encodeURIComponent(id)}`);
}

export async function searchImla({ q = '', letter = '', source = '', limit = 40, offset = 0 } = {}) {
  const qs = new URLSearchParams({ limit, offset });
  if (q) qs.set('q', q);
  if (letter) qs.set('letter', letter);
  if (source) qs.set('source', source);
  return request(`/imla?${qs}`);
}

export async function fetchImlaById(id) {
  return request(`/imla/${encodeURIComponent(id)}`);
}

export async function fetchImlaLetters(source = '') {
  const qs = source ? `?source=${encodeURIComponent(source)}` : '';
  return request(`/imla/letters${qs}`);
}

export async function fetchImlaSources() {
  return request('/imla/sources');
}
