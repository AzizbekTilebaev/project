import { Link } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import useRecentWords from '../hooks/useRecentWords';
import ProtectedContent from '../components/ProtectedContent';
import DictShell from '../components/dictionary/DictShell';
import Icon from '../components/Icon';
import { useUiScript } from '../contexts/UiScriptContext';
import { AnimChevron, anim } from '../animations';
import { formatViewedAt } from '../lib/formatViewedAt';
import { recentPracticeHref } from '../lib/recentPractice';
import { KAA } from '../i18n/kaa';

/**
 * Barlıq jaqında kórilgen sózler — waqıt penen.
 */
export default function DictionaryRecent() {
  const { text } = useUiScript();
  const { items: recentWords, clear: clearRecent } = useRecentWords();
  const recentPlayHref = recentPracticeHref(recentWords);

  usePageMeta(
    text('Jaqında kórilgen'),
    text('Sózlikte sońǵı kórilgen sózler — waqıt belgisimen.')
  );

  return (
    <ProtectedContent>
      <DictShell className="pt-24 pb-24">
        <section className="relative mx-auto max-w-3xl px-6 pt-8 md:px-10">
          <Link
            to="/dictionary"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink/45 hover:text-teal-900"
          >
            <Icon name="left" /> {text('Sózlik')}
          </Link>

          <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="mb-1 text-[0.7rem] uppercase tracking-[0.22em] text-ink/40">
                {text('Tariyx')}
              </p>
              <h1 className="font-display text-4xl tracking-tight text-ink md:text-5xl">
                {text('Jaqında kórilgen')}
              </h1>
              <p className="mt-2 text-sm text-ink/50">
                {recentWords.length} {text('sóz')}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {recentPlayHref ? (
                <Link
                  to={recentPlayHref}
                  className={`${anim.shine} qp-btn-primary !px-3.5 !py-1.5 !text-xs`}
                >
                  <Icon name="bolt" /> {text(KAA.mashqEtiw)}
                </Link>
              ) : null}
              {recentWords.length > 0 ? (
                <button
                  type="button"
                  onClick={clearRecent}
                  className="qp-chip text-ink/50 hover:text-red-800"
                >
                  {text('Tazalaw')}
                </button>
              ) : null}
            </div>
          </div>

          {recentWords.length === 0 ? (
            <div className="rounded-2xl border border-ink/10 px-5 py-10 text-center">
              <p className="text-ink/55">{text('Áli kórilgen sóz joq.')}</p>
              <Link
                to="/dictionary/all"
                className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-teal-900 hover:underline"
              >
                {text('Barlıq sózler')}
                <AnimChevron count={1} className="opacity-60" />
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-ink/10 border-t border-ink/10">
              {recentWords.map((item) => (
                <li key={item.id}>
                  <Link
                    to={`/dictionary/${item.id}`}
                    className="flex items-center justify-between gap-3 py-3.5 no-underline transition-colors hover:text-teal-900"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-display text-xl tracking-tight text-ink">
                        {text(item.soz)}
                      </span>
                      {item.viewedAt ? (
                        <span className="mt-0.5 block text-xs tabular-nums text-ink/40">
                          {formatViewedAt(item.viewedAt, text)}
                        </span>
                      ) : null}
                    </span>
                    <AnimChevron count={2} className="shrink-0 opacity-35" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </DictShell>
    </ProtectedContent>
  );
}
