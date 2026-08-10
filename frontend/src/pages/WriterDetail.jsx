import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import usePageData from '../hooks/usePageData';
import PageGate from '../components/PageGate';
import DictShell from '../components/dictionary/DictShell';
import Icon from '../components/Icon';
import ProtectedContent from '../components/ProtectedContent';
import ScriptToggle from '../components/literature/ScriptToggle';
import SafeParagraphs from '../components/literature/SafeParagraphs';
import WriterFacts from '../components/literature/WriterFacts';
import WriterRoleChips from '../components/literature/WriterRoleChips';
import WriterTimeline from '../components/literature/WriterTimeline';
import TimeMachineGallery from '../components/literature/TimeMachineGallery';
import CreativeWorksPanel from '../components/literature/CreativeWorksPanel';
import {
  pickWriterBio,
  pickWriterName,
} from '../components/literature/litUtils';
import { t } from '../components/literature/litLabels';
import { useUiScript } from '../contexts/UiScriptContext';
import { fetchWriterBySlug } from '../api/literature';
import { getReadingLessonMeta } from '../lib/readingProgress';
import { AnimChevron, anim } from '../animations';
import { KAA } from '../i18n/kaa';
import ShareResultButton from '../components/ShareResultButton';
import GuestSoftContinue from '../components/GuestSoftContinue';
import FreePlayCtaRow from '../components/FreePlayCtaRow';
import { FOOTER_FREE_LINKS } from '../data/siteDeepLinks';
import { useAuth } from '../contexts/AuthContext';

/** Ómir jılları — interaktiv waqıt sızıǵı (tuwılǵan → qaytıs bolǵan). */
function LifeTimeline({ writer, script = 'cyrillic' }) {
  const birth = Number(writer?.birthYear) || null;
  if (!birth) return null;
  const death = Number(writer?.deathYear) || null;
  const nowYear = new Date().getFullYear();
  const endYear = death || nowYear;
  const scaleStart = Math.floor((birth - 8) / 10) * 10;
  const scaleEnd = Math.ceil((endYear + 8) / 10) * 10;
  const span = Math.max(1, scaleEnd - scaleStart);
  const startPct = ((birth - scaleStart) / span) * 100;
  const widthPct = ((endYear - birth) / span) * 100;

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        {writer.centuryRoman && (
          <span className="rounded-full bg-teal-100/90 px-3 py-1 text-xs font-bold uppercase tracking-wide text-teal-900">
            {writer.centuryRoman} {t('century', script)}
          </span>
        )}
        <span className="inline-flex items-center gap-2 rounded-full bg-amber-100/80 px-3 py-1 text-sm font-semibold text-amber-950">
          <Icon name="clock" /> {birth} — {death || t('untilNow', script)}
        </span>
        {writer.age ? (
          <span className="rounded-full bg-emerald-100/80 px-3 py-1 text-xs font-bold text-emerald-900">
            {writer.age} {t('livedYears', script)}
          </span>
        ) : null}
      </div>
      <div
        className="relative mt-4 h-3 rounded-full bg-ink/[0.07]"
        role="img"
        aria-label={`${t('lifeYearsBar', script)}: ${birth}${death ? ` — ${death}` : ''}`}
      >
        <div
          className="stats-grow-bar absolute top-0 h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500"
          style={{ left: `${startPct}%`, '--stats-width': `${widthPct}%` }}
        />
        <span
          title={`${t('bornLabel', script)}: ${birth}`}
          className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-amber-500 shadow transition-transform hover:scale-125"
          style={{ left: `${startPct}%` }}
        />
        {death ? (
          <span
            title={`${t('diedLabel', script)}: ${death}`}
            className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-rose-500 shadow transition-transform hover:scale-125"
            style={{ left: `${startPct + widthPct}%` }}
          />
        ) : null}
      </div>
      <div className="mt-1.5 flex justify-between text-[0.65rem] tabular-nums text-ink/35">
        <span>{scaleStart}</span>
        <span>{scaleEnd}</span>
      </div>
    </div>
  );
}

export default function WriterDetail() {
  const { slug } = useParams();
  const { script, setScript, text } = useUiScript();
  const { isAuthenticated } = useAuth();

  const { status, data, error, reload } = usePageData(
    () => fetchWriterBySlug(slug, { script }),
    { deps: [slug, script], enabled: Boolean(slug) }
  );

  const writer = data?.writer || data;
  const books = data?.books || writer?.books || [];
  const creativeWorks = data?.creativeWorks || [];
  const photos = data?.photos || [];
  const name = pickWriterName(writer, script);
  const life = writer?.lifeSpan || writer?.life_span || '';
  const paragraphs = pickWriterBio(writer, script);
  const readingMeta = useMemo(() => getReadingLessonMeta(), []);
  const firstBook = books[0];
  const firstBookId = firstBook?.id || firstBook?.bookId;
  const firstBookHref = firstBookId ? `/books/${encodeURIComponent(firstBookId)}` : null;
  const showReadingMashq = readingMeta.practiceCount > 0;

  usePageMeta(
    name || text('Jazıwshı'),
    life ? `${name} — ${life}` : `${name || text('Jazıwshı')} ${t('biography', script).toLowerCase()}`
  );

  return (
    <PageGate
      status={status}
      error={error}
      onRetry={reload}
      backHref="/writers"
      backLabel={t('writersBack', script)}
    >
      <DictShell className="pt-24 pb-24">
        <ProtectedContent>
          <section className="relative mx-auto max-w-3xl px-6 pt-8 md:px-10">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
              <Link
                to="/writers"
                className="inline-flex items-center gap-1.5 text-sm text-ink/45 hover:text-teal-900"
              >
                <Icon name="left" /> {t('writersBack', script)}
              </Link>
              <ScriptToggle
                value={script}
                onChange={setScript}
              />
            </div>

            <article className="animate-dict-rise overflow-hidden qp-surface shadow-[0_28px_70px_-35px_rgba(28,42,36,0.45)]">
              <header className="border-b border-ink/[0.06] bg-gradient-to-br from-amber-50/80 via-white/70 to-orange-50/50 px-7 py-9 md:px-10">
                <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-amber-800/55">
                  {t('biography', script)}
                </p>
                <h1 className="font-display text-3xl tracking-tight text-ink md:text-4xl">
                  {name || '—'}
                </h1>
                <WriterRoleChips roles={writer?.roles} script={script} />
                {writer?.birthYear ? (
                  <LifeTimeline writer={writer} script={script} />
                ) : life ? (
                  <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-100/80 px-3 py-1 text-sm font-semibold text-amber-950">
                    <Icon name="clock" /> {life}
                  </p>
                ) : null}
              </header>

              <div className="px-7 py-8 md:px-10">
                <WriterFacts writer={writer} script={script} />
                <div className="mt-6">
                  <SafeParagraphs paragraphs={paragraphs} script={script} />
                </div>
                <TimeMachineGallery photos={photos} writer={writer} script={script} />
                <WriterTimeline facts={writer?.facts} script={script} />
              </div>
            </article>

            <div className="mt-6 animate-dict-rise qp-card qp-card--static px-4 py-4 md:px-5">
              <p className="mb-1 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-amber-800/60">
                {t('writerNextEyebrow', script)}
              </p>
              <p className="mb-3 text-sm leading-6 text-amber-950/75">{t('writerNextHint', script)}</p>
              <div className="flex flex-wrap gap-2">
                {firstBookHref ? (
                  <Link
                    to={firstBookHref}
                    className={`${anim.shine} qp-btn-primary !px-4 !py-2 !text-xs`}
                  >
                    <Icon name="book" /> {t('startReading', script)}
                    <AnimChevron count={2} className="opacity-80" style={{ ['--dch-color']: '#ecfdf5' }} />
                  </Link>
                ) : (
                  <Link
                    to="/books"
                    className={`${anim.shine} qp-btn-primary !px-4 !py-2 !text-xs`}
                  >
                    <Icon name="book" /> {t('writerNextBrowse', script)}
                    <AnimChevron count={2} className="opacity-80" style={{ ['--dch-color']: '#ecfdf5' }} />
                  </Link>
                )}
                {showReadingMashq && (
                  <Link
                    to="/tutor/practice?from=reading"
                    className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-white px-4 py-2 text-xs font-bold text-amber-950"
                  >
                    <Icon name="bolt" /> {t('practiceVocab', script)}
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[0.65rem]">
                      {readingMeta.practiceCount}
                    </span>
                  </Link>
                )}
                {!showReadingMashq && (
                  <Link
                    to="/tutor/practice?from=reading"
                    className="inline-flex items-center gap-1.5 rounded-full border border-teal-700/25 bg-white px-4 py-2 text-xs font-bold text-teal-950"
                  >
                    <Icon name="bolt" /> {text(KAA.practiceNav)}
                  </Link>
                )}
                {!firstBookHref && (
                  <Link
                    to="/jumbaqlar"
                    className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-white px-4 py-2 text-xs font-bold text-sky-950"
                  >
                    <Icon name="sparkle" /> {t('writerNextJumbaq', script)}
                  </Link>
                )}
                <ShareResultButton
                  title={text(KAA.shareWriterTitle)}
                  text={text(KAA.shareWriterText).replace('{name}', name || text(KAA.shareWriterTitle))}
                  url={
                    typeof window !== 'undefined' && slug
                      ? `${window.location.origin}/writers/${encodeURIComponent(slug)}`
                      : undefined
                  }
                  className="inline-flex items-center gap-1.5 rounded-full border border-teal-700/25 bg-white px-4 py-2 text-xs font-bold text-teal-950"
                  compact
                />
              </div>
              {!isAuthenticated ? (
                <GuestSoftContinue
                  className="mt-3 text-left"
                  titleKey={null}
                  bodyKey="authGuestFreeBody"
                  compact
                />
              ) : null}
              <p className="mt-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-amber-800/55">
                {text(KAA.readingFinishFree)}
              </p>
              <FreePlayCtaRow links={FOOTER_FREE_LINKS} justify="start" className="mt-2" compact />
            </div>

            <CreativeWorksPanel
              creativeWorks={creativeWorks}
              books={books}
              script={script}
              readingPracticeCount={readingMeta.practiceCount}
            />
          </section>
        </ProtectedContent>
      </DictShell>
    </PageGate>
  );
}
