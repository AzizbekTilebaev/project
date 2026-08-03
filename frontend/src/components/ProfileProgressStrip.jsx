import { Link } from 'react-router-dom';
import Icon from './Icon';
import { useUiScript } from '../contexts/UiScriptContext';
import { KAA } from '../i18n/kaa';
import { anim } from '../animations';
import { getDailyGoalStatus } from '../lib/dailyGoalProgress';

/**
 * Soft progress strip — Header chips o‘rniga (guest + auth Profil).
 * Chest/coins faqat auth’da; guest: goal + resume.
 */
export default function ProfileProgressStrip({
  checkin = null,
  resume = null,
  walletBalance = null,
  pendingChestCount = 0,
  className = '',
}) {
  const { text } = useUiScript();
  const goal = getDailyGoalStatus({
    claimedToday: checkin?.claimedToday,
    titleId: checkin?.titleId,
  });
  const goalLabel = goal.complete
    ? KAA.dailyGoalFull
    : goal.doneCount === 1
      ? KAA.dailyGoalHalf
      : KAA.dailyGoalEmpty;
  const goalHref = !goal.claimed
    ? '/#kun-sozi'
    : !goal.practiced && checkin?.titleId
      ? `/dictionary/game?source=checkin&ids=${encodeURIComponent(checkin.titleId)}&goal=wod`
      : resume?.href || '/quiz';

  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-2xl border border-ink/[0.07] bg-white/70 px-3.5 py-3 ${className}`.trim()}
    >
      <Link
        to={goalHref}
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
          goal.complete
            ? 'border border-emerald-500/30 bg-emerald-50 text-emerald-950'
            : 'border border-amber-400/50 bg-amber-50 text-amber-950'
        }`}
      >
        {text(goalLabel)}
      </Link>
      {walletBalance != null && (
        <Link
          to="#wallet-strip"
          className="inline-flex items-center gap-1 rounded-full bg-amber-50/90 px-2.5 py-1 text-xs font-bold text-amber-900"
        >
          <Icon name="trophy" className="text-amber-600" />
          {Number(walletBalance).toLocaleString('kk')}
        </Link>
      )}
      {pendingChestCount > 0 && (
        <Link
          to="/profile#profile-chest"
          className={`${anim.shine} inline-flex items-center gap-1 rounded-full bg-violet-700 px-2.5 py-1 text-xs font-bold text-white`}
        >
          <Icon name="sparkle" />
          {text(KAA.comboChestAshiw)}
          <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[0.65rem]">
            {pendingChestCount}
          </span>
        </Link>
      )}
      {resume?.href && (
        <Link
          to={resume.href}
          className={`${anim.shine} inline-flex max-w-[10rem] items-center gap-1 truncate rounded-full bg-sky-800 px-2.5 py-1 text-xs font-bold text-white`}
        >
          <Icon name={resume.icon || 'bolt'} />
          <span className="truncate">{text(KAA[resume.labelKey] || KAA.dawamEtiw)}</span>
        </Link>
      )}
    </div>
  );
}
