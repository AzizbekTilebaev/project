import { useEffect, useRef, useState } from 'react';
import { useUiScript } from '../../contexts/UiScriptContext';
import { LEAFLET } from '../../lib/vendorIntegrity';

/** Qaraqalpaqstan approx bounding box for local SVG projection. */
const BOUNDS = { west: 55.8, east: 62.6, south: 41.0, north: 45.7 };

function project(lat, lng, width, height, pad = 18) {
  const x =
    pad + ((lng - BOUNDS.west) / (BOUNDS.east - BOUNDS.west)) * (width - pad * 2);
  const y =
    pad +
    (1 - (lat - BOUNDS.south) / (BOUNDS.north - BOUNDS.south)) * (height - pad * 2);
  return { x, y };
}

function LocalMap({ lat, lng, label, ariaLabel }) {
  const { text } = useUiScript();
  const width = 560;
  const height = 360;
  const { x, y } = project(lat, lng, width, height);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full rounded-2xl border border-ink/[0.08] bg-gradient-to-br from-sky-50 via-emerald-50/60 to-amber-50/40"
      role="img"
      aria-label={ariaLabel}
    >
      <path
        d="M92 78 C140 52 210 48 275 58 C340 68 400 55 455 78 C500 98 520 140 505 185 C490 235 455 270 400 295 C340 322 270 330 205 318 C145 306 100 275 78 230 C55 180 60 115 92 78 Z"
        fill="rgba(15,118,110,0.12)"
        stroke="rgba(15,118,110,0.45)"
        strokeWidth="2.5"
      />
      <path
        d="M160 120 C210 95 280 100 330 120 C380 145 410 175 395 210 C375 250 310 265 250 255 C195 245 155 210 150 170 C147 145 150 130 160 120 Z"
        fill="rgba(14,165,233,0.18)"
        stroke="rgba(14,116,144,0.35)"
        strokeWidth="1.5"
      />
      <text x="250" y="40" textAnchor="middle" className="fill-ink/45" fontSize="13" fontWeight="700">
        {text('Qaraqalpaqstan')}
      </text>
      <ellipse cx="300" cy="155" rx="70" ry="38" fill="rgba(56,189,248,0.25)" />
      <text x="300" y="160" textAnchor="middle" className="fill-sky-800/50" fontSize="10">
        {text('Aral')}
      </text>
      <circle cx={x} cy={y} r="10" fill="#f59e0b" stroke="#fff" strokeWidth="3" />
      <circle cx={x} cy={y} r="3.5" fill="#fff" />
      {label ? (
        <text
          x={Math.min(width - 20, Math.max(20, x))}
          y={Math.max(24, y - 16)}
          textAnchor="middle"
          className="fill-ink/80"
          fontSize="12"
          fontWeight="600"
        >
          {text(label)}
        </text>
      ) : null}
    </svg>
  );
}

function loadLeaflet() {
  if (typeof window !== 'undefined' && window.L) {
    return Promise.resolve(window.L);
  }
  return new Promise((resolve, reject) => {
    if (!document.getElementById('leaflet-css-local')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css-local';
      link.rel = 'stylesheet';
      link.href = LEAFLET.css;
      link.integrity = LEAFLET.cssIntegrity;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    }
    const existing = document.getElementById('leaflet-js-local');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.L));
      existing.addEventListener('error', () => reject(new Error('Leaflet júklenbedi')));
      if (window.L) resolve(window.L);
      return;
    }
    const scriptEl = document.createElement('script');
    scriptEl.id = 'leaflet-js-local';
    scriptEl.src = LEAFLET.js;
    scriptEl.integrity = LEAFLET.jsIntegrity;
    scriptEl.crossOrigin = 'anonymous';
    scriptEl.async = true;
    scriptEl.onload = () => resolve(window.L);
    scriptEl.onerror = () => reject(new Error('Leaflet júklenbedi'));
    document.body.appendChild(scriptEl);
  });
}

/**
 * Default: lokal SVG karta. Ixtiyarıy: Leaflet/OSM (CDN lazy-load).
 */
export default function BirthplaceMap({ coordinates, label, geocodeStatus, script: _script }) {
  const { text } = useUiScript();
  void _script;
  const [mode, setMode] = useState('local');
  const [onlineError, setOnlineError] = useState('');
  const mapHostRef = useRef(null);
  const mapRef = useRef(null);

  const lat = coordinates?.lat;
  const lng = coordinates?.lng;
  const hasCoords = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
  const mapTitle = text('Tuwılǵan jer kartası');
  const birthPlaceLabel = text('Tuwılǵan jeri');

  useEffect(() => {
    if (mode !== 'online' || !hasCoords || !mapHostRef.current) return undefined;
    let cancelled = false;

    (async () => {
      setOnlineError('');
      try {
        const L = await loadLeaflet();
        if (cancelled || !mapHostRef.current) return;
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: LEAFLET.iconRetinaUrl,
          iconUrl: LEAFLET.iconUrl,
          shadowUrl: LEAFLET.shadowUrl,
        });
        const map = L.map(mapHostRef.current).setView([lat, lng], 8);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap',
          maxZoom: 18,
        }).addTo(map);
        L.marker([lat, lng]).addTo(map).bindPopup(label ? text(label) : birthPlaceLabel);
        mapRef.current = map;
        setTimeout(() => map.invalidateSize(), 80);
      } catch (err) {
        setOnlineError(err?.message || 'Karta júklenbedi');
        setMode('local');
      }
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [mode, hasCoords, lat, lng, label, text, birthPlaceLabel]);

  if (!hasCoords) {
    return (
      <section className="mt-8" aria-label={mapTitle}>
        <h2 className="mb-3 font-display text-xl tracking-tight text-ink">{mapTitle}</h2>
        <p className="rounded-2xl border border-dashed border-ink/15 bg-white/40 px-5 py-6 text-sm text-ink/45">
          {text('Tuwılǵan jeri belgilenbegen')}
          {geocodeStatus && geocodeStatus !== 'none' && geocodeStatus !== 'resolved'
            ? ` (${geocodeStatus})`
            : ''}
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8" aria-label={mapTitle}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl tracking-tight text-ink">{mapTitle}</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('local')}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${
              mode === 'local'
                ? 'bg-teal-800 text-white'
                : 'border border-ink/10 bg-white/70 text-ink/60 hover:text-teal-900'
            }`}
          >
            {text('Lokal')}
          </button>
          <button
            type="button"
            onClick={() => setMode('online')}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${
              mode === 'online'
                ? 'bg-teal-800 text-white'
                : 'border border-ink/10 bg-white/70 text-ink/60 hover:text-teal-900'
            }`}
          >
            {text('Onlayn karta')}
          </button>
        </div>
      </div>
      {onlineError ? <p className="mb-2 text-xs text-rose-700">{text(onlineError)}</p> : null}
      {mode === 'local' ? (
        <LocalMap
          lat={Number(lat)}
          lng={Number(lng)}
          label={label}
          ariaLabel={label ? `${birthPlaceLabel}: ${text(label)}` : mapTitle}
        />
      ) : (
        <div
          ref={mapHostRef}
          className="h-72 w-full overflow-hidden rounded-2xl border border-ink/[0.08]"
        />
      )}
      {label ? <p className="mt-2 text-center text-sm text-ink/55">{text(label)}</p> : null}
    </section>
  );
}
