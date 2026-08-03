import { useId, useState } from 'react';
import Icon from '../Icon';
import { t } from './litLabels';
import { readTimelineOpen, writeTimelineOpen } from './litUtils';

const KIND_KEYS = {
  birth: 'kindBirth',
  education: 'kindEducation',
  career: 'kindCareer',
  membership: 'kindMembership',
  work: 'kindWork',
  death: 'kindDeath',
};

const KIND_STYLE = {
  birth: { dot: 'bg-amber-500', badge: 'bg-amber-100/90 text-amber-950' },
  education: { dot: 'bg-sky-500', badge: 'bg-sky-100/90 text-sky-950' },
  career: { dot: 'bg-teal-600', badge: 'bg-teal-100/90 text-teal-950' },
  membership: { dot: 'bg-violet-500', badge: 'bg-violet-100/90 text-violet-950' },
  work: { dot: 'bg-emerald-500', badge: 'bg-emerald-100/90 text-emerald-950' },
  death: { dot: 'bg-rose-500', badge: 'bg-rose-100/90 text-rose-950' },
};

/**
 * Biografiyadan ajıratılǵan jıl → waqıya portfoliosı (ómir jolı).
 * Yig'iladigan panel: uzun timeline default yopiq.
 */
export default function WriterTimeline({ facts, script = 'cyrillic' }) {
  const events = Array.isArray(facts?.timeline) ? facts.timeline : [];
  const listId = useId();
  const defaultOpen = events.length <= 5;
  const [open, setOpen] = useState(() => readTimelineOpen(defaultOpen));

  if (!events.length) return null;

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      writeTimelineOpen(next);
      return next;
    });
  };

  return (
    <section className="mt-8" aria-label={t('timeline', script)}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={listId}
        className="mb-3 flex w-full items-center justify-between gap-3 rounded-2xl border border-ink/[0.07] bg-white/55 px-4 py-3 text-left transition hover:border-teal-600/25 hover:bg-teal-50/30"
      >
        <span className="flex items-center gap-2">
          <span className="font-display text-xl tracking-tight text-ink">
            {t('timeline', script)}
          </span>
          <span className="rounded-full bg-ink/[0.06] px-2.5 py-0.5 text-[0.65rem] font-bold tabular-nums text-ink/55">
            {events.length} {t('events', script)}
          </span>
        </span>
        <Icon name={open ? 'up' : 'down'} className="text-ink/40" />
      </button>

      {open ? (
        <ol
          id={listId}
          className="relative ml-3 space-y-5 border-l-2 border-ink/[0.08] pl-6"
        >
          {events.map((e, i) => {
            const style = KIND_STYLE[e.kind] || KIND_STYLE.career;
            const labelKey = KIND_KEYS[e.kind] || 'kindCareer';
            const text = script === 'latin' ? e.textLatin || e.text : e.text;
            return (
              <li key={`${e.year}-${i}`} className="relative">
                <span
                  className={`absolute -left-[31px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white shadow ${style.dot}`}
                  aria-hidden="true"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-lg font-bold tabular-nums text-ink">
                    {e.year}
                  </span>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide ${style.badge}`}
                  >
                    {t(labelKey, script)}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-6 text-ink/70">{text}</p>
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}
