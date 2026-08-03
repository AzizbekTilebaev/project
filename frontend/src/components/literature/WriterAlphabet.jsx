import { CYRILLIC_LETTERS, LATIN_LETTERS } from './litUtils';
import { t } from './litLabels';

/**
 * Alphabet filter strip for writers list.
 */
export default function WriterAlphabet({
  script = 'cyrillic',
  active = '',
  onSelect,
  className = '',
}) {
  const letters = script === 'latin' ? LATIN_LETTERS : CYRILLIC_LETTERS;

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onSelect?.('')}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all ${
            !active
              ? 'bg-teal-800 text-white shadow-sm'
              : 'border border-ink/10 bg-white/45 text-ink/55 hover:border-teal-700/30 hover:text-teal-900'
          }`}
        >
          {t('allItems', script)}
        </button>
        {letters.map((letter) => {
          const selected = active === letter;
          return (
            <button
              key={letter}
              type="button"
              onClick={() => onSelect?.(selected ? '' : letter)}
              className={`min-w-[2rem] rounded-lg px-2 py-1.5 font-display text-sm transition-all ${
                selected
                  ? 'bg-teal-800 text-white shadow-sm'
                  : 'border border-ink/10 bg-white/45 text-ink/70 hover:-translate-y-0.5 hover:border-teal-700/30 hover:text-teal-900'
              }`}
            >
              {letter}
            </button>
          );
        })}
      </div>
    </div>
  );
}
