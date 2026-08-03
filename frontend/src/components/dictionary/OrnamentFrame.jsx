/**
 * Qızıl buynısh — faqat 4 burchak.
 */
export default function OrnamentFrame({ children, className = '' }) {
  return (
    <div className={`qp-ornament ${className}`.trim()}>
      <span className="qp-ornament__corner qp-ornament__corner--tl" aria-hidden />
      <span className="qp-ornament__corner qp-ornament__corner--tr" aria-hidden />
      <span className="qp-ornament__corner qp-ornament__corner--bl" aria-hidden />
      <span className="qp-ornament__corner qp-ornament__corner--br" aria-hidden />
      <div className="qp-ornament__inner">{children}</div>
    </div>
  );
}
