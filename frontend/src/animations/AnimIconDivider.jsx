/** Icon divider — sóz bilan ma'no orasida */
export default function AnimIconDivider({
  icon = '✦',
  wide = false,
  compact = false,
  amber = false,
  className = '',
}) {
  const mods = [
    wide ? 'anim-icon-divider--wide' : '',
    compact ? 'anim-icon-divider--compact' : '',
    amber ? 'anim-icon-divider--amber' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`anim-icon-divider ${mods}`} aria-hidden>
      <div className="di-line" />
      <div className="di-icon">{icon}</div>
      <div className="di-line" />
    </div>
  );
}
