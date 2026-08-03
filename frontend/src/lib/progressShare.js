/**
 * Week / streak progress share payload (guest local yamasa server review).
 */

import { getGuestLocalWeekCells } from './guestLocalSummary.js';
import { getDailyGoalStatus, readDailyGoal } from './dailyGoalProgress.js';

/**
 * @param {{
 *   text: (s: string) => string,
 *   KAA: Record<string, string>,
 *   review?: {
 *     activeDays?: number,
 *     wordViews?: number,
 *     quizCompletes?: number,
 *     dictGames?: number,
 *     crosswordCompletes?: number,
 *     totalMs?: number,
 *   } | null,
 *   streak?: { current?: number, best?: number } | null,
 *   local?: import('./guestLocalSummary').getGuestLocalSummary extends Function
 *     ? ReturnType<typeof import('./guestLocalSummary').getGuestLocalSummary>
 *     : object | null,
 *   claimedToday?: boolean,
 *   url?: string,
 * }} opts
 * @returns {{ title: string, text: string, url: string } | null}
 */
export function buildProgressShare({
  text,
  KAA,
  review = null,
  streak = null,
  local = null,
  claimedToday = false,
  url,
} = {}) {
  if (typeof text !== 'function' || !KAA) return null;

  const lines = [];
  const streakCurrent = Math.max(0, Number(streak?.current) || 0);
  const streakBest = Math.max(streakCurrent, Number(streak?.best) || 0);

  if (streakCurrent > 0) {
    lines.push(
      text(KAA.shareStreakText)
        .replace('{n}', String(streakCurrent))
        .replace('{best}', String(streakBest || streakCurrent))
    );
  }

  const hasReview =
    review &&
    ((Number(review.activeDays) || 0) > 0 ||
      (Number(review.wordViews) || 0) > 0 ||
      (Number(review.quizCompletes) || 0) > 0 ||
      (Number(review.dictGames) || 0) > 0 ||
      (Number(review.crosswordCompletes) || 0) > 0);

  if (hasReview) {
    lines.push(
      text(KAA.shareWeekText)
        .replace('{days}', String(review.activeDays || 0))
        .replace('{quiz}', String(review.quizCompletes || 0))
        .replace('{words}', String(review.wordViews || 0))
        .replace('{crossword}', String(review.crosswordCompletes || 0))
    );
  } else if (local?.hasLocal) {
    const cells = getGuestLocalWeekCells(local).slice(0, 4);
    if (cells.length) {
      const parts = cells.map(
        (c) => `${text(KAA[c.labelKey] || c.labelKey)}: ${c.value}`
      );
      lines.push(text(KAA.shareLocalWeekText).replace('{parts}', parts.join(' · ')));
    }
  }

  const storedGoal = readDailyGoal();
  const goal = getDailyGoalStatus({
    claimedToday: Boolean(claimedToday),
    titleId: storedGoal.practicedId,
  });
  if (goal.doneCount > 0) {
    lines.push(
      text(KAA.shareDailyGoalText).replace('{a}', String(goal.doneCount)).replace('{b}', '2')
    );
  }

  if (!lines.length) return null;

  const shareUrl =
    url ||
    (typeof window !== 'undefined' ? `${window.location.origin}/profile` : '/profile');

  return {
    title: text(KAA.shareProgressTitle),
    text: lines.join('\n'),
    url: shareUrl,
  };
}

export function canShareProgress(opts) {
  return Boolean(buildProgressShare(opts));
}
