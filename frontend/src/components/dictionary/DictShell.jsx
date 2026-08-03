export default function DictShell({ children, className = '', panel = false }) {
  return (
    <main className={`dict-shell relative min-h-screen overflow-x-hidden ${className}`}>
      <div className="dict-atmosphere pointer-events-none absolute inset-0 -z-10 theme-focus-hide" aria-hidden />
      <div className={`relative z-10 w-full ${panel ? 'mx-auto max-w-6xl px-3 pb-8 md:px-6' : ''}`}>
        {panel ? (
          <div className="qp-surface overflow-hidden px-4 py-6 sm:px-6 md:px-8 md:py-8">{children}</div>
        ) : (
          children
        )}
      </div>
    </main>
  );
}
