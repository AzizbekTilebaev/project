/** Soft Matrix Rain overlay — Home hero */
export default function AnimMatrixRain({ drops = 15, className = '' }) {
  const n = Math.max(8, Math.min(24, drops));
  return (
    <div className={`anim-matrix-rain theme-focus-hide ${className}`} aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="anim-matrix-rain__drop" />
      ))}
    </div>
  );
}
