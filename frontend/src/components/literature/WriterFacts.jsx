import { MONTHS, t } from './litLabels';

function formatBirthDay(writer, script) {
  const day = writer?.birthDay;
  const month = writer?.birthMonth;
  const year = writer?.birthYear;
  if (!year && !month && !day) return null;
  const months = MONTHS[script === 'latin' ? 'latin' : 'cyrillic'];
  const parts = [];
  if (day) parts.push(String(day));
  if (month && months[month]) parts.push(months[month]);
  else if (month) parts.push(String(month));
  if (year) parts.push(String(year));
  return parts.join(' ');
}

function FactRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl border border-ink/[0.06] bg-white/70 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-ink/40">{label}</dt>
      <dd className="text-sm font-semibold text-ink sm:text-right">{value}</dd>
    </div>
  );
}

/** Strukturavıy bio faktlar paneli (ikki alifbo). */
export default function WriterFacts({ writer, script = 'cyrillic' }) {
  if (!writer) return null;
  const birthFormatted = formatBirthDay(writer, script);
  const birthYear =
    writer.birthYear ||
    (writer.lifeSpan ? Number(String(writer.lifeSpan).match(/\d{4}/)?.[0]) || null : null);
  const deathYear =
    writer.deathYear ||
    (writer.lifeSpan
      ? Number(String(writer.lifeSpan).match(/\d{4}\D+(\d{4})/)?.[1]) || null
      : null);
  const age = birthYear && deathYear ? deathYear - birthYear : null;
  const lifeYears = birthYear
    ? `${birthYear}–${deathYear || '…'}${age ? ` (${age} ${t('livedYears', script)})` : ''}`
    : writer.lifeSpan || null;

  if (!birthFormatted && !lifeYears) return null;

  return (
    <section className="mt-6" aria-label={t('facts', script)}>
      <h2 className="mb-3 font-display text-xl tracking-tight text-ink">{t('facts', script)}</h2>
      <dl className="grid gap-2">
        <FactRow label={t('birthDay', script)} value={birthFormatted} />
        <FactRow label={t('deathYear', script)} value={deathYear ? String(deathYear) : null} />
        <FactRow label={t('lifeYears', script)} value={lifeYears} />
      </dl>
    </section>
  );
}
