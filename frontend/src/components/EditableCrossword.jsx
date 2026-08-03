import { useMemo, useState } from 'react';
import { useUiScript } from '../contexts/UiScriptContext';

const MAX_GRID = 30;

/** Admin format: { answer, clue, x, y, direction: 'across'|'down' } */
export function toEditorWords(adminWords = []) {
  return (adminWords || []).map((w, i) => ({
    id: i + 1,
    text: String(w.answer || w.text || '').toUpperCase(),
    clue: w.clue || '',
    x: Number(w.x) || 0,
    y: Number(w.y) || 0,
    direction:
      w.direction === 'down' || w.direction === 'vertical' ? 'vertical' : 'horizontal',
  }));
}

export function toAdminWords(editorWords = []) {
  return (editorWords || []).map((w) => ({
    answer: String(w.text || w.answer || '').toUpperCase(),
    clue: w.clue || '',
    x: Number(w.x) || 0,
    y: Number(w.y) || 0,
    direction: w.direction === 'vertical' || w.direction === 'down' ? 'down' : 'across',
  }));
}

function buildGrid(wordsList) {
  const newGrid = Array(MAX_GRID)
    .fill()
    .map(() => Array(MAX_GRID).fill(''));
  wordsList.forEach((w) => {
    const len = w.text.length;
    for (let i = 0; i < len; i++) {
      const cx = w.direction === 'horizontal' ? w.x + i : w.x;
      const cy = w.direction === 'horizontal' ? w.y : w.y + i;
      if (cy >= 0 && cy < MAX_GRID && cx >= 0 && cx < MAX_GRID) {
        newGrid[cy][cx] = w.text[i];
      }
    }
  });
  return newGrid;
}

function getStartsAndNumbers(wordsList) {
  const starts = new Map();
  wordsList.forEach((w) => {
    const pos = `${w.y},${w.x}`;
    if (!starts.has(pos)) starts.set(pos, true);
  });
  const sortedStarts = Array.from(starts.keys()).sort((a, b) => {
    const [ya, xa] = a.split(',').map(Number);
    const [yb, xb] = b.split(',').map(Number);
    return ya - yb || xa - xb;
  });
  const numbers = new Map();
  sortedStarts.forEach((pos, i) => numbers.set(pos, i + 1));
  return numbers;
}

/**
 * Controlled visual crossword editor.
 * @param {{ words?: object[], onChange?: (adminWords: object[]) => void, compact?: boolean }} props
 */
export default function EditableCrossword({ words: controlledWords, onChange, compact = false } = {}) {
  const { text } = useUiScript();
  const isControlled = typeof onChange === 'function';

  const [internalWords, setInternalWords] = useState([]);
  const editorWords = isControlled
    ? toEditorWords(controlledWords)
    : internalWords;

  const emit = (nextEditor) => {
    if (isControlled) {
      onChange(toAdminWords(nextEditor));
    } else {
      setInternalWords(nextEditor);
    }
  };

  const [newWordText, setNewWordText] = useState('');
  const [newClue, setNewClue] = useState('');
  const [newX, setNewX] = useState('');
  const [newY, setNewY] = useState('');
  const [newDirection, setNewDirection] = useState('horizontal');
  const [err, setErr] = useState('');

  const grid = useMemo(() => buildGrid(editorWords), [editorWords]);
  const numbers = useMemo(() => getStartsAndNumbers(editorWords), [editorWords]);

  const bounds = useMemo(() => {
    if (editorWords.length === 0) {
      return { minX: 0, maxX: 14, minY: 0, maxY: 14 };
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    editorWords.forEach((w) => {
      const len = w.text.length;
      if (w.direction === 'horizontal') {
        minX = Math.min(minX, w.x);
        maxX = Math.max(maxX, w.x + len - 1);
        minY = Math.min(minY, w.y);
        maxY = Math.max(maxY, w.y);
      } else {
        minX = Math.min(minX, w.x);
        maxX = Math.max(maxX, w.x);
        minY = Math.min(minY, w.y);
        maxY = Math.max(maxY, w.y + len - 1);
      }
    });
    return {
      minX: Math.max(0, minX),
      maxX,
      minY: Math.max(0, minY),
      maxY,
    };
  }, [editorWords]);

  const visibleWidth = Math.max(1, bounds.maxX - bounds.minX + 1);
  const visibleHeight = Math.max(1, bounds.maxY - bounds.minY + 1);

  const getNumber = (w) => numbers.get(`${w.y},${w.x}`);

  const addWord = () => {
    setErr('');
    if (!newWordText.trim() || !newClue.trim() || newX === '' || newY === '') {
      setErr(text('Barlıq maydanlardı toltırıń!'));
      return;
    }
    const word = newWordText.trim().toUpperCase();
    const x = Number(newX);
    const y = Number(newY);
    const len = word.length;
    if (Number.isNaN(x) || Number.isNaN(y) || x < 0 || y < 0) return;
    if (
      x + (newDirection === 'horizontal' ? len : 0) > MAX_GRID ||
      y + (newDirection === 'vertical' ? len : 0) > MAX_GRID
    ) {
      setErr(text('Sóz tor shegarasınan shıǵıp ketedi!'));
      return;
    }
    for (let i = 0; i < len; i++) {
      const cx = newDirection === 'horizontal' ? x + i : x;
      const cy = newDirection === 'horizontal' ? y : y + i;
      if (grid[cy][cx] !== '' && grid[cy][cx] !== word[i]) {
        setErr(text('Bul jerde basqa sóz penen toqnasıw bar!'));
        return;
      }
    }
    const next = [
      ...editorWords,
      {
        id: editorWords.length + 1,
        text: word,
        clue: newClue.trim(),
        x,
        y,
        direction: newDirection,
      },
    ];
    emit(next);
    setNewWordText('');
    setNewClue('');
    setNewX('');
    setNewY('');
  };

  const removeWord = (wordId) => {
    emit(editorWords.filter((w) => w.id !== wordId).map((w, i) => ({ ...w, id: i + 1 })));
  };

  const acrossWords = useMemo(() => {
    return editorWords
      .filter((w) => w.direction === 'horizontal')
      .sort(
        (a, b) =>
          (numbers.get(`${a.y},${a.x}`) || 0) - (numbers.get(`${b.y},${b.x}`) || 0)
      );
  }, [editorWords, numbers]);

  const downWords = useMemo(() => {
    return editorWords
      .filter((w) => w.direction === 'vertical')
      .sort(
        (a, b) =>
          (numbers.get(`${a.y},${a.x}`) || 0) - (numbers.get(`${b.y},${b.x}`) || 0)
      );
  }, [editorWords, numbers]);

  return (
    <div className={compact ? 'p-2' : 'p-6 max-w-7xl mx-auto'}>
      {!compact ? (
        <h1 className="mb-6 text-center text-2xl font-bold text-ink">
          {text('Vizual krossvord redaktorı')}
        </h1>
      ) : null}

      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="flex-1 overflow-x-auto">
          <h2 className="mb-3 text-lg font-semibold text-ink">{text('Krossvord maydanı')}</h2>
          <div className="inline-block border border-ink/20 bg-white shadow-sm">
            <table className="border-collapse">
              <thead>
                <tr>
                  <th className="h-8 w-8 border border-ink/15 bg-ink/[0.04]" />
                  {Array.from({ length: visibleWidth }, (_, dx) => {
                    const realX = bounds.minX + dx;
                    return (
                      <th
                        key={dx}
                        className="h-8 w-8 border border-ink/15 bg-ink/[0.06] text-center text-[0.65rem] font-bold"
                      >
                        x{realX}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: visibleHeight }, (_, dy) => {
                  const realY = bounds.minY + dy;
                  return (
                    <tr key={dy}>
                      <th className="h-8 w-8 border border-ink/15 bg-ink/[0.06] text-center text-[0.65rem] font-bold">
                        y{realY}
                      </th>
                      {Array.from({ length: visibleWidth }, (_, dx) => {
                        const realX = bounds.minX + dx;
                        const cell = grid[realY]?.[realX] || '';
                        const cellNumber = numbers.get(`${realY},${realX}`);
                        return (
                          <td
                            key={`${realX}-${realY}`}
                            className="relative h-8 w-8 border border-ink/25 bg-white text-center text-sm font-bold uppercase sm:h-9 sm:w-9 sm:text-base"
                          >
                            {cellNumber ? (
                              <span className="absolute left-0.5 top-0 text-[0.55rem] font-normal leading-none text-ink/50">
                                {cellNumber}
                              </span>
                            ) : null}
                            {cell}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:w-96">
          <h2 className="mb-3 text-lg font-semibold text-ink">{text('Jańa sóz qosıw')}</h2>
          <div className="space-y-3">
            <input
              type="text"
              value={newWordText}
              onChange={(e) => setNewWordText(e.target.value)}
              placeholder={text('Sóz')}
              className="w-full rounded-xl border border-ink/15 px-3 py-2 text-sm uppercase"
            />
            <input
              type="text"
              value={newClue}
              onChange={(e) => setNewClue(e.target.value)}
              placeholder={text('Kórsetpe')}
              className="w-full rounded-xl border border-ink/15 px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                min="0"
                max={MAX_GRID - 1}
                value={newX}
                onChange={(e) => setNewX(e.target.value)}
                placeholder="X"
                aria-label="X"
                className="rounded-xl border border-ink/15 px-3 py-2 text-sm"
              />
              <input
                type="number"
                min="0"
                max={MAX_GRID - 1}
                value={newY}
                onChange={(e) => setNewY(e.target.value)}
                placeholder="Y"
                aria-label="Y"
                className="rounded-xl border border-ink/15 px-3 py-2 text-sm"
              />
              <select
                value={newDirection}
                onChange={(e) => setNewDirection(e.target.value)}
                className="rounded-xl border border-ink/15 px-2 py-2 text-sm"
                aria-label={text('Baǵıt')}
              >
                <option value="horizontal">{text('→')}</option>
                <option value="vertical">{text('↓')}</option>
              </select>
            </div>
            {err ? <p className="text-xs text-rose-700">{text(err)}</p> : null}
            <button
              type="button"
              onClick={addWord}
              className="w-full rounded-full bg-teal-800 py-2.5 text-sm font-semibold text-white"
            >
              {text('Sóz qosıw')}
            </button>
          </div>

          {editorWords.length > 0 ? (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-semibold text-ink/70">
                {text('Qosılǵan sózler')} ({editorWords.length})
              </h3>
              <ul className="max-h-64 space-y-2 overflow-y-auto">
                {editorWords.map((w) => (
                  <li
                    key={w.id}
                    className="flex items-start justify-between gap-2 rounded-xl border border-ink/10 bg-white/80 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">
                        {getNumber(w)}. {w.direction === 'horizontal' ? '→' : '↓'} {w.text}
                      </p>
                      <p className="truncate text-xs text-ink/45">
                        x{w.x} y{w.y} · {text(w.clue)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeWord(w.id)}
                      className="shrink-0 text-xs font-semibold text-rose-700"
                    >
                      {text('Óshiriw')}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {editorWords.length > 0 ? (
            <div className="mt-6 space-y-3 text-sm">
              <div>
                <h4 className="mb-1 font-semibold text-ink/70">{text('Gorizontal')}</h4>
                {acrossWords.map((w) => (
                  <p key={w.id} className="text-ink/60">
                    {getNumber(w)}. {text(w.clue)}
                  </p>
                ))}
              </div>
              <div>
                <h4 className="mb-1 font-semibold text-ink/70">{text('Vertikal')}</h4>
                {downWords.map((w) => (
                  <p key={w.id} className="text-ink/60">
                    {getNumber(w)}. {text(w.clue)}
                  </p>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
