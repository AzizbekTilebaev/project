import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../Icon';
import { t } from './litLabels';

/**
 * Kitap bólimleri — gorizontal "tasma" (filmstrip) kórinisi.
 * items: [{ key, index, title, preview, count }]
 * state: 'done' | 'current' | '' (hár bólim ushın progressten esaplanadı)
 */
export default function SectionTape({
  items = [],
  progress = null,
  activeIndex = null,
  getHref,
  onSelect,
  dense = false,
  className = '',
  script = 'cyrillic',
}) {
  const scrollerRef = useRef(null);
  const activeRef = useRef(null);

  useEffect(() => {
    if (!activeRef.current || !scrollerRef.current) return;
    activeRef.current.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  }, [activeIndex, items.length]);

  const stateOf = (index) => {
    if (activeIndex != null && index === activeIndex) return 'current';
    if (!progress) return '';
    if (progress.done || progress.completed) return 'done';
    const at = Number(progress.section ?? progress.sectionIndex ?? -1);
    if (at > index) return 'done';
    if (at === index && activeIndex == null) return 'current';
    return '';
  };

  if (!items.length) return null;

  return (
    <div className={`lit-tape ${className}`}>
      <div ref={scrollerRef} className="lit-tape-scroller" role="list">
        {items.map((item) => {
          const state = stateOf(item.index);
          const inner = (
            <>
              <span className="lit-tape-perf" aria-hidden>
                {Array.from({ length: 5 }).map((_, i) => (
                  <i key={i} />
                ))}
              </span>
              <span className="flex items-center gap-2">
                <span
                  className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                    state === 'done'
                      ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'
                      : state === 'current'
                        ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white'
                        : 'bg-ink/[0.07] text-ink/50'
                  }`}
                >
                  {state === 'done' ? <Icon name="check" /> : item.index + 1}
                </span>
                {state === 'current' && (
                  <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-wide text-amber-900">
                    {t('nowBadge', script)}
                  </span>
                )}
              </span>
              <span
                className={`mt-2 line-clamp-2 text-left font-display leading-snug text-ink ${
                  dense ? 'text-sm' : 'text-base'
                }`}
              >
                {item.title}
              </span>
              {!dense && item.preview ? (
                <span className="mt-1 line-clamp-2 text-left text-[0.7rem] leading-4 text-ink/45">
                  {item.preview}
                </span>
              ) : null}
              {item.count ? (
                <span className="mt-auto pt-2 text-[0.6rem] font-semibold uppercase tracking-wide text-ink/35">
                  {item.count} {t('abzats', script)}
                </span>
              ) : null}
            </>
          );
          const common = {
            key: item.key ?? item.index,
            ref: state === 'current' ? activeRef : undefined,
            role: 'listitem',
            className: `lit-tape-card ${dense ? 'lit-tape-card--dense' : ''} ${
              state === 'current'
                ? 'lit-tape-card--current'
                : state === 'done'
                  ? 'lit-tape-card--done'
                  : ''
            }`,
          };
          return getHref ? (
            <Link {...common} to={getHref(item)}>
              {inner}
            </Link>
          ) : (
            <button {...common} type="button" onClick={() => onSelect?.(item.index)}>
              {inner}
            </button>
          );
        })}
      </div>
    </div>
  );
}
