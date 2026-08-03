import { splitTappableParts, isTappableLemma } from './tappableText';

/**
 * Paragraf: sózler basıladı, qalǵanı oddıy tekst.
 */
export default function TappableParagraph({
  text,
  activeLemma = null,
  onWordTap,
  className = '',
  style,
  paraRef,
  dataPara,
}) {
  const parts = splitTappableParts(text);

  return (
    <p
      ref={paraRef}
      data-para={dataPara}
      className={`whitespace-pre-line leading-relaxed transition-colors ${className}`}
      style={style}
    >
      {parts.map((part, i) => {
        if (!isTappableLemma(part)) {
          return <span key={i}>{part}</span>;
        }
        const active = activeLemma && part.toLocaleLowerCase('kk') === activeLemma.toLocaleLowerCase('kk');
        return (
          <button
            key={i}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onWordTap?.(part, e);
            }}
            className={`rounded-sm border-b border-dotted px-0 py-0 font-inherit transition ${
              active
                ? 'border-teal-600 bg-teal-100/70 text-teal-950'
                : 'border-teal-700/25 text-inherit hover:border-teal-600 hover:bg-teal-50/60'
            }`}
            style={{ font: 'inherit', fontSize: 'inherit', lineHeight: 'inherit' }}
          >
            {part}
          </button>
        );
      })}
    </p>
  );
}
