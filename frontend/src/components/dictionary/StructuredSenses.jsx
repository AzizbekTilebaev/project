import { Link } from 'react-router-dom';
import { useUiScript } from '../../contexts/UiScriptContext';

/** Numbered senses + nested citation examples (shared by bilingual / frazeologiya). */
export default function StructuredSenses({ senses, showEmpty = false }) {
  const { text } = useUiScript();
  const list = Array.isArray(senses) ? senses : [];
  if (!list.length) {
    return showEmpty ? <p className="text-sm text-ink/45">{text('Mánisi joq')}</p> : null;
  }

  const multi = list.length > 1 || list.some((s) => (s.examples || []).length);

  return (
    <ol className="mt-3 space-y-4 text-sm leading-relaxed text-ink/75">
      {list.map((s) => (
        <li key={`${s.n}-${(s.text || '').slice(0, 24)}`} className="min-w-0">
          <div className="flex gap-2">
            {multi ? (
              <span className="shrink-0 font-semibold text-teal-800">{s.n}.</span>
            ) : null}
            <p className="min-w-0 text-ink/80">{s.text}</p>
          </div>
          {(s.examples || []).length > 0 ? (
            <ul className="mt-3 space-y-3 border-l-2 border-teal-800/15 pl-3">
              {s.examples.map((ex, idx) => (
                <li key={ex.id || `${s.n}-ex-${idx}`} className="min-w-0">
                  <p className="font-display text-[0.95rem] italic leading-relaxed text-ink/70">
                    {ex.example}
                  </p>
                  {ex.author ? (
                    <p className="mt-1.5 text-xs text-ink/45">
                      <span className="uppercase tracking-[0.12em]">{text('Avtor')}</span>
                      {': '}
                      {ex.authorSlug ? (
                        <Link
                          to={`/writers/${encodeURIComponent(ex.authorSlug)}`}
                          className="font-semibold text-teal-900 no-underline hover:underline"
                        >
                          {text(ex.authorName || ex.author)}
                        </Link>
                      ) : (
                        <span className="font-semibold text-ink/65">{text(ex.author)}</span>
                      )}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
