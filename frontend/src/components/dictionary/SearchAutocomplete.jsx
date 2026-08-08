import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchWords } from '../../api/tusindirme';
import Icon from '../Icon';
import { useUiScript } from '../../contexts/UiScriptContext';

/**
 * Jonli qidiruv maydoni — yozayotganda takliflar chiqadi.
 * Enter/klik → so'z sahifasi; bo'sh yoki tugma → to'liq izlew sahifasi.
 */
export default function SearchAutocomplete({
  placeholder = 'Sóz jazıń... (latın yamasa kirill)',
  buttonLabel = 'Izlew',
  autoFocus = false,
}) {
  const navigate = useNavigate();
  const { text } = useUiScript();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ searchType: null, message: null });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    const q = query.trim();
    clearTimeout(debounceRef.current);
    abortRef.current?.abort();
    const reqId = ++reqIdRef.current;
    if (q.length < 1) {
      setItems([]);
      setMeta({ searchType: null, message: null });
      setOpen(false);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await searchWords(q, 8, { signal: controller.signal });
        if (reqId !== reqIdRef.current) return;
        const list = (res.data?.length ? res.data : res.suggestions) || [];
        setItems(list.slice(0, 8));
        setMeta({
          searchType: res.searchType || null,
          message: res.message || null,
        });
        setOpen(true);
        setActive(-1);
      } catch (err) {
        if (err.name === 'AbortError') return;
        if (reqId === reqIdRef.current) {
          setItems([]);
          setMeta({ searchType: null, message: null });
        }
      } finally {
        if (reqId === reqIdRef.current) setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(debounceRef.current);
    };
  }, [query]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const goToFull = () => {
    const q = query.trim();
    setOpen(false);
    navigate(q ? `/dictionary/all?q=${encodeURIComponent(q)}` : '/dictionary/all');
  };

  const goToWord = (id) => {
    setOpen(false);
    navigate(`/dictionary/${id}`);
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (open && active >= 0 && items[active]) goToWord(items[active].id);
    else goToFull();
  };

  const onKeyDown = (e) => {
    if (!open || !items.length) {
      if (e.key === 'ArrowDown' && items.length) setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const hint =
    meta.message ||
    (meta.searchType === 'fuzzy'
      ? 'Anıq sáykes joq — uqsas sózler:'
      : meta.searchType === 'no_match'
        ? 'Hesh nárse tabılmadı — uqsas sózler:'
        : meta.searchType === 'description'
          ? 'Taʼrif boyınsha tabıldı:'
          : null);
  const showFuzzyBadge = meta.searchType === 'fuzzy' || meta.searchType === 'no_match';

  return (
    <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-3">
      <div ref={boxRef} className="relative flex-1">
        <label className="relative block">
          <span className="sr-only">{text('Sóz izlew')}</span>
          <Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/40 text-xl" />
          <input
            type="search"
            value={query}
            autoFocus={autoFocus}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => (items.length || loading) && setOpen(true)}
            placeholder={text(placeholder)}
            className="w-full pl-12 pr-10 py-4 border-b-2 border-ink/20 bg-transparent text-ink text-lg placeholder:text-ink/35 focus:outline-none focus:border-teal-700"
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            aria-controls="search-autocomplete-list"
            aria-activedescendant={
              open && active >= 0 ? `search-option-${active}` : undefined
            }
          />
          {loading && (
            <Icon name="loader" className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-ink/40 text-lg" />
          )}
        </label>

        {open && (items.length > 0 || (!loading && query.trim().length > 0)) && (
          <ul
            id="search-autocomplete-list"
            className="absolute z-30 left-0 right-0 mt-1 max-h-80 overflow-auto rounded-b-xl border border-ink/10 bg-parchment shadow-[0_24px_60px_-20px_rgba(15,92,86,0.65)]"
            role="listbox"
          >
            {hint && items.length > 0 && (
              <li className="px-4 pt-3 pb-1.5 text-[0.65rem] uppercase tracking-[0.16em] text-ink/40">
                {text(hint)}
              </li>
            )}
            {!loading && items.length === 0 && (
              <li className="px-4 py-4 text-sm text-ink/55">
                <p className="mb-2">
                  {text('Hesh nárse tabılmadı. Boshqa yozıwın sınap kóriń yamasa toʻliq izlewge ótiń.')}
                </p>
                <button
                  type="button"
                  className="text-xs font-bold text-teal-900 underline underline-offset-2 hover:text-teal-700"
                  onClick={() => {
                    setOpen(false);
                    navigate(`/dictionary/all?q=${encodeURIComponent(query.trim())}`);
                  }}
                >
                  {text('Toʻliq izlew sahifası')}
                </button>
              </li>
            )}
            {items.map((item, idx) => (
              <li
                key={item.id}
                id={`search-option-${idx}`}
                role="option"
                aria-selected={idx === active}
              >
                <button
                  type="button"
                  onMouseEnter={() => setActive(idx)}
                  onClick={() => goToWord(item.id)}
                  className={`w-full text-left px-4 py-3 flex items-baseline gap-3 transition-colors ${
                    idx === active ? 'bg-teal-900 text-parchment' : 'hover:bg-teal-900/5'
                  }`}
                >
                  <span className="font-display text-lg tracking-tight shrink-0">
                    {text(item.soz)}
                  </span>
                  {showFuzzyBadge && item.fuzzyDistance != null && (
                    <span
                      className={`text-[0.65rem] uppercase tracking-wider shrink-0 ${
                        idx === active ? 'text-parchment/60' : 'text-teal-800/70'
                      }`}
                    >
                      {text('uqsas')}
                    </span>
                  )}
                  {item.birinshi_aniqlama && (
                    <span
                      className={`text-sm truncate ${
                        idx === active ? 'text-parchment/70' : 'text-ink/45'
                      }`}
                    >
                      {text(item.birinshi_aniqlama)}
                    </span>
                  )}
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={goToFull}
                className="w-full text-left px-4 py-2.5 text-sm text-teal-800 hover:bg-teal-900/5 border-t border-ink/10 flex items-center gap-2"
              >
                <Icon name="search" />
                «{text(query.trim())}» {text('boyınsha barlıq nátiyjeler')}
              </button>
            </li>
          </ul>
        )}
      </div>

      <button
        type="submit"
        className="px-7 py-4 bg-teal-900 text-parchment text-sm font-semibold tracking-wide uppercase hover:bg-teal-950 transition-colors"
      >
        {text(buttonLabel)}
      </button>
    </form>
  );
}
