import { useMemo } from 'react';
import { useUiScript } from '../contexts/UiScriptContext';

function toDayKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function ActivityHeatmap({ days = [], weeks = 13 }) {
  const { text } = useUiScript();
  const map = useMemo(() => {
    const m = new Map();
    for (const row of days || []) {
      m.set(row.day, Number(row.count) || 0);
    }
    return m;
  }, [days]);

  const grid = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const total = weeks * 7;
    const start = new Date(today);
    start.setDate(start.getDate() - (total - 1));
    // Align to Monday-ish columns: start from Sunday of that week for github-like
    const dow = start.getDay();
    start.setDate(start.getDate() - dow);

    const cells = [];
    const cursor = new Date(start);
    const endPad = new Date(today);
    endPad.setDate(endPad.getDate() + (6 - endPad.getDay()));
    while (cursor <= endPad) {
      const key = toDayKey(cursor);
      const count = map.get(key) || 0;
      const future = cursor > today;
      cells.push({ key, count, future, date: new Date(cursor) });
      cursor.setDate(cursor.getDate() + 1);
    }
    return cells;
  }, [map, weeks]);

  const max = Math.max(1, ...grid.map((c) => c.count));

  const level = (count) => {
    if (!count) return 0;
    const r = count / max;
    if (r > 0.75) return 4;
    if (r > 0.5) return 3;
    if (r > 0.25) return 2;
    return 1;
  };

  const cols = [];
  for (let i = 0; i < grid.length; i += 7) cols.push(grid.slice(i, i + 7));

  return (
    <div>
      <p className="mb-3 text-[0.7rem] uppercase tracking-[0.18em] text-ink/40">
        {text('Faollıq xaritasi')}
      </p>
      <div className="overflow-x-auto pb-2">
        <div className="inline-flex gap-1">
          {cols.map((col, ci) => (
            <div key={ci} className="flex flex-col gap-1">
              {col.map((cell) => (
                <span
                  key={cell.key}
                  title={`${cell.key}: ${cell.count}`}
                  className={`h-3 w-3 rounded-sm ${
                    cell.future
                      ? 'bg-transparent'
                      : [
                          'bg-ink/[0.06]',
                          'bg-teal-200',
                          'bg-teal-400',
                          'bg-teal-600',
                          'bg-teal-800',
                        ][level(cell.count)]
                  }`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 text-xs text-ink/40">{text('Sońǵı aylardaǵı kúnlik kiriwler')}</p>
    </div>
  );
}
