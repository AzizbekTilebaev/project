import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DictShell from '../components/dictionary/DictShell';
import usePageMeta from '../hooks/usePageMeta';
import { useUiScript } from '../contexts/UiScriptContext';
import {
  clearAdminToken,
  getAdminToken,
  fetchAdminMe,
  fetchAdminQuizzes,
  fetchAdminQuiz,
  createAdminQuiz,
  updateAdminQuiz,
  deleteAdminQuiz,
} from '../api/admin';
import AdminLoginForm from '../components/AdminLoginForm';

const LEVELS = ['baslawish', 'orta', 'joqari'];

function emptyQuestion() {
  return { question: '', options: ['', ''], correctIndex: 0, timeLimitSeconds: '' };
}

function emptyForm() {
  return {
    id: null,
    customId: '',
    title: '',
    description: '',
    level: 'baslawish',
    category: '',
    timeMode: 'untimed',
    timeLimitSeconds: '',
    sortOrder: '',
    isPublished: true,
    questions: [emptyQuestion()],
    attemptCount: 0,
  };
}

export default function QuizzesAdmin() {
  const { text } = useUiScript();
  usePageMeta(text('Testler admin'), text('Test qosıw, redaktorlaw hám óshiriw.'));

  const [authed, setAuthed] = useState(() => Boolean(getAdminToken()));
  const [quizzes, setQuizzes] = useState([]);
  const [listMeta, setListMeta] = useState({ total: 0, pages: 1, page: 1 });
  const [listQ, setListQ] = useState('');
  const [listLevel, setListLevel] = useState('');
  const [listPublished, setListPublished] = useState('');
  const [filter, setFilter] = useState({ q: '', level: '', published: '', page: 1 });
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(null);

  const load = useCallback(async () => {
    setError('');
    try {
      await fetchAdminMe();
      const res = await fetchAdminQuizzes({
        q: filter.q,
        level: filter.level,
        published: filter.published,
        page: filter.page,
        limit: 40,
      });
      setQuizzes(res.quizzes || res.items || []);
      setListMeta({
        total: res.total || 0,
        pages: res.pages || 1,
        page: res.page || 1,
      });
    } catch (err) {
      setError(err.message || 'Júklew qátesi');
      if (!getAdminToken()) setAuthed(false);
    }
  }, [filter]);

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  async function openEdit(id) {
    setBusy(true);
    setError('');
    try {
      const res = await fetchAdminQuiz(id);
      const quiz = res.quiz;
      setForm({
        id: quiz.id,
        customId: '',
        title: quiz.title || '',
        description: quiz.description || '',
        level: quiz.level || 'baslawish',
        category: quiz.category || '',
        timeMode: quiz.timeMode || 'untimed',
        timeLimitSeconds: quiz.timeLimitSeconds ?? '',
        sortOrder: quiz.sortOrder ?? 0,
        isPublished: quiz.isPublished !== false,
        attemptCount: quiz.attemptCount || 0,
        questions: quiz.questions.map((q) => ({
          question: q.question,
          options: [...q.options],
          correctIndex: q.correctIndex >= 0 ? q.correctIndex : 0,
          timeLimitSeconds: q.timeLimitSeconds ?? '',
        })),
      });
      setMsg('');
    } catch (err) {
      setError(err.message || 'Ashıw qátesi');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(quiz) {
    const warning =
      quiz.attemptCount > 0
        ? `"${quiz.title}" testinde ${quiz.attemptCount} urınıw bar — hámmesi óshiriledi. Isenimlisiz be?`
        : `"${quiz.title}" testi óshiriledi. Isenimlisiz be?`;
    if (!window.confirm(text(warning))) return;
    setBusy(true);
    setError('');
    try {
      await deleteAdminQuiz(quiz.id);
      setMsg(text('Test óshirildi'));
      await load();
    } catch (err) {
      setError(err.message || 'Óshiriw qátesi');
    } finally {
      setBusy(false);
    }
  }

  function patchQuestion(idx, patch) {
    setForm((f) => ({
      ...f,
      questions: f.questions.map((q, i) => (i === idx ? { ...q, ...patch } : q)),
    }));
  }

  function patchOption(qIdx, oIdx, value) {
    setForm((f) => ({
      ...f,
      questions: f.questions.map((q, i) =>
        i === qIdx ? { ...q, options: q.options.map((o, j) => (j === oIdx ? value : o)) } : q
      ),
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const questionsLocked = Boolean(form.id && form.attemptCount > 0);
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        level: form.level,
        category: form.category.trim(),
        timeMode: form.timeMode,
        timeLimitSeconds: form.timeMode === 'timed' ? Number(form.timeLimitSeconds) : null,
        sortOrder: form.sortOrder === '' ? undefined : Number(form.sortOrder),
        isPublished: Boolean(form.isPublished),
      };
      if (!questionsLocked) {
        payload.questions = form.questions.map((q) => ({
          question: q.question.trim(),
          options: q.options.map((o) => o.trim()).filter(Boolean),
          correctIndex: q.correctIndex,
          timeLimitSeconds: q.timeLimitSeconds === '' ? null : Number(q.timeLimitSeconds),
        }));
      }
      if (form.id) {
        await updateAdminQuiz(form.id, payload);
        setMsg(text('Test jańalandı'));
      } else {
        if (form.customId.trim()) payload.id = form.customId.trim().toLowerCase();
        await createAdminQuiz(payload);
        setMsg(text('Test qosıldı'));
      }
      setForm(null);
      await load();
    } catch (err) {
      setError(err.message || 'Saqlaw qátesi');
    } finally {
      setBusy(false);
    }
  }

  function applyListFilter() {
    setFilter({
      q: listQ.trim(),
      level: listLevel,
      published: listPublished,
      page: 1,
    });
  }

  if (!authed) {
    return (
      <DictShell className="pt-24 pb-24">
        <section className="mx-auto max-w-md px-6 pt-8">
          <h1 className="mb-6 font-display text-3xl text-ink">{text('Testler admin')}</h1>
          <AdminLoginForm onSuccess={() => setAuthed(true)} />
        </section>
      </DictShell>
    );
  }

  const questionsLocked = Boolean(form?.id && form.attemptCount > 0);

  return (
    <DictShell className="pt-24 pb-24">
      <section className="mx-auto max-w-4xl px-6 pt-6">
        <div className="qp-section-head">
          <div>
            <h1 className="font-display text-3xl text-ink">{text('Testler admin')}</h1>
            <Link to="/admin" className="text-sm text-teal-800 underline">
              {text('← Basqarıw paneli')}
            </Link>
          </div>
          <div className="flex gap-2">
            {!form && (
              <button
                type="button"
                onClick={() => {
                  setForm(emptyForm());
                  setMsg('');
                }}
                className="qp-btn-primary !px-5 !py-2.5 !text-sm"
              >
                {text('+ Jańa test')}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                clearAdminToken();
                setAuthed(false);
              }}
              className="qp-btn-ghost !px-5 !py-2.5 !text-sm"
            >
              {text('Shıǵıw')}
            </button>
          </div>
        </div>

        {error && (
          <p className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{text(error)}</p>
        )}
        {msg && (
          <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{text(msg)}</p>
        )}

        {form ? (
          <form onSubmit={handleSubmit} className="space-y-5 qp-panel p-6">
            <h2 className="font-display text-xl text-ink">
              {text(form.id ? `Testti redaktorlaw: ${form.id}` : 'Jańa test')}
            </h2>
            {questionsLocked ? (
              <p className="rounded-xl bg-amber-50 px-4 py-2 text-xs text-amber-900">
                {text(
                  'Urınıwlar bar — sorawlardı ózgertip bolmaydı. Meta, nashr hám tártip saqlanadı.'
                )}
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              {!form.id ? (
                <label className="block text-sm sm:col-span-2">
                  {text('ID (ixtiyarıy)')}
                  <input
                    value={form.customId}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        customId: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                      }))
                    }
                    placeholder="mısalı: grammar-1"
                    maxLength={32}
                    className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2 font-mono text-sm"
                  />
                </label>
              ) : null}
              <label className="block text-sm">
                {text('Test atı')}
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2"
                  required
                />
              </label>
              <label className="block text-sm">
                {text('Kategoriya')}
                <input
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                {text('Dáreje')}
                <select
                  value={form.level}
                  onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2"
                >
                  {LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                {text('Waqıt rejimi')}
                <select
                  value={form.timeMode}
                  onChange={(e) => setForm((f) => ({ ...f, timeMode: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2"
                  disabled={questionsLocked}
                >
                  <option value="untimed">{text('Waqıtsız')}</option>
                  <option value="timed">{text('Waqıtlı')}</option>
                </select>
              </label>
              {form.timeMode === 'timed' && (
                <label className="block text-sm">
                  {text('Ulıwma waqıt (sekund)')}
                  <input
                    type="number"
                    min="30"
                    max="3600"
                    value={form.timeLimitSeconds}
                    onChange={(e) => setForm((f) => ({ ...f, timeLimitSeconds: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2"
                    required
                    disabled={questionsLocked}
                  />
                </label>
              )}
              <label className="block text-sm">
                {text('Tártip (sort)')}
                <input
                  type="number"
                  min="0"
                  value={form.sortOrder}
                  onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2"
                />
              </label>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))}
                />
                {text('Nashr etilgen (public)')}
              </label>
            </div>
            <label className="block text-sm">
              {text('Táriyp')}
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2"
              />
            </label>

            {!questionsLocked ? (
              <div className="space-y-4">
                <h3 className="font-semibold text-ink">
                  {text('Sorawlar')} ({form.questions.length})
                </h3>
                {form.questions.map((q, qIdx) => (
                  <div key={qIdx} className="qp-card qp-card--static p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-bold text-ink/45">#{qIdx + 1}</span>
                      <button
                        type="button"
                        disabled={form.questions.length <= 1}
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            questions: f.questions.filter((_, i) => i !== qIdx),
                          }))
                        }
                        className="text-xs text-rose-700 disabled:opacity-30"
                      >
                        {text('Sorawdı óshiriw')}
                      </button>
                    </div>
                    <input
                      value={q.question}
                      onChange={(e) => patchQuestion(qIdx, { question: e.target.value })}
                      placeholder={text('Soraw teksti')}
                      className="mb-3 w-full rounded-xl border border-ink/15 px-3 py-2"
                      required
                    />
                    <div className="space-y-2">
                      {q.options.map((option, oIdx) => (
                        <div key={oIdx} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`correct-${qIdx}`}
                            checked={q.correctIndex === oIdx}
                            onChange={() => patchQuestion(qIdx, { correctIndex: oIdx })}
                            title={text('Durıs juwap')}
                          />
                          <input
                            value={option}
                            onChange={(e) => patchOption(qIdx, oIdx, e.target.value)}
                            placeholder={text(`Variant ${oIdx + 1}`)}
                            className="flex-1 rounded-xl border border-ink/15 px-3 py-1.5 text-sm"
                            required
                          />
                          <button
                            type="button"
                            disabled={q.options.length <= 2}
                            onClick={() =>
                              patchQuestion(qIdx, {
                                options: q.options.filter((_, j) => j !== oIdx),
                                correctIndex:
                                  q.correctIndex >= oIdx && q.correctIndex > 0
                                    ? q.correctIndex - 1
                                    : q.correctIndex,
                              })
                            }
                            className="text-xs text-rose-600 disabled:opacity-30"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        disabled={q.options.length >= 6}
                        onClick={() => patchQuestion(qIdx, { options: [...q.options, ''] })}
                        className="text-xs font-semibold text-teal-800 disabled:opacity-30"
                      >
                        {text('+ Variant')}
                      </button>
                      <label className="flex items-center gap-2 text-xs text-ink/55">
                        {text('Soraw waqtı (sekund):')}
                        <input
                          type="number"
                          min="5"
                          max="600"
                          value={q.timeLimitSeconds}
                          onChange={(e) =>
                            patchQuestion(qIdx, { timeLimitSeconds: e.target.value })
                          }
                          className="w-20 rounded-lg border border-ink/15 px-2 py-1"
                          required={form.timeMode === 'timed'}
                        />
                      </label>
                      <span className="text-xs text-emerald-700">
                        {text('Durıs:')} {q.options[q.correctIndex] || '—'}
                      </span>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  disabled={form.questions.length >= 100}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      questions: [...f.questions, emptyQuestion()],
                    }))
                  }
                  className="rounded-full border border-teal-800 px-4 py-2 text-sm font-semibold text-teal-800"
                >
                  {text('+ Soraw qosıw')}
                </button>
              </div>
            ) : (
              <p className="text-sm text-ink/55">
                {form.questions.length} {text('soraw')} · {form.attemptCount} {text('urınıw')}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="qp-btn-primary !px-6 !py-2.5 !text-sm disabled:opacity-50"
              >
                {text(busy ? 'Saqlanıp atır…' : 'Saqlaw')}
              </button>
              <button
                type="button"
                onClick={() => setForm(null)}
                className="rounded-full border border-ink/15 px-6 py-2.5 text-sm"
              >
                {text('Biykarlaw')}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-2 qp-card qp-card--static p-3">
              <label className="min-w-[10rem] flex-1 text-xs text-ink/55">
                {text('Izlew')}
                <input
                  value={listQ}
                  onChange={(e) => setListQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      applyListFilter();
                    }
                  }}
                  placeholder={text('Atı / id / kategoriya…')}
                  className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs text-ink/55">
                {text('Dáreje')}
                <select
                  value={listLevel}
                  onChange={(e) => setListLevel(e.target.value)}
                  className="mt-1 block rounded-xl border border-ink/15 px-3 py-1.5 text-sm"
                >
                  <option value="">{text('Barlıǵı')}</option>
                  {LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-ink/55">
                {text('Nashr')}
                <select
                  value={listPublished}
                  onChange={(e) => setListPublished(e.target.value)}
                  className="mt-1 block rounded-xl border border-ink/15 px-3 py-1.5 text-sm"
                >
                  <option value="">{text('Barlıǵı')}</option>
                  <option value="1">{text('Nashr')}</option>
                  <option value="0">{text('Qaralama')}</option>
                </select>
              </label>
              <button
                type="button"
                onClick={applyListFilter}
                className="rounded-full border border-ink/15 px-4 py-1.5 text-xs font-semibold"
              >
                {text('Süzew')}
              </button>
            </div>

            {quizzes.map((quiz) => (
              <article
                key={quiz.id}
                className="flex flex-wrap items-center justify-between gap-3 qp-card qp-card--static p-4"
              >
                <div>
                  <h2 className="font-semibold text-ink">
                    {quiz.title}
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase ${
                        quiz.isPublished
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-ink/10 text-ink/55'
                      }`}
                    >
                      {text(quiz.isPublished ? 'Nashr' : 'Qaralama')}
                    </span>
                  </h2>
                  <p className="mt-0.5 text-xs text-ink/50">
                    #{quiz.sortOrder ?? 0} · ID: {quiz.id} · {quiz.questionCount}{' '}
                    {text('soraw')} · {quiz.attemptCount} {text('urınıw')} ·{' '}
                    {text(
                      quiz.timeMode === 'timed'
                        ? `Waqıtlı (${quiz.timeLimitSeconds}s)`
                        : 'Waqıtsız'
                    )}
                    {quiz.level ? ` · ${quiz.level}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(quiz.id)}
                    disabled={busy}
                    className="rounded-full border border-teal-800 px-4 py-1.5 text-xs font-semibold text-teal-800"
                  >
                    {text('Redaktorlaw')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(quiz)}
                    disabled={busy}
                    className="rounded-full border border-rose-300 px-4 py-1.5 text-xs font-semibold text-rose-700"
                  >
                    {text('Óshiriw')}
                  </button>
                </div>
              </article>
            ))}
            {!quizzes.length && (
              <p className="rounded-2xl bg-white/60 p-8 text-center text-sm text-ink/50">
                {text('Testler joq. Birinshisin qosıń.')}
              </p>
            )}
            {listMeta.pages > 1 ? (
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={listMeta.page <= 1}
                  onClick={() => {
                    const p = Math.max(1, listMeta.page - 1);
                    setFilter((f) => ({ ...f, page: p }));
                  }}
                  className="rounded-full border border-ink/15 px-4 py-1.5 text-xs disabled:opacity-40"
                >
                  ←
                </button>
                <span className="text-xs text-ink/55">
                  {listMeta.page} / {listMeta.pages}
                </span>
                <button
                  type="button"
                  disabled={listMeta.page >= listMeta.pages}
                  onClick={() => {
                    const p = listMeta.page + 1;
                    setFilter((f) => ({ ...f, page: p }));
                  }}
                  className="rounded-full border border-ink/15 px-4 py-1.5 text-xs disabled:opacity-40"
                >
                  →
                </button>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </DictShell>
  );
}
