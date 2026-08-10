import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import CommunitySuggestionRow from './CommunitySuggestionRow';
import { createSuggestion, fetchSuggestions } from '../api/tusindirme';
import { useUiScript } from '../contexts/UiScriptContext';
import { KAA } from '../i18n/kaa';
import { AnimChevron } from '../animations';

/**
 * WordDetail — sinonim / antonim / qurma usınısı + vote (server counts).
 * Ádette jabıq: kishi "Úles qosamıź" tipinde ashiladı.
 */
export default function CommunitySuggestPanel({ word, defaultOpen = false }) {
  const { text } = useUiScript();
  const senses = Array.isArray(word?.aniqlamalar) ? word.aniqlamalar : [];
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const [type, setType] = useState('synonym');
  const [descriptionId, setDescriptionId] = useState(senses[0]?.id || '');
  const [suggestedWord, setSuggestedWord] = useState('');
  const [pending, setPending] = useState([]);
  const [msg, setMsg] = useState('');
  const [msgTone, setMsgTone] = useState('ok');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDescriptionId(senses[0]?.id || '');
  }, [word?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchSuggestions({
          descriptionId: type === 'compound' ? undefined : descriptionId || undefined,
          mainTitleId: type === 'compound' ? word.id : undefined,
        });
        if (!cancelled) setPending(data.suggestions || []);
      } catch {
        if (!cancelled) setPending([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, word?.id, descriptionId, type]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      await createSuggestion({
        suggestionType: type,
        suggestedWord: suggestedWord.trim(),
        descriptionId: type === 'compound' ? undefined : descriptionId,
        mainTitleId: type === 'compound' ? word.id : undefined,
      });
      setSuggestedWord('');
      setMsgTone('ok');
      setMsg(text(KAA.jamiyetSubmitted));
      const data = await fetchSuggestions({
        descriptionId: type === 'compound' ? undefined : descriptionId || undefined,
        mainTitleId: type === 'compound' ? word.id : undefined,
      });
      setPending(data.suggestions || []);
    } catch (err) {
      setMsgTone('err');
      setMsg(err.message || 'Usınıs jiberiw múmkin bolmadı.');
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <aside className="mt-12 border-t border-dashed border-ink/10 pt-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm font-semibold text-sky-700 hover:text-sky-900 hover:underline underline-offset-4 transition-colors"
        >
          {text(KAA.jamiyetUlesQosamiz)}
        </button>
        <p className="mt-1 text-[0.7rem] text-ink/35">{text(KAA.jamiyetPanelEyebrow)}</p>
      </aside>
    );
  }

  return (
    <aside className="relative mt-12 overflow-hidden rounded-3xl border border-teal-500/15 bg-gradient-to-br from-teal-50/80 via-white/60 to-sky-50/70 px-6 py-7">
      <div
        className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-teal-400/15 blur-3xl"
        aria-hidden
      />
      <div className="relative mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow-lg shadow-teal-900/25">
            <Icon name="users" className="text-xl" />
          </span>
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.2em] text-teal-700/70">
              {text(KAA.jamiyetPanelEyebrow)}
            </p>
            <h2 className="font-display text-2xl tracking-tight text-ink">
              {text(KAA.jamiyetPanelTitle)}
            </h2>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-xs font-bold text-sky-700 hover:underline"
          >
            {text(KAA.jamiyetUlesYopiw)}
          </button>
          <Link
            to="/community"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-900/70 hover:underline"
          >
            {text(KAA.jamiyetSeeFeed)}
          </Link>
          <Link
            to="/community?tab=mine"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-900 hover:underline"
          >
            {text(KAA.jamiyetSeeMine)}
            <AnimChevron count={2} className="opacity-60" />
          </Link>
        </div>
      </div>
      <p className="relative mb-5 text-sm text-ink/55">{text(KAA.jamiyetPanelHint)}</p>

      <form onSubmit={submit} className="mb-6 grid gap-3 md:grid-cols-2">
        <label className="text-sm text-ink/60">
          {text('Túri')}
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="mt-1 w-full rounded-xl border border-ink/15 bg-white/80 px-3 py-2"
          >
            <option value="synonym">{text(KAA.jamiyetTypeSynonym)}</option>
            <option value="antonym">{text(KAA.jamiyetTypeAntonym)}</option>
            <option value="compound">{text(KAA.jamiyetTypeCompound)}</option>
          </select>
        </label>
        {type !== 'compound' && senses.length > 0 && (
          <label className="text-sm text-ink/60">
            {text('Anıqlama')}
            <select
              value={descriptionId}
              onChange={(e) => setDescriptionId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink/15 bg-white/80 px-3 py-2"
            >
              {senses.map((s) => (
                <option key={s.id} value={s.id}>
                  {text((s.description || '').slice(0, 80))}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="text-sm text-ink/60 md:col-span-2">
          {text('Usınıs etilgen sóz')}
          <input
            value={suggestedWord}
            onChange={(e) => setSuggestedWord(e.target.value)}
            required
            maxLength={100}
            className="mt-1 w-full rounded-xl border border-ink/15 bg-white/80 px-3 py-2"
            placeholder={text('Máselen: keskir')}
          />
        </label>
        <button
          type="submit"
          disabled={busy || !suggestedWord.trim()}
          className="md:col-span-2 rounded-xl bg-gradient-to-r from-teal-600 to-teal-700 px-5 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-teal-900/25 transition-all hover:-translate-y-0.5 hover:from-teal-700 hover:to-teal-800 disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {busy ? text('Jiberilip atır...') : text('Usınıs jiberiw')}
        </button>
      </form>
      {msg ? (
        <div
          className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${
            msgTone === 'err'
              ? 'border-rose-200 bg-rose-50/80 text-rose-800'
              : 'border-emerald-200/80 bg-emerald-50/70 text-emerald-950'
          }`}
        >
          <p>{text(msg)}</p>
          {msgTone === 'ok' ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                to="/community?tab=mine"
                className="inline-flex items-center gap-1.5 rounded-full bg-teal-900 px-3.5 py-1.5 text-xs font-bold text-white"
              >
                <Icon name="users" /> {text(KAA.jamiyetSeeMine)}
                <AnimChevron count={2} className="opacity-80" style={{ ['--dch-color']: '#ecfdf5' }} />
              </Link>
              <Link
                to="/profile"
                className="inline-flex items-center gap-1.5 rounded-full border border-teal-700/25 bg-white px-3.5 py-1.5 text-xs font-bold text-teal-950"
              >
                {text(KAA.jamiyetSoftSync)}
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      {pending.length > 0 && (
        <ul className="space-y-3">
          {pending.map((s) => (
            <CommunitySuggestionRow
              key={s.id}
              item={s}
              onUpdated={(next) =>
                setPending((prev) => prev.map((row) => (row.id === next.id ? next : row)))
              }
            />
          ))}
        </ul>
      )}
    </aside>
  );
}
