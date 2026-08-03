import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import Icon from './Icon';
import { fetchMyActivity } from '../api/stats';
import { useAuth } from '../contexts/AuthContext';
import { useUiScript } from '../contexts/UiScriptContext';
import { KAA } from '../i18n/kaa';
import { AnimChevron, AnimIconDivider, anim } from '../animations';
import { formatDurationMs } from '../lib/formatDuration';
import { getGuestLocalSummary, getGuestLocalWeekCells } from '../lib/guestLocalSummary';
import useResumeTick from '../hooks/useResumeTick';
import GuestLocalWeekPanel from './GuestLocalWeekPanel';
import ShareProgressButton from './ShareProgressButton';

/**
 * Sońǵı 7 kún oqıw review — Home / Snapshot.
 * Guest / bos: local seriya + keyingi qádem CTAs.
 */
export default function WeeklyReview({ dense = false, className = '' }) {
  const { text } = useUiScript();
  const { isAuthenticated } = useAuth();
  const [review, setReview] = useState(null);
  const [timeSpent, setTimeSpent] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const resumeTick = useResumeTick();
  const local = useMemo(() => getGuestLocalSummary(), [resumeTick]);

  useEffect(() => {
    let alive = true;
    const load = () => {
      fetchMyActivity({ days: 14, period: 'week' })
        .then((res) => {
          if (!alive) return;
          setReview(res.review || null);
          setTimeSpent(res.timeSpent || null);
        })
        .catch(() => {
          if (alive) {
            setReview(null);
            setTimeSpent(null);
          }
        })
        .finally(() => {
          if (alive) setLoaded(true);
        });
    };
    load();
    const onAuth = () => load();
    window.addEventListener('qp:auth-changed', onAuth);
    return () => {
      alive = false;
      window.removeEventListener('qp:auth-changed', onAuth);
    };
  }, [isAuthenticated]);

  const hasTime = (Number(review?.totalMs) || 0) > 0;
  const hasSignal = Boolean(
    review &&
      (review.activeDays > 0 ||
        review.wordViews > 0 ||
        review.quizCompletes > 0 ||
        review.dictGames > 0 ||
        review.crosswordCompletes > 0 ||
        hasTime)
  );

  // Dense Snapshot: bos + local joq → jasır
  if (loaded && !hasSignal && dense && !local.hasLocal) {
    return null;
  }

  const durationLabel = formatDurationMs(review?.totalMs || 0);
  const surfaceChips = hasSignal
    ? [
        { key: 'quiz', label: KAA.testWaqti, ms: timeSpent?.quizMs },
        { key: 'dictionary', label: KAA.sozlikWaqti, ms: timeSpent?.dictionaryMs },
        { key: 'crossword', label: KAA.krossvordWaqti, ms: timeSpent?.crosswordMs },
        { key: 'literature', label: KAA.adebiyatWaqti, ms: timeSpent?.literatureMs },
        { key: 'tutor', label: KAA.tutorWaqti, ms: timeSpent?.tutorMs },
        { key: 'immersion', label: KAA.immersionWaqti, ms: timeSpent?.immersionMs },
        { key: 'jumbaq', label: KAA.jumbaqWaqti, ms: timeSpent?.jumbaqMs },
      ].filter((s) => (Number(s.ms) || 0) > 0)
    : [];
  const cells = hasSignal
    ? [
        {
          label: text(KAA.aktivKunler),
          value: `${review.activeDays}/7`,
          icon: 'flame',
        },
        {
          label: text(KAA.korilgenSozler),
          value: review.wordViews,
          icon: 'eye',
        },
        {
          label: text(KAA.testler),
          value: review.quizCompletes,
          icon: 'trophy',
        },
        {
          label: text(KAA.sozOyinlari),
          value: review.dictGames,
          icon: 'gamepad',
        },
        {
          label: text(KAA.krossvord),
          value: review.crosswordCompletes,
          icon: 'grammar',
        },
        {
          label: text(KAA.oqiwWaqti),
          value: durationLabel,
          icon: 'clock',
        },
      ]
    : [];

  const localWeekCells = useMemo(
    () => (!hasSignal ? getGuestLocalWeekCells(local) : []),
    [hasSignal, local]
  );

  const showEmpty = !hasSignal;
  const showLocalWeek = showEmpty && localWeekCells.length > 0;

  return (
    <section
      className={`rounded-[1.75rem] border border-teal-700/15 bg-gradient-to-br from-teal-50/70 via-white/85 to-sky-50/50 ${
        dense ? 'px-4 py-4' : 'px-5 py-5 sm:px-6'
      } ${className}`}
    >
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-teal-800/60">
            {text(KAA.hapte)}
          </p>
          {!dense && (
            <>
              <h2 className="mt-1 font-display text-2xl tracking-tight text-ink">
                {text(KAA.haptaliqReview)}
              </h2>
              <AnimIconDivider compact className="mt-2" />
              <p className="mt-1 text-sm text-ink/50">
                {showEmpty
                  ? showLocalWeek
                    ? text(KAA.haptaliqReviewLocal)
                    : text(KAA.haptaliqReviewEmpty)
                  : text(KAA.haptaliqReviewTush)}
              </p>
            </>
          )}
          {dense && (
            <p className="mt-0.5 text-sm font-semibold text-ink">{text(KAA.haptaliqReview)}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(hasSignal || local.hasLocal) && (
            <ShareProgressButton
              compact={dense}
              review={hasSignal ? review : null}
              local={hasSignal ? null : local}
              url={
                typeof window !== 'undefined'
                  ? `${window.location.origin}/quiz/statistics`
                  : undefined
              }
            />
          )}
          <Link
            to="/quiz/statistics"
            className={`inline-flex items-center gap-1.5 text-sm font-semibold text-teal-900 ${anim.underlineGrow}`}
          >
            {text(KAA.tolıqStatistika).replace(' →', '')}
            <AnimChevron count={2} className="opacity-60" />
          </Link>
        </div>
      </div>

      {hasSignal && (
        <div
          className={`grid gap-2 ${dense ? 'grid-cols-3 sm:grid-cols-6' : 'grid-cols-2 sm:grid-cols-3'}`}
        >
          {cells.map((c) => (
            <div
              key={c.label}
              className="rounded-2xl border border-ink/[0.06] bg-white/70 px-3 py-3"
            >
              <p className="mb-1 inline-flex items-center gap-1 text-[0.65rem] uppercase tracking-wide text-ink/45">
                <Icon name={c.icon} className="text-teal-700/70" />
                {c.label}
              </p>
              <p className="font-display text-xl text-ink tabular-nums">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {surfaceChips.length > 0 && (
        <div className={`flex flex-wrap gap-2 ${hasSignal ? 'mt-3' : ''}`}>
          {surfaceChips.map((s) => (
            <span
              key={s.key}
              className="inline-flex items-center gap-1.5 rounded-full border border-teal-800/12 bg-white/80 px-3 py-1.5 text-xs font-semibold text-teal-950"
            >
              <span className="text-ink/45">{text(s.label)}</span>
              <span className="tabular-nums">{formatDurationMs(s.ms)}</span>
            </span>
          ))}
        </div>
      )}

      {showLocalWeek && (
        <GuestLocalWeekPanel local={local} dense={dense} showPrimary={false} />
      )}

      {(local.primary || (showEmpty && !showLocalWeek)) && (
        <div className={hasSignal || showLocalWeek ? 'mt-4 border-t border-teal-700/10 pt-4' : ''}>
          {local.primary ? (
            <Link
              to={local.primary.href}
              className={`${anim.shine} inline-flex items-center gap-2 rounded-full bg-teal-800 px-4 py-2.5 text-sm font-bold text-white`}
            >
              <Icon name={local.primary.icon} />
              {text(KAA[local.primary.labelKey] || local.primary.labelKey)}
              <AnimChevron count={2} className="opacity-80" style={{ ['--dch-color']: '#ecfdf5' }} />
            </Link>
          ) : (
            <Link
              to="/tutor/practice"
              className={`${anim.shine} inline-flex items-center gap-2 rounded-full bg-teal-800 px-4 py-2.5 text-sm font-bold text-white`}
            >
              <Icon name="bolt" /> {text(KAA.haptaliqCtaPractice)}
              <AnimChevron count={2} className="opacity-80" style={{ ['--dch-color']: '#ecfdf5' }} />
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
