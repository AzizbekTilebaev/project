import { memo } from 'react';
import { Link } from 'react-router-dom';
import {
  CARD_SHELL,
  referenceTarget,
  grammarRefTarget,
  splitHighlight,
} from '../../utils/dictionaryHelpers';
import FavoriteButton from './FavoriteButton';
import { useUiScript } from '../../contexts/UiScriptContext';
import { AnimIconDivider } from '../../animations';

function Highlighted({ value, query }) {
  const { text } = useUiScript();
  const display = text(value);
  const q = query ? text(query) : '';
  const parts = splitHighlight(display, q);
  if (!parts) return display;
  return (
    <>
      {parts.before}
      <mark className="bg-teal-200/80 text-ink rounded px-0.5">{parts.match}</mark>
      {parts.after}
    </>
  );
}

export const HomonymGroupCard = memo(function HomonymGroupCard({
  group,
  query,
  favoriteActive,
  onFavoriteToggle,
  from = null,
}) {
  const { text } = useUiScript();
  const primary = group.items[0];
  const detailTo = from
    ? `/dictionary/${primary.id}?from=${encodeURIComponent(from)}`
    : `/dictionary/${primary.id}`;
  return (
    <div className="flex gap-2 items-stretch">
      <Link to={detailTo} className={`${CARD_SHELL} flex-1 min-w-0`}>
        <div className="flex flex-wrap items-baseline gap-3 mb-3">
          <span className="font-display text-2xl md:text-3xl text-ink group-hover:text-teal-900 transition-colors">
            <Highlighted value={group.base} query={query} />
          </span>
          <span className="text-[0.65rem] uppercase tracking-[0.16em] text-ink/40">
            {text(`${group.items.length} omonim`)}
          </span>
        </div>
        <ul className="space-y-2">
          {group.items.map((entry) => {
            const roman = entry.soz.slice(group.base.length).trim();
            const refTarget = referenceTarget(entry);
            const grammarRef = !refTarget && grammarRefTarget(entry);
            return (
              <li key={entry.id} className="flex items-baseline gap-3">
                <span className="font-display text-lg text-teal-800/70 min-w-[2rem]">
                  {text(roman)}
                </span>
                <span className="text-ink/70 leading-relaxed">
                  {refTarget ? (
                    <>
                      <em className="text-ink/45">{text('qarań')}</em>{' '}
                      <span className="font-display text-teal-900">
                        {text(refTarget).toUpperCase()}
                      </span>
                    </>
                  ) : grammarRef ? (
                    <>
                      <span className="font-display text-teal-900">
                        {text(grammarRef.base).toUpperCase()}
                      </span>{' '}
                      <em className="text-ink/45">
                        {text(`feyiliniń ${grammarRef.form}`)}
                      </em>
                    </>
                  ) : entry.birinshi_aniqlama ? (
                    text(
                      entry.birinshi_aniqlama.slice(0, 90) +
                        (entry.birinshi_aniqlama.length > 90 ? '…' : '')
                    )
                  ) : (
                    text('Anıqlama joq')
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </Link>
      {onFavoriteToggle && (
        <div className="flex items-start pt-6">
          <FavoriteButton active={favoriteActive} onToggle={() => onFavoriteToggle(primary)} />
        </div>
      )}
    </div>
  );
});

function WordCard({ entry, query, favoriteActive, onFavoriteToggle, from = null }) {
  const { text } = useUiScript();
  const quote = entry.birinshi_misal;
  const refTarget = referenceTarget(entry);
  const grammarRef = !refTarget && grammarRefTarget(entry);
  const detailTo = from
    ? `/dictionary/${entry.id}?from=${encodeURIComponent(from)}`
    : `/dictionary/${entry.id}`;

  const body = refTarget ? (
    <>
      <div className="flex flex-wrap items-baseline gap-3 mb-2">
        <span className="font-display text-2xl md:text-3xl text-ink group-hover:text-teal-900 transition-colors">
          <Highlighted value={entry.soz} query={query} />
        </span>
      </div>
      <p className="text-ink/70 leading-relaxed">
        <em className="text-ink/45">{text('qarań')}</em>{' '}
        <span className="font-display text-lg text-teal-900 tracking-tight">
          {text(refTarget).toUpperCase()}
        </span>
      </p>
    </>
  ) : grammarRef ? (
    <>
      <div className="flex flex-wrap items-baseline gap-3 mb-2">
        <span className="font-display text-2xl md:text-3xl text-ink group-hover:text-teal-900 transition-colors">
          <Highlighted value={entry.soz} query={query} />
        </span>
        <span className="text-[0.65rem] uppercase tracking-[0.16em] text-teal-800/80">
          {text('grammatikalıq forma')}
        </span>
      </div>
      <p className="text-ink/70 leading-relaxed">
        <span className="font-display text-lg text-teal-900 tracking-tight">
          {text(grammarRef.base).toUpperCase()}
        </span>{' '}
        <em className="text-ink/45">{text(`feyiliniń ${grammarRef.form}`)}</em>
      </p>
    </>
  ) : (
    <>
      <div className="flex flex-wrap items-baseline gap-3 mb-1">
        <span className="font-display text-2xl md:text-3xl text-ink group-hover:text-teal-900 transition-colors">
          <Highlighted value={entry.soz} query={query} />
        </span>
        {entry.category && (
          <span className="text-[0.65rem] uppercase tracking-[0.16em] text-teal-800/80">
            {text(entry.category)}
          </span>
        )}
      </div>
      <AnimIconDivider compact />
      <p className="text-ink/70 leading-relaxed mb-4">
        {entry.birinshi_aniqlama
          ? text(
              entry.birinshi_aniqlama.slice(0, 140) +
                (entry.birinshi_aniqlama.length > 140 ? '…' : '')
            )
          : text('Anıqlama joq')}
      </p>
      {quote?.example && (
        <div className="pt-4 mt-1 border-t border-dashed border-ink/[0.08]">
          <p className="text-[0.65rem] uppercase tracking-[0.16em] text-ink/35 mb-2">
            {text('Mısal')}
          </p>
          <p className="font-display italic text-ink/60 text-[0.95rem] leading-snug line-clamp-2">
            “{text(quote.example.slice(0, 110))}
            {quote.example.length > 110 ? '…' : ''}”
          </p>
          {quote.author && (
            <div className="mt-3 flex flex-col gap-0.5">
              <span className="text-[0.6rem] uppercase tracking-[0.16em] text-ink/30">
                {text('Avtor')}
              </span>
              <span className="text-sm text-teal-900 font-medium">{text(quote.author)}</span>
            </div>
          )}
        </div>
      )}
    </>
  );

  return (
    <div className="flex gap-2 items-stretch">
      <Link to={detailTo} className={`${CARD_SHELL} flex-1 min-w-0`}>
        {body}
      </Link>
      {onFavoriteToggle && (
        <div className="flex items-start pt-6">
          <FavoriteButton active={favoriteActive} onToggle={() => onFavoriteToggle(entry)} />
        </div>
      )}
    </div>
  );
}

export default memo(WordCard);
