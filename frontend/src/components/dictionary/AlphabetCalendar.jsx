import { Link } from 'react-router-dom';
import { FALLBACK_LETTERS } from '../../utils/dictionaryHelpers';

/**
 * Kalendar uslubidagi alifbo grid.
 * letters: [{ arip, tastiyiqlangan|jami }] yoki string[]
 */
export default function AlphabetCalendar({ letters, className = '' }) {
  const allowed = new Set(FALLBACK_LETTERS);

  const cells = (() => {
    if (Array.isArray(letters) && letters.length && typeof letters[0] === 'object') {
      return letters
        .filter(
          (r) =>
            r.arip &&
            allowed.has(r.arip) &&
            (Number(r.tastiyiqlangan) > 0 || Number(r.jami) > 0)
        )
        .map((r) => ({
          letter: r.arip,
          count: Number(r.tastiyiqlangan) || Number(r.jami) || 0,
        }));
    }
    if (Array.isArray(letters) && letters.length && typeof letters[0] === 'string') {
      return letters.map((letter) => ({ letter, count: null }));
    }
    return FALLBACK_LETTERS.map((letter) => ({ letter, count: null }));
  })();

  return (
    <div className={className}>
      <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-8 lg:grid-cols-10 gap-2 md:gap-2.5">
        {cells.map(({ letter, count }) => {
          const disabled = count === 0;
          const inner = (
            <>
              <span className="font-display text-2xl md:text-3xl tracking-tight leading-none">
                {letter}
              </span>
              {count != null && (
                <span
                  className={`text-[0.6rem] uppercase tracking-[0.12em] mt-1.5 ${
                    disabled ? 'text-ink/25' : 'text-ink/40 group-hover:text-parchment/70'
                  }`}
                >
                  {count}
                </span>
              )}
            </>
          );

          if (disabled) {
            return (
              <div
                key={letter}
                className="aspect-square rounded-xl border border-ink/[0.04] bg-white/20 flex flex-col items-center justify-center text-ink/25"
                aria-disabled
              >
                {inner}
              </div>
            );
          }

          return (
            <Link
              key={letter}
              to={`/dictionary/all?letter=${encodeURIComponent(letter)}`}
              className="group aspect-square rounded-xl border border-ink/[0.08] bg-white/45 hover:bg-teal-900 hover:border-teal-900 hover:text-parchment flex flex-col items-center justify-center transition-all duration-200 shadow-[0_1px_0_rgba(28,42,36,0.04)] hover:shadow-[0_10px_28px_-18px_rgba(15,92,86,0.55)]"
            >
              {inner}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
