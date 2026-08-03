import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import DictShell from '../components/dictionary/DictShell';
import AdminLoginForm from '../components/AdminLoginForm';
import { useUiScript } from '../contexts/UiScriptContext';
import {
  clearAdminToken,
  deleteAdminLesson,
  fetchAdminLessons,
  fetchAdminLessonSections,
  generateAdminLesson,
  getAdminToken,
  saveAdminLesson,
} from '../api/admin';
import { adminListBooks } from '../api/books';

function isChoiceType(type) {
  return type === 'choice' || type === 'sense_pick';
}

function questionToDraft(q) {
  const meta = q.meta || {};
  return {
    id: q.id,
    type: q.type || 'cloze',
    prompt: q.prompt || '',
    acceptedText: Array.isArray(meta.accepted) ? meta.accepted.join('\n') : '',
    optionsText: Array.isArray(q.options) ? q.options.join('\n') : '',
    answerIndex: meta.answerIndex != null ? String(meta.answerIndex) : '0',
    answer: meta.answer || '',
    dictTitleId: meta.dictTitleId || null,
    sourceSentence: meta.sourceSentence || null,
  };
}

function draftToQuestion(d) {
  const base = {
    id: d.id,
    type: d.type,
    prompt: d.prompt.trim(),
  };
  if (isChoiceType(d.type)) {
    const options = d.optionsText
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean);
    const answerIndex = Math.max(0, Number.parseInt(d.answerIndex, 10) || 0);
    return {
      ...base,
      options,
      meta: {
        answerIndex: Math.min(answerIndex, Math.max(0, options.length - 1)),
        answer: options[answerIndex] || '',
        dictTitleId: d.dictTitleId || null,
        sourceSentence: d.sourceSentence || null,
      },
    };
  }
  const accepted = d.acceptedText
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
  return {
    ...base,
    meta: {
      answer: d.answer || accepted[0] || '',
      accepted: accepted.length ? accepted : [d.answer || ''].filter(Boolean),
      dictTitleId: d.dictTitleId || null,
      sourceSentence: d.sourceSentence || null,
    },
  };
}

export default function ReadingLessonsAdmin() {
  const { text } = useUiScript();
  usePageMeta(text('Oqıw darsları'), text('Generate · pin · redaktorlaw'));
  const [authed, setAuthed] = useState(() => Boolean(getAdminToken()));
  const [books, setBooks] = useState([]);
  const [bookId, setBookId] = useState('');
  const [sections, setSections] = useState([]);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [pinned, setPinned] = useState([]);
  const [draft, setDraft] = useState(null);
  const [questionDrafts, setQuestionDrafts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const loadPinned = useCallback(async () => {
    const res = await fetchAdminLessons();
    setPinned(res.lessons || []);
  }, []);

  useEffect(() => {
    if (!authed) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const [booksRes] = await Promise.all([adminListBooks({}), loadPinned()]);
        if (!cancelled) setBooks(booksRes.books || []);
      } catch (err) {
        if (!cancelled) {
          if (/401|ruxsat|Kiriw/i.test(String(err.message || ''))) setAuthed(false);
          setError(err.message);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authed, loadPinned]);

  useEffect(() => {
    if (!authed || !bookId) {
      setSections([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchAdminLessonSections(bookId);
        if (cancelled) return;
        setSections(res.sections || []);
        setSectionIndex(res.sections?.[0]?.sectionIndex ?? 0);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authed, bookId]);

  async function runGenerate({ force = false } = {}) {
    if (!bookId) {
      setError(text('Kitap saylań'));
      return;
    }
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const res = await generateAdminLesson({
        bookId,
        sectionIndex: Number(sectionIndex),
        force,
      });
      const lesson = res.lesson;
      setDraft(lesson);
      setQuestionDrafts((lesson.questions || []).map(questionToDraft));
      setMsg(
        lesson.pinned
          ? text('Saqlanǵan pin júklendi')
          : text('Jańa dars dúzildi — pin ushın Saqlaw')
      );
    } catch (err) {
      setError(err.message || text('Generate qátesi'));
    } finally {
      setBusy(false);
    }
  }

  async function openPinned(row) {
    setBookId(row.bookId);
    setSectionIndex(row.sectionIndex);
    setBusy(true);
    setError('');
    try {
      const res = await generateAdminLesson({
        bookId: row.bookId,
        sectionIndex: row.sectionIndex,
        force: false,
      });
      const lesson = { ...res.lesson, id: row.id };
      setDraft(lesson);
      setQuestionDrafts((lesson.questions || []).map(questionToDraft));
      setMsg(text('Pin redaktorlanıp atır'));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function updateQuestion(idx, patch) {
    setQuestionDrafts((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  }

  async function onSave() {
    if (!draft || !bookId) return;
    const questions = questionDrafts.map(draftToQuestion).filter((q) => q.prompt);
    if (!questions.length) {
      setError(text('Keminde 1 soraw kerek'));
      return;
    }
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const lessonPayload = {
        ...draft,
        questions,
        source: {
          ...(draft.source || {}),
          bookId,
          sectionIndex: Number(sectionIndex),
          sectionTitle:
            sections.find((s) => s.sectionIndex === Number(sectionIndex))?.sectionTitle ||
            draft.source?.sectionTitle ||
            '',
        },
      };
      delete lessonPayload.pinned;
      const res = await saveAdminLesson({
        id: draft.id || undefined,
        bookId,
        sectionIndex: Number(sectionIndex),
        lesson: lessonPayload,
      });
      setDraft({ ...lessonPayload, id: res.lesson?.id || draft.id, pinned: true });
      setMsg(text('Dars pin qılındı'));
      await loadPinned();
    } catch (err) {
      setError(err.message || text('Saqlaw qátesi'));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id) {
    if (!window.confirm(text('Pin óshirilsin be? Keyin avtomat dúziledi.'))) return;
    setBusy(true);
    try {
      await deleteAdminLesson(id);
      if (draft?.id === id) {
        setDraft(null);
        setQuestionDrafts([]);
      }
      setMsg(text('Pin óshirildi'));
      await loadPinned();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!authed) {
    return (
      <DictShell className="pt-24 pb-24">
        <section className="relative mx-auto max-w-md px-6 pt-12">
          <h1 className="mb-4 font-display text-3xl text-ink">{text('Oqıw darsları')}</h1>
          <AdminLoginForm onSuccess={() => setAuthed(true)} />
        </section>
      </DictShell>
    );
  }

  return (
    <DictShell className="pt-24 pb-24">
      <section className="relative mx-auto max-w-4xl px-6 pt-8 md:px-10">
        <div className="qp-section-head items-start">
          <div>
            <p className="mb-1 text-[0.7rem] uppercase tracking-[0.22em] text-teal-800/60">
              {text('Admin')}
            </p>
            <h1 className="font-display text-3xl text-ink">{text('Oqıw darsları')}</h1>
            <p className="mt-1 text-xs text-ink/45">
              {text('Generate → redaktorlaw → pin. Pin saqlansa oqıw usı versiyanı aladı.')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/admin"
              className="qp-btn-ghost !px-4 !py-2 !text-sm"
            >
              {text('Admin panel')}
            </Link>
            <button
              type="button"
              onClick={() => {
                clearAdminToken();
                setAuthed(false);
              }}
              className="qp-btn-ghost !px-4 !py-2 !text-sm"
            >
              {text('Shıǵıw')}
            </button>
          </div>
        </div>

        {msg ? (
          <p className="mb-3 rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
            {text(msg)}
          </p>
        ) : null}
        {error ? (
          <p className="mb-3 rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-800">{text(error)}</p>
        ) : null}

        <div className="mb-8 space-y-3 qp-panel p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">
            {text('Jańa / redaktorlaw')}
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm text-ink/60">
              {text('Kitap')}
              <select
                value={bookId}
                onChange={(e) => {
                  setBookId(e.target.value);
                  setDraft(null);
                  setQuestionDrafts([]);
                }}
                className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2"
              >
                <option value="">{text('— saylań —')}</option>
                {books.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title} ({b.id})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-ink/60">
              {text('Bólim')}
              <select
                value={sectionIndex}
                onChange={(e) => {
                  setSectionIndex(Number(e.target.value));
                  setDraft(null);
                  setQuestionDrafts([]);
                }}
                disabled={!sections.length}
                className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2"
              >
                {!sections.length ? (
                  <option value={0}>{text('Bólim joq')}</option>
                ) : (
                  sections.map((s) => (
                    <option key={s.sectionIndex} value={s.sectionIndex}>
                      #{s.sectionIndex + 1} — {s.sectionTitle || text('atsız')}
                    </option>
                  ))
                )}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !bookId || !sections.length}
              onClick={() => runGenerate({ force: false })}
              className="qp-btn-primary !px-4 !py-2 !text-sm disabled:opacity-50"
            >
              {text(busy ? '…' : 'Júklew / Generate')}
            </button>
            <button
              type="button"
              disabled={busy || !bookId || !sections.length}
              onClick={() => runGenerate({ force: true })}
              className="rounded-full border border-teal-700/40 px-4 py-2 text-sm font-semibold text-teal-900 disabled:opacity-50"
            >
              {text('Qayta dúziw')}
            </button>
            {draft ? (
              <button
                type="button"
                disabled={busy}
                onClick={onSave}
                className="qp-btn-primary !px-4 !py-2 !text-sm disabled:opacity-50"
              >
                {text('Pin saqlaw')}
              </button>
            ) : null}
          </div>
        </div>

        {draft ? (
          <div className="mb-8 space-y-4 qp-panel border-teal-200/50 bg-teal-50/30 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-xl text-ink">
                {text(draft.source?.sectionTitle || 'Dars')}
              </h2>
              <span className="rounded-full bg-white/80 px-3 py-1 text-xs text-ink/55">
                {draft.pinned || draft.id ? text('Pin bar') : text('Pin joq')} ·{' '}
                {questionDrafts.length} {text('soraw')}
              </span>
            </div>
            {draft.summary?.length ? (
              <p className="text-sm text-ink/60">{text(draft.summary.join(' '))}</p>
            ) : null}

            {questionDrafts.map((q, idx) => (
              <div
                key={q.id || idx}
                className="space-y-2 qp-card qp-card--static p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-teal-800/70">
                    {text('Soraw')} {idx + 1} · {q.type}
                  </p>
                  <button
                    type="button"
                    className="text-xs text-rose-700"
                    onClick={() =>
                      setQuestionDrafts((prev) => prev.filter((_, i) => i !== idx))
                    }
                  >
                    {text('Alıp taslaw')}
                  </button>
                </div>
                <label className="block text-sm text-ink/60">
                  {text('Soraw / prompt')}
                  <textarea
                    value={q.prompt}
                    onChange={(e) => updateQuestion(idx, { prompt: e.target.value })}
                    rows={2}
                    className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2 text-sm"
                  />
                </label>
                {isChoiceType(q.type) ? (
                  <>
                    <label className="block text-sm text-ink/60">
                      {text('Variantlar (hár qatarda bir)')}
                      <textarea
                        value={q.optionsText}
                        onChange={(e) => updateQuestion(idx, { optionsText: e.target.value })}
                        rows={4}
                        className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2 font-mono text-sm"
                      />
                    </label>
                    <label className="block text-sm text-ink/60">
                      {text('Durıs indeks (0…)')}
                      <input
                        value={q.answerIndex}
                        onChange={(e) => updateQuestion(idx, { answerIndex: e.target.value })}
                        className="mt-1 w-24 rounded-xl border border-ink/15 px-3 py-2 text-sm"
                      />
                    </label>
                  </>
                ) : (
                  <label className="block text-sm text-ink/60">
                    {text('Qabıl etiletuǵın juwaplar (hár qatarda bir)')}
                    <textarea
                      value={q.acceptedText}
                      onChange={(e) => updateQuestion(idx, { acceptedText: e.target.value })}
                      rows={3}
                      className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2 font-mono text-sm"
                    />
                  </label>
                )}
              </div>
            ))}
          </div>
        ) : null}

        <div>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-display text-xl text-ink">{text('Pinlenǵen darslar')}</h2>
            <button
              type="button"
              onClick={() => loadPinned().catch((e) => setError(e.message))}
              disabled={busy}
              className="rounded-full border border-ink/15 px-4 py-1.5 text-xs"
            >
              {text('Jańalaw')}
            </button>
          </div>
          <ul className="space-y-2">
            {pinned.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 qp-card qp-card--static px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    {text(row.bookTitle || row.bookId)} · {text('Bólim')} #
                    {row.sectionIndex + 1}
                    {row.sectionTitle ? ` — ${row.sectionTitle}` : ''}
                  </p>
                  <p className="mt-0.5 text-xs text-ink/45">
                    {row.questionCount || row.lesson?.questions?.length || 0} {text('soraw')} ·{' '}
                    {row.updatedAt ? new Date(row.updatedAt).toLocaleString() : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => openPinned(row)}
                    className="rounded-lg border border-teal-700/25 px-3 py-1.5 text-sm text-teal-900"
                  >
                    {text('Ózgertiw')}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onDelete(row.id)}
                    className="rounded-lg border border-rose-500/30 px-3 py-1.5 text-sm text-rose-700"
                  >
                    {text('Óshiriw')}
                  </button>
                </div>
              </li>
            ))}
            {!pinned.length ? (
              <li className="rounded-2xl bg-white/50 p-8 text-center text-sm text-ink/45">
                {text('Ele pin joq — generate hám saqlaw.')}
              </li>
            ) : null}
          </ul>
        </div>
      </section>
    </DictShell>
  );
}
