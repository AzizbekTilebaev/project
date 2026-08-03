import { Link } from 'react-router-dom';
import { useUiScript } from '../contexts/UiScriptContext';
import { KAA } from '../i18n/kaa';
import { anim } from '../animations';

/**
 * Loyalty badge strip — combo chest tariyxı boyınsha.
 */
export function loyaltyTierFromHistory(history = []) {
  const tiers = new Set((history || []).map((h) => h.tier).filter(Boolean));
  if (tiers.has('diamond')) return 'diamond';
  if (tiers.has('gold')) return 'gold';
  if (tiers.has('silver')) return 'silver';
  return null;
}

export default function LoyaltyBadge({
  history = [],
  pendingCount = 0,
  claimHref = '',
  className = '',
}) {
  const { text } = useUiScript();
  const tier = loyaltyTierFromHistory(history);
  const opened = (history || []).length;
  if (!tier && opened === 0 && pendingCount === 0) return null;

  const tierVars =
    tier === 'diamond'
      ? { ['--lbs-from']: '#e0f2fe', ['--lbs-to']: '#ddd6fe', ['--lbs-text']: '#2e1065' }
      : tier === 'gold'
        ? { ['--lbs-from']: '#fef3c7', ['--lbs-to']: '#ffedd5', ['--lbs-text']: '#78350f' }
        : { ['--lbs-from']: '#f5f5f4', ['--lbs-to']: '#ede9fe', ['--lbs-text']: '#4c1d95' };

  const tierLabel =
    tier === 'diamond'
      ? text(KAA.badgeDiamond)
      : tier === 'gold'
        ? text(KAA.badgeGold)
        : tier === 'silver'
          ? text(KAA.badgeSilver)
          : text(KAA.comboChest);

  return (
    <div className={`${anim.badgeShine} ${anim.badgeActive} ${className}`} style={tierVars}>
      <span>{tierLabel}</span>
      <span className="normal-case tracking-normal font-semibold opacity-75" style={{ fontSize: '0.7rem' }}>
        {opened} {text(KAA.sandiq)}
        {pendingCount > 0 ? ` · ${pendingCount} ${text(KAA.comboChestKutilip).toLowerCase()}` : ''}
      </span>
      {pendingCount > 0 && claimHref ? (
        <Link
          to={claimHref}
          className="ml-1 rounded-full bg-violet-800/90 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-white normal-case"
        >
          {text(KAA.comboChestAshiw)}
        </Link>
      ) : null}
    </div>
  );
}
