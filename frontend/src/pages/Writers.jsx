import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import usePageData from '../hooks/usePageData';
import PageGate from '../components/PageGate';
import DictShell from '../components/dictionary/DictShell';
import Icon from '../components/Icon';
import ScriptToggle from '../components/literature/ScriptToggle';
import WriterAlphabet from '../components/literature/WriterAlphabet';
import { pickWriterName } from '../components/literature/litUtils';
import { t } from '../components/literature/litLabels';
import { useUiScript } from '../contexts/UiScriptContext';
import { fetchWriters } from '../api/literature';
import { AnimIconDivider, AnimChevron } from '../animations';
import { KAA } from '../i18n/kaa';
import FreePlayCtaRow from '../components/FreePlayCtaRow';
import { FOOTER_FREE_LINKS } from '../data/siteDeepLinks';
import GuestSoftContinue from '../components/GuestSoftContinue';
import { useAuth } from '../contexts/AuthContext';

const PAGE_SIZE = 48;
const ALPHABET_KEY = 'literature:alphabetVisible';

function readAlphabetVisible() {
  try {
    return localStorage.getItem(ALPHABET_KEY) !== '0';
  } catch {
    return true;
  }
}

function writeAlphabetVisible(visible) {
  try {
    localStorage.setItem(ALPHABET_KEY, visible ? '1' : '0');
  } catch {
    /* ignore */
  }
  return visible;
}

/** Ómir jılları — interaktiv chip: ásir, jasaǵan jılları hám jas. */
function LifeBadge({ writer, script = 'cyrillic' }) {
  const { birthYear, deathYear, age, centuryRoman, lifeSpan } = writer;
  if (!birthYear && !lifeSpan) return null;
  return (
    <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
      {centuryRoman && (
        <span className="rounded-md bg-teal-100/80 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-teal-900">
          {centuryRoman} {t('century', script)}
        </span>
      )}
      <span className="text-xs tabular-nums text-ink/45">
        {birthYear ? `${birthYear}${deathYear ? ` — ${deathYear}` : ' —'}` : lifeSpan}
      </span>
      {age ? (
        <span className="rounded-md bg-amber-100/80 px-1.5 py-0.5 text-[0.6rem] font-semibold text-amber-900">
          {age} {t('livedYears', script)}
        </span>
      ) : null}
    </span>
  );
}

export default function Writers() {
  const { script, setScript, text } = useUiScript();
  const { isAuthenticated } = useAuth();
  usePageMeta(
    t('writersBack', script),
    text('Qaraqalpaq shayırları hám jazıwshıları — izlew hám alfavit.')
  );

  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const letter = searchParams.get('letter') || '';
  const works = searchParams.get('works') || '';
  const century = searchParams.get('century') || '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const [draft, setDraft] = useState(q);
  const [alphabetVisible, setAlphabetVisible] = useState(readAlphabetVisible);

  const { status, data, error, reload } = usePageData(
    () =>
      fetchWriters({
        q: q || undefined,
        letter: letter || undefined,
        works: works || undefined,
        century: century || undefined,
        script,
        page,
        limit: PAGE_SIZE,
      }),
    { deps: [q, letter, works, century, page, script] }
  );

  const writers = data?.writers || data?.items || [];
  const facets = data?.facets || null;
  const total = Number(data?.total ?? writers.length) || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const setParam = (patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([k, v]) => {
      if (v == null || v === '') next.delete(k);
      else next.set(k, String(v));
    });
    setSearchParams(next, { replace: false });
  };

  const toggleAlphabet = () => {
    setAlphabetVisible((v) => writeAlphabetVisible(!v));
  };

  const groupedHint = useMemo(() => {
    const parts = [];
    if (letter) parts.push(`«${letter}» ${t('fromLetter', script)}`);
    if (q.trim()) parts.push(`«${q.trim()}» ${t('searchWord', script)}`);
    if (works === 'with') parts.push(t('hasWorks', script).toLowerCase());
    if (works === 'without') parts.push(t('noBooks', script).toLowerCase());
    if (century) parts.push(`${century}-${t('century', script)}`);
    return parts.length ? parts.join(' · ') : t('allWriters', script);
  }, [letter, q, works, century, script]);

  return (
    <PageGate
      status={status}
      error={error}
      onRetry={reload}
      backHref="/literature"
      backLabel={t('literatureBack', script)}
    >
      <DictShell className="pt-24 pb-24">
        <section className="relative mx-auto max-w-4xl px-6 pt-8 md:px-10">
          <Link
            to="/literature"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink/45 hover:text-teal-900"
          >
            <Icon name="left" /> {t('literatureBack', script)}
          </Link>

          <div className="qp-section-head">
            <div>
              <p className="mb-1 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-amber-800/60">
                {t('writers', script)} · {t('writersBack', script)}
              </p>
              <h1 className="font-display text-4xl tracking-tight text-ink md:text-5xl">
                {t('writersBack', script)}
              </h1>
              <AnimIconDivider amber className="mt-2 mb-1" />
              <p className="mt-2 text-sm text-ink/50">
                {groupedHint} · {total} {t('people', script)}
              </p>
            </div>
            <ScriptToggle value={script} onChange={setScript} />
          </div>

          {works !== 'with' && (
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setParam({ works: 'with', page: 1 })}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-50/80 px-3.5 py-1.5 text-xs font-bold text-emerald-950"
              >
                <Icon name="book" /> {t('writerHasWorksHint', script)}
              </button>
            </div>
          )}

          <form
            className="mb-5"
            onSubmit={(e) => {
              e.preventDefault();
              setParam({ q: draft.trim(), page: 1 });
            }}
          >
            <div className="flex gap-2">
              <label className="relative flex-1">
                <Icon
                  name="search"
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/35"
                />
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={t('searchByName', script)}
                  className="w-full qp-card qp-card--static py-3.5 pl-11 pr-4 text-sm outline-none transition focus:border-teal-700/40 focus:bg-white"
                />
              </label>
              <button
                type="submit"
                className="rounded-2xl bg-teal-800 px-5 text-sm font-bold text-white hover:bg-teal-900"
              >
                {t('searchBtn', script)}
              </button>
            </div>
          </form>

          <div className="mb-5 flex flex-wrap items-center gap-2">
            <div className="inline-flex qp-chip !rounded-full p-1 text-xs">
              {[
                { id: '', label: `${t('allItems', script)}${facets ? ` · ${facets.total}` : ''}` },
                { id: 'with', label: `${t('hasWorks', script)}${facets ? ` · ${facets.withBooks}` : ''}` },
                { id: 'without', label: `${t('noBooks', script)}${facets ? ` · ${facets.withoutBooks}` : ''}` },
              ].map((f) => (
                <button
                  key={f.id || 'all'}
                  type="button"
                  onClick={() => setParam({ works: f.id, page: 1 })}
                  className={`rounded-full px-3 py-1.5 transition-all ${
                    works === f.id
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-ink/50 hover:text-amber-900'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {facets?.centuries?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {facets.centuries.map((c) => {
                  const selected = String(c.century) === century;
                  return (
                    <button
                      key={c.century}
                      type="button"
                      onClick={() => setParam({ century: selected ? '' : c.century, page: 1 })}
                      className={`rounded-full px-2.5 py-1.5 text-[0.65rem] font-bold uppercase tracking-wide transition-all ${
                        selected
                          ? 'bg-teal-800 text-white shadow-sm'
                          : 'border border-ink/10 bg-white/45 text-ink/55 hover:-translate-y-0.5 hover:border-teal-700/30 hover:text-teal-900'
                      }`}
                    >
                      {c.roman} {t('century', script)} · {c.count}
                    </button>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              onClick={toggleAlphabet}
              aria-expanded={alphabetVisible}
              className="ml-auto inline-flex items-center gap-1.5 qp-chip text-xs font-semibold text-ink/55 transition hover:text-teal-900"
            >
              <Icon name={alphabetVisible ? 'up' : 'down'} />
              {alphabetVisible ? t('hideAlphabet', script) : t('showAlphabet', script)}
            </button>
          </div>

          {alphabetVisible && (
            <WriterAlphabet
              script={script}
              active={letter}
              onSelect={(l) => setParam({ letter: l, page: 1 })}
              className="animate-dict-rise mb-8"
            />
          )}

          {writers.length === 0 ? (
            <div className="qp-surface border-dashed px-6 py-16 text-center">
              <p className="font-display text-2xl text-ink/60">{t('notFound', script)}</p>
              <p className="mt-2 text-sm text-ink/45">{t('notFoundHint', script)}</p>
              <p className="mt-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-teal-800/55">
                {text(KAA.notFoundFreeEyebrow)}
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <Link
                  to="/books"
                  className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-4 py-2 text-xs font-bold text-ink/70"
                >
                  <Icon name="book" /> {text(KAA.readingLandingCta)}
                </Link>
                <Link
                  to="/literature"
                  className="inline-flex items-center gap-1.5 rounded-full border border-teal-700/25 bg-white px-4 py-2 text-xs font-bold text-teal-950"
                >
                  <Icon name="scroll" /> {text(KAA.adebiyat)}
                </Link>
              </div>
              <FreePlayCtaRow
                links={FOOTER_FREE_LINKS}
                showSoftProfile
                justify="center"
                className="mt-3"
              />
              {!isAuthenticated ? (
                <GuestSoftContinue
                  className="mx-auto mt-3 max-w-md text-left"
                  titleKey={null}
                  bodyKey="authGuestFreeBody"
                  compact
                />
              ) : null}
            </div>
          ) : (
            <ul className="space-y-2.5">
              {writers.map((w, idx) => {
                const name = pickWriterName(w, script);
                const slug = w.slug || w.id;
                return (
                  <li
                    key={slug || idx}
                    style={{ animationDelay: `${Math.min(idx, 12) * 30}ms` }}
                    className="animate-dict-row"
                  >
                    <Link
                      to={`/writers/${encodeURIComponent(slug)}`}
                      className="group flex items-center gap-4 qp-card px-4 py-3.5 transition-all hover:-translate-y-0.5 hover:border-amber-600/25 hover:bg-amber-50/40 hover:shadow-md"
                    >
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 font-display text-lg text-white shadow-sm">
                        {(name || '?').charAt(0)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-display text-lg text-ink group-hover:text-amber-950">
                          {name}
                        </span>
                        <LifeBadge writer={w} script={script} />
                      </span>
                      {w.hasBooks ? (
                        <span className="hidden shrink-0 items-center gap-1 rounded-full bg-emerald-100/90 px-2.5 py-1 text-[0.65rem] font-bold text-emerald-900 sm:inline-flex">
                          <Icon name="book" /> {w.bookCount} {t('bookUnit', script)}
                        </span>
                      ) : null}
                      <AnimChevron count={2} className="opacity-35 group-hover:opacity-90 shrink-0" style={{ ['--dch-color']: '#b45309' }} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {totalPages > 1 && (
            <nav className="mt-10 flex items-center justify-center gap-3">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setParam({ page: page - 1 })}
                className="qp-btn-ghost !rounded-xl disabled:opacity-30"
              >
                ← {t('prev', script)}
              </button>
              <span className="text-xs font-semibold text-ink/50">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setParam({ page: page + 1 })}
                className="qp-btn-ghost !rounded-xl disabled:opacity-30"
              >
                {t('next', script)} →
              </button>
            </nav>
          )}
        </section>
      </DictShell>
    </PageGate>
  );
}
