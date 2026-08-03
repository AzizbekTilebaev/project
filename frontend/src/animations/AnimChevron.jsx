/** Cascading chevrons — CTA / “keyingi” hint */
export function AnimChevron({ count = 3, down = false, left = false, className = '', style }) {
  const n = Math.max(1, Math.min(5, count));
  const dir = left ? 'anim-chevron--left' : down ? 'anim-chevron--down' : '';
  return (
    <span className={`anim-chevron ${dir} ${className}`} style={style} aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} />
      ))}
    </span>
  );
}

/** Single rotate chevron for expand/collapse */
export function AnimChevronToggle({ open = false, className = '' }) {
  return (
    <span
      className={`anim-chevron-toggle ${open ? 'is-open' : ''} ${className}`}
      aria-hidden
    />
  );
}

export default AnimChevron;
