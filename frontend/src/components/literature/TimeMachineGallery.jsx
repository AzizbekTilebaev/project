import { useEffect, useMemo, useState } from 'react';
import Icon from '../Icon';
import { t } from './litLabels';

/**
 * Vaqt mashinasi: jıllar boyınsha shoir rasmları + sharh.
 * Slider menen ótken waqıtqa sayahat qılıw.
 */
export default function TimeMachineGallery({ photos = [], writer, script = 'cyrillic' }) {
  const items = useMemo(() => {
    const list = Array.isArray(photos) ? [...photos] : [];
    return list.sort((a, b) => {
      const ya = a.year ?? 9999;
      const yb = b.year ?? 9999;
      if (ya !== yb) return ya - yb;
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    });
  }, [photos]);

  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [writer?.id, items.length]);

  if (!items.length) return null;

  const safeIndex = Math.min(index, items.length - 1);
  const current = items[safeIndex];
  const caption =
    script === 'latin'
      ? current.captionLatin || current.caption
      : current.captionCyrillic || current.caption;
  const birth = Number(writer?.birthYear) || null;
  const death = Number(writer?.deathYear) || null;
  const year = current.year;
  const lifeStart = birth || items[0]?.year || year;
  const lifeEnd = death || items[items.length - 1]?.year || year || lifeStart;
  const span = Math.max(1, lifeEnd - lifeStart);
  const markerPct =
    year != null ? Math.min(100, Math.max(0, ((year - lifeStart) / span) * 100)) : null;

  function go(delta) {
    setIndex((i) => (i + delta + items.length) % items.length);
  }

  return (
    <section className="mt-10" aria-label={t('timeMachine', script)}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-amber-800/55">
            {t('timeMachineEyebrow', script)}
          </p>
          <h2 className="font-display text-2xl tracking-tight text-ink md:text-3xl">
            {t('timeMachine', script)}
          </h2>
          <p className="mt-1 text-sm text-ink/50">{t('timeMachineHint', script)}</p>
        </div>
        <span className="rounded-full bg-ink/[0.06] px-3 py-1 text-xs font-bold tabular-nums text-ink/55">
          {safeIndex + 1} / {items.length}
        </span>
      </div>

      <div className="overflow-hidden rounded-[1.75rem] border border-ink/[0.08] bg-gradient-to-br from-stone-900 via-stone-800 to-amber-950 shadow-[0_30px_80px_-40px_rgba(28,42,36,0.7)]">
        <div className="relative aspect-[16/10] w-full overflow-hidden">
          <img
            key={current.id}
            src={current.imageUrl}
            alt={caption || `${writer?.name || ''} ${year || ''}`}
            className="h-full w-full object-cover transition-opacity duration-500"
            loading="lazy"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />

          {year != null && (
            <div className="absolute left-5 top-5 rounded-2xl bg-black/45 px-4 py-2 backdrop-blur-sm">
              <p className="font-display text-3xl font-bold tabular-nums text-amber-100 md:text-4xl">
                {year}
              </p>
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 p-5 md:p-7">
            <p className="max-w-2xl font-display text-lg leading-snug text-white md:text-xl">
              {caption || t('timeMachineNoCaption', script)}
            </p>
          </div>

          <button
            type="button"
            onClick={() => go(-1)}
            className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/60"
            aria-label={t('prevPhoto', script)}
          >
            <Icon name="left" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/60"
            aria-label={t('nextPhoto', script)}
          >
            <Icon name="right" />
          </button>
        </div>

        {/* Vaqt sızıǵı / scrubber */}
        <div className="border-t border-white/10 px-5 py-4 md:px-7">
          <div className="relative h-2 rounded-full bg-white/15">
            <div
              className="absolute top-0 h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
              style={{
                width: markerPct != null ? `${markerPct}%` : `${((safeIndex + 1) / items.length) * 100}%`,
              }}
            />
            {items.map((photo, i) => {
              const y = photo.year;
              if (y == null) return null;
              const pct = Math.min(100, Math.max(0, ((y - lifeStart) / span) * 100));
              return (
                <button
                  key={photo.id}
                  type="button"
                  title={String(y)}
                  onClick={() => setIndex(i)}
                  className={`absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition ${
                    i === safeIndex
                      ? 'scale-125 border-white bg-amber-300 shadow'
                      : 'border-white/70 bg-white/40 hover:bg-amber-200'
                  }`}
                  style={{ left: `${pct}%` }}
                  aria-label={`${y}`}
                />
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-[0.65rem] tabular-nums text-white/45">
            <span>{lifeStart}</span>
            <span>{lifeEnd}</span>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {items.map((photo, i) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setIndex(i)}
                className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-xl border-2 transition ${
                  i === safeIndex ? 'border-amber-300' : 'border-transparent opacity-70 hover:opacity-100'
                }`}
              >
                <img src={photo.imageUrl} alt="" className="h-full w-full object-cover" />
                {photo.year != null && (
                  <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1.5 text-[0.6rem] font-bold tabular-nums text-white">
                    {photo.year}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
