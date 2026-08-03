import { useMemo } from 'react';
import { getAnonymousId } from '../lib/anonymousId';

function isInputTarget(el) {
  if (!el || !(el instanceof Element)) return false;
  const tag = el.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (el.isContentEditable) return true;
  if (el.closest?.('input, textarea, select, [contenteditable="true"], [data-allow-copy="1"]')) {
    return true;
  }
  return false;
}

/**
 * Watermark + user-select:none qatlami (global ContentProtection bilan birga).
 */
export default function ProtectedContent({ children, className = '' }) {
  const watermark = useMemo(() => {
    const id = getAnonymousId();
    return id.slice(0, 8).toUpperCase();
  }, []);

  return (
    <div
      className={`protected-content relative ${className}`}
      onDragStart={(e) => {
        if (!isInputTarget(e.target)) e.preventDefault();
      }}
    >
      <div
        className="protected-watermark pointer-events-none absolute inset-0 z-0 overflow-hidden"
        aria-hidden
      >
        {Array.from({ length: 6 }).map((_, row) =>
          Array.from({ length: 4 }).map((__, col) => (
            <span
              key={`${row}-${col}`}
              className="absolute select-none font-mono text-[0.65rem] tracking-widest text-teal-900/[0.04] rotate-[-24deg]"
              style={{
                top: `${8 + row * 18}%`,
                left: `${-4 + col * 28}%`,
              }}
            >
              {watermark}
            </span>
          ))
        )}
      </div>
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
