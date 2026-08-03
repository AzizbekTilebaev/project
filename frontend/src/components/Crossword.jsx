import { useEffect, useMemo, useRef, useState } from 'react';
import { useUiScript } from '../contexts/UiScriptContext';
import { KAA } from '../i18n/kaa';

function wordLength(word) {
  if (word.length != null) return Number(word.length);
  if (word.answer) return String(word.answer).length;
  return 0;
}

function wordAnswer(word) {
  return word.answer ? String(word.answer).toUpperCase() : null;
}

/**
 * Krossvord — katak tańlanadı, sóz kiritiledi, tekseriledi.
 * config: { CrosswordWidth, CrosswordHeight, WordsData: [{ clue, x, y, direction, length?, answer? }] }
 */
export default function Crossword({
  config,
  cellData: controlledCellData,
  onCellDataChange,
  onGuess,
  readOnly = false,
  hideReset = false,
}) {
  const { text } = useUiScript();
  const [currentWord, setCurrentWord] = useState(-1);
  const [wordEntry, setWordEntry] = useState('');
  const [status, setStatus] = useState(null);
  const [internalCellData, setInternalCellData] = useState({});
  const [checking, setChecking] = useState(false);
  const [zoom, setZoom] = useState(() => {
    try {
      const z = Number(localStorage.getItem('cw-grid-zoom'));
      if (Number.isFinite(z) && z >= 0.5 && z <= 2.2) return z;
    } catch {
      /* ignore */
    }
    return 1;
  });
  const wordEntryRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem('cw-grid-zoom', String(zoom));
    } catch {
      /* ignore */
    }
  }, [zoom]);

  const zoomOut = () => setZoom((z) => Math.max(0.5, Math.round((z - 0.15) * 100) / 100));
  const zoomIn = () => setZoom((z) => Math.min(2.2, Math.round((z + 0.15) * 100) / 100));
  const zoomReset = () => setZoom(1);

  const cellData = controlledCellData ?? internalCellData;
  const setCellData = (next) => {
    if (onCellDataChange) onCellDataChange(next);
    else setInternalCellData(next);
  };

  const { CrosswordWidth = 15, CrosswordHeight = 14, WordsData = [] } = config || {};
  const hasLocalAnswers = WordsData.some((w) => w.answer);
  const localMode = !onGuess && hasLocalAnswers;

  const { acrossMap, downMap } = useMemo(() => {
    const across = Array.from({ length: CrosswordWidth }, () => Array(CrosswordHeight).fill(-1));
    const down = Array.from({ length: CrosswordWidth }, () => Array(CrosswordHeight).fill(-1));
    WordsData.forEach((word, index) => {
      const len = wordLength(word);
      const { x, y, direction } = word;
      for (let i = 0; i < len; i++) {
        if (direction === 'across') {
          if (x + i < CrosswordWidth) across[x + i][y] = index;
        } else if (y + i < CrosswordHeight) {
          down[x][y + i] = index;
        }
      }
    });
    return { acrossMap: across, downMap: down };
  }, [CrosswordWidth, CrosswordHeight, WordsData]);

  useEffect(() => {
    if (controlledCellData == null) {
      setInternalCellData({});
    }
    setCurrentWord(-1);
    setWordEntry('');
    setStatus(null);
  }, [config, controlledCellData]);

  const acrossClues = useMemo(
    () =>
      WordsData.map((w, idx) => ({ ...w, idx }))
        .filter((w) => w.direction === 'across')
        .sort((a, b) => a.idx - b.idx),
    [WordsData]
  );
  const downClues = useMemo(
    () =>
      WordsData.map((w, idx) => ({ ...w, idx }))
        .filter((w) => w.direction === 'down')
        .sort((a, b) => a.idx - b.idx),
    [WordsData]
  );

  const activeCellKeys = useMemo(() => {
    if (currentWord < 0 || !WordsData[currentWord]) return new Set();
    const word = WordsData[currentWord];
    const len = wordLength(word);
    return new Set(
      Array.from({ length: len }, (_, i) => {
        const x = word.direction === 'across' ? word.x + i : word.x;
        const y = word.direction === 'across' ? word.y : word.y + i;
        return `${x}-${y}`;
      })
    );
  }, [currentWord, WordsData]);

  if (!config || !WordsData.length) {
    return <p className="text-ink/55 py-10 text-center">{text('Krossvord konfiguratsiyası tabılmadı.')}</p>;
  }

  const getNumber = (x, y) => {
    const nums = [];
    const a = acrossMap[x]?.[y];
    if (a >= 0 && WordsData[a].x === x && WordsData[a].y === y) nums.push(a + 1);
    const d = downMap[x]?.[y];
    if (d >= 0 && WordsData[d].x === x && WordsData[d].y === y) nums.push(d + 1);
    if (!nums.length) return null;
    return nums.join('/');
  };

  const wordCells = (word) => {
    const len = wordLength(word);
    return Array.from({ length: len }, (_, i) => ({
      x: word.direction === 'across' ? word.x + i : word.x,
      y: word.direction === 'across' ? word.y : word.y + i,
    }));
  };

  const isWordSolved = (word, data) => {
    const cells = wordCells(word);
    const filled = cells.map(({ x, y }) => data[`${x}-${y}`] || '').join('');
    const expected = wordAnswer(word);
    if (expected) return filled === expected;
    return filled.length === cells.length && cells.every(({ x, y }) => data[`${x}-${y}`]);
  };

  const solvedCount = WordsData.filter((w) => isWordSolved(w, cellData)).length;

  const selectWord = (idx) => {
    if (readOnly) return;
    setCurrentWord(idx);
    setWordEntry('');
    setStatus(null);
    setTimeout(() => wordEntryRef.current?.focus(), 60);
  };

  const handleCellClick = (x, y) => {
    if (readOnly) return;
    const across = acrossMap[x]?.[y];
    const down = downMap[x]?.[y];
    if (across < 0 && down < 0) return;
    if (across >= 0 && down >= 0 && currentWord === across) selectWord(down);
    else selectWord(across >= 0 ? across : down);
  };

  const fillWord = (word, answer, base) => {
    const next = { ...base };
    const letters = String(answer).toUpperCase();
    wordCells(word).forEach(({ x, y }, i) => {
      next[`${x}-${y}`] = letters[i] || '';
    });
    return next;
  };

  const handleSubmit = async () => {
    if (readOnly || currentWord < 0 || checking) return;
    const word = WordsData[currentWord];
    const len = wordLength(word);
    const answer = wordEntry.trim().replace(/\s+/g, '');
    if (!answer) {
      setStatus({ type: 'error', text: 'Sóz kiritiń' });
      return;
    }
    // Server soft grade: latin/cyr digraph length farq etedi — exact len talap etilmeydi.
    if (!onGuess && answer.length !== len) {
      setStatus({ type: 'error', text: `${len} hárip kerek` });
      return;
    }

    if (onGuess) {
      setChecking(true);
      try {
        const result = await onGuess({ wordIndex: currentWord, answer });
        if (result?.blocked) {
          setStatus({ type: 'error', text: text(KAA.guestCrosswordBlocked) });
          return;
        }
        if (result?.correct) {
          const fill = String(result.fillAnswer || answer)
            .trim()
            .replace(/\s+/g, '')
            .toUpperCase();
          const next = fillWord(word, fill, cellData);
          setCellData(next);
          setWordEntry('');
          const allDone = WordsData.every((w) => isWordSolved(w, next));
          setStatus(
            allDone
              ? { type: 'done', text: 'Qutlıqlaymız! Barlıq sózler durıs!' }
              : {
                  type: 'ok',
                  text: result.nearMiss ? KAA.crosswordNearMiss : KAA.tutorCorrectMsg,
                }
          );
        } else {
          setStatus({ type: 'error', text: 'Qáte bar — jáne urınıp kóriń' });
        }
      } catch (err) {
        setStatus({ type: 'error', text: err.message || 'Tekseriw qáteligi' });
      } finally {
        setChecking(false);
      }
      return;
    }

    if (!localMode) {
      setStatus({ type: 'error', text: 'Tekseriw server arqalı ǵana múmkin' });
      return;
    }

    const next = fillWord(word, answer.toUpperCase(), cellData);
    setCellData(next);
    setWordEntry('');

    const correct = answer.toUpperCase() === wordAnswer(word);
    const allDone = WordsData.every((w) => isWordSolved(w, next));
    if (allDone) {
      setStatus({ type: 'done', text: 'Qutlıqlaymız! Barlıq sózler durıs!' });
    } else {
      setStatus(
        correct
          ? { type: 'ok', text: 'Durıs!' }
          : { type: 'error', text: 'Qáte bar — jáne urınıp kóriń' }
      );
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      <div className="flex-1 min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/40">
            {text('Maydan')}
          </p>
          <div
            className="inline-flex items-center gap-1 rounded-full border border-ink/10 bg-white/70 p-1 shadow-sm"
            role="group"
            aria-label={text('Grid ólshemi')}
          >
            <button
              type="button"
              onClick={zoomOut}
              disabled={zoom <= 0.5}
              className="flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold text-ink/70 transition hover:bg-teal-50 hover:text-teal-900 disabled:opacity-35"
              aria-label={text('Kichireytiw')}
              title={text('Kichireytiw')}
            >
              −
            </button>
            <button
              type="button"
              onClick={zoomReset}
              className="min-w-[3.25rem] rounded-full px-2 py-1 text-xs font-bold tabular-nums text-teal-950 hover:bg-teal-50"
              aria-label={text('Ádettegi ólskem')}
              title={text('Ádettegi ólskem')}
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={zoomIn}
              disabled={zoom >= 2.2}
              className="flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold text-ink/70 transition hover:bg-teal-50 hover:text-teal-900 disabled:opacity-35"
              aria-label={text('Úlkenletiw')}
              title={text('Úlkenletiw')}
            >
              +
            </button>
          </div>
        </div>

        <div className="overflow-auto max-h-[min(75vh,720px)] rounded-xl border border-ink/5 bg-white/30 p-2 md:p-3">
          <div className="sr-only" aria-live="polite">
            {status?.text ? text(status.text) : ''}
          </div>
          <div className="mx-auto w-max" style={{ zoom }}>
            <table
              className="border-collapse select-none"
              role="grid"
              aria-label={text('Krossvord maydanı')}
            >
              <tbody>
                {Array.from({ length: CrosswordHeight }, (_, y) => (
                  <tr key={y}>
                    {Array.from({ length: CrosswordWidth }, (_, x) => {
                      const key = `${x}-${y}`;
                      const val = cellData[key] || '';
                      const num = getNumber(x, y);
                      const isCell = acrossMap[x]?.[y] >= 0 || downMap[x]?.[y] >= 0;
                      if (!isCell) {
                        return <td key={key} className="w-10 h-10 md:w-11 md:h-11" aria-hidden />;
                      }
                      const active = activeCellKeys.has(key);
                      const acrossIdx = acrossMap[x]?.[y];
                      const downIdx = downMap[x]?.[y];
                      const labelParts = [];
                      if (num) labelParts.push(`№${num}`);
                      if (acrossIdx >= 0) labelParts.push(text('gorizontal'));
                      if (downIdx >= 0) labelParts.push(text('vertikal'));
                      labelParts.push(text(`qator ${y + 1}, ustun ${x + 1}`));
                      if (val) labelParts.push(text(`hárip ${val}`));
                      return (
                        <td
                          key={key}
                          className={`w-10 h-10 md:w-11 md:h-11 p-0 border ${
                            active ? 'border-teal-700' : 'border-ink/25'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleCellClick(x, y)}
                            disabled={readOnly}
                            aria-label={labelParts.join(', ')}
                            aria-pressed={active}
                            className={`w-full h-full font-display text-lg md:text-xl uppercase relative transition-colors ${
                              active
                                ? 'bg-teal-900/10'
                                : 'bg-white/70 hover:bg-teal-900/5'
                            } ${readOnly ? 'cursor-default' : ''}`}
                          >
                            {num && (
                              <span className="absolute top-0 left-1 text-[9px] font-sans text-ink/50">
                                {num}
                              </span>
                            )}
                            {val}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="lg:w-96 shrink-0 flex flex-col gap-5">
        <div className="flex items-center justify-between text-sm text-ink/55">
          <span>
            {text(`${solvedCount} / ${WordsData.length} sóz shesildi`)}
          </span>
          {!hideReset && !readOnly && solvedCount > 0 && solvedCount < WordsData.length && localMode && (
            <button
              type="button"
              onClick={() => {
                setCellData({});
                setStatus(null);
                setCurrentWord(-1);
              }}
              className="underline underline-offset-4 hover:text-ink"
            >
              {text('Tazalaw')}
            </button>
          )}
        </div>
        <div className="h-1.5 rounded-full bg-ink/10 overflow-hidden">
          <div
            className="h-full bg-teal-800 transition-all duration-500"
            style={{ width: `${(solvedCount / WordsData.length) * 100}%` }}
          />
        </div>

        {!readOnly && currentWord >= 0 ? (
          <div className="rounded-2xl border border-teal-800/15 bg-white/50 p-5">
            <p className="text-[0.65rem] uppercase tracking-[0.18em] text-teal-800/80 mb-1">
              {text(WordsData[currentWord].direction === 'across' ? 'Gorizontal' : 'Vertikal')} ·{' '}
              {text(`${currentWord + 1}-sóz`)} · {text(`${wordLength(WordsData[currentWord])} hárip`)}
            </p>
            <p className="text-ink/80 leading-relaxed mb-4">{text(WordsData[currentWord].clue)}</p>
            <input
              ref={wordEntryRef}
              type="text"
              maxLength={
                onGuess
                  ? Math.max(wordLength(WordsData[currentWord]) * 2, 24)
                  : wordLength(WordsData[currentWord])
              }
              value={wordEntry}
              onChange={(e) => setWordEntry(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              disabled={checking}
              className="w-full px-4 py-3 border-b-2 border-ink/20 bg-transparent text-ink text-xl uppercase text-center tracking-[0.2em] focus:outline-none focus:border-teal-700 transition-colors mb-4"
              placeholder={text('Juwap...')}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={checking}
              className="w-full px-6 py-3 bg-teal-900 text-parchment text-sm font-semibold tracking-wide uppercase hover:bg-teal-950 transition-colors disabled:opacity-50"
            >
              {checking ? text('Tekserilip atır...') : text('Tekseriw')}
            </button>
          </div>
        ) : !readOnly ? (
          <p className="rounded-2xl border border-dashed border-ink/15 text-ink/55 text-center px-5 py-8">
            {text('Katakti saylań — sonda soraw shıǵadı')}
          </p>
        ) : null}

        {status && (
          <p
            className={`text-center font-medium ${
              status.type === 'error'
                ? 'text-red-800/80'
                : status.type === 'done'
                  ? 'font-display text-xl text-teal-900'
                  : 'text-teal-900'
            }`}
          >
            {text(status.text)}
          </p>
        )}

        <div className="space-y-5">
          {[
            ['across', 'Gorizontal', acrossClues],
            ['down', 'Vertikal', downClues],
          ].map(([dir, label, list]) =>
            list.length ? (
              <div key={dir}>
                <p className="text-[0.65rem] uppercase tracking-[0.18em] text-ink/55 mb-2">
                  {text(label)}
                </p>
                <ul className="space-y-1.5">
                  {list.map((w) => (
                    <li key={w.idx}>
                      <button
                        type="button"
                        onClick={() => selectWord(w.idx)}
                        disabled={readOnly}
                        className={`text-left text-sm leading-relaxed transition-colors ${
                          isWordSolved(w, cellData)
                            ? 'text-ink/40 line-through'
                            : currentWord === w.idx
                              ? 'text-teal-900 font-semibold'
                              : 'text-ink/70 hover:text-ink'
                        }`}
                      >
                        {w.idx + 1}. {text(w.clue)}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null
          )}
        </div>
      </div>
    </div>
  );
}
