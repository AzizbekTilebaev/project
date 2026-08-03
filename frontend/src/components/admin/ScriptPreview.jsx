import { toCyrillic, toLatin } from '../../utils/qqScript';

/**
 * Admin formalarda jonli lotin ↔ kirill ko‘rinishi.
 * Bir maydonga yoziladi — ikkala alifboda bir zumda ko‘rinadi.
 */
export default function ScriptPreview({ value, label = 'Alifba kórinisi', multiline = false }) {
  const raw = String(value || '');
  const latin = toLatin(raw);
  const cyrillic = toCyrillic(raw);
  if (!raw.trim()) return null;

  const Box = multiline ? 'pre' : 'p';

  return (
    <div className="rounded-2xl border border-teal-900/10 bg-gradient-to-br from-teal-50/80 to-white p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-900/45">
        {label}
      </p>
      <div className={`grid gap-2 ${multiline ? '' : 'sm:grid-cols-2'}`}>
        <div className="rounded-xl bg-white/80 px-3 py-2 ring-1 ring-ink/5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink/35">Latın</span>
          <Box className={`mt-1 whitespace-pre-wrap text-sm text-ink ${multiline ? 'max-h-40 overflow-auto font-serif leading-relaxed' : 'font-medium'}`}>
            {latin}
          </Box>
        </div>
        <div className="rounded-xl bg-white/80 px-3 py-2 ring-1 ring-ink/5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink/35">Kirill</span>
          <Box className={`mt-1 whitespace-pre-wrap text-sm text-ink ${multiline ? 'max-h-40 overflow-auto font-serif leading-relaxed' : 'font-medium'}`}>
            {cyrillic}
          </Box>
        </div>
      </div>
    </div>
  );
}
