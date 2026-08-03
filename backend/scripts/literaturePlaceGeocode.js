/**
 * Curated place → lat/lng lookup for writer birthplaces.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { toLatin } from '../src/utils/qqScript.js';
import searchFold from '../src/utils/searchFold.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GAZETTEER_PATH = path.join(__dirname, 'literature-places-gazetteer.json');

let cache = null;

function foldPlace(text) {
  // searchFold → kirill fazoga; latın-only strip qılmaslıq kerek
  return searchFold(String(text || ''))
    .replace(/iy/g, 'i')
    .replace(/[^\u0430-\u044fa-z0-9]+/gu, '');
}

function loadGazetteer() {
  if (cache) return cache;
  const raw = JSON.parse(fs.readFileSync(GAZETTEER_PATH, 'utf8'));
  const entries = [];
  for (const p of raw.places || []) {
    const keys = (p.keys || []).map(foldPlace).filter(Boolean);
    entries.push({
      keys,
      labelOriginal: p.labelOriginal,
      labelLatin: p.labelLatin || toLatin(p.labelOriginal),
      lat: Number(p.lat),
      lng: Number(p.lng),
    });
  }
  cache = entries;
  return cache;
}

/**
 * @returns {{ lat: number, lng: number, labelOriginal: string, labelLatin: string, status: string } | null}
 */
export function geocodeBirthplace(placeText) {
  const hay = foldPlace(placeText);
  if (!hay) return null;
  const places = loadGazetteer();
  let best = null;
  let bestLen = 0;
  for (const p of places) {
    for (const key of p.keys) {
      if (!key || key.length < 3) continue;
      if (hay.includes(key) && key.length > bestLen) {
        best = p;
        bestLen = key.length;
      }
    }
  }
  if (!best || !Number.isFinite(best.lat) || !Number.isFinite(best.lng)) return null;
  return {
    lat: best.lat,
    lng: best.lng,
    labelOriginal: best.labelOriginal,
    labelLatin: best.labelLatin,
    status: 'resolved',
  };
}

export default { geocodeBirthplace };
