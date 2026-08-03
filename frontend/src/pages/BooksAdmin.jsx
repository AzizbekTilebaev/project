import { useCallback, useEffect, useState } from 'react';
import usePageMeta from '../hooks/usePageMeta';
import usePageData, { loadPageBundle } from '../hooks/usePageData';
import PageGate from '../components/PageGate';
import DictShell from '../components/dictionary/DictShell';
import { useUiScript } from '../contexts/UiScriptContext';
import { fetchAdminWriters, fetchAdminPieces, saveAdminPiece, hideAdminPiece, restoreAdminPiece, deleteAdminPiece } from '../api/admin';
import {
  adminCreateBook,
  adminUpdateBook,
  adminDeleteBook,
  adminHideBook,
  adminRestoreBook,
  adminLinkBookWriter,
  adminUnlinkBookWriter,
  adminListBooks,
  adminFetchBook,
  getAdminToken,
  clearAdminToken,
  bookFileUrl,
} from '../api/books';
import AdminLoginForm from '../components/AdminLoginForm';

const GENRES = [
  { value: 'dastan', label: 'Dástan' },
  { value: 'klassik', label: 'Klassik poeziya' },
  { value: 'zamanagoy', label: 'Zamanagóy poeziya' },
  { value: 'roman', label: 'Roman' },
  { value: 'ertek', label: 'Ertek' },
  { value: 'other', label: 'Basqa' },
];

const EMPTY_SECTION = { title: '', paragraphsText: '' };

function emptyForm() {
  return {
    title: '',
    author: '',
    years: '',
    genre: 'klassik',
    description: '',
    note: '',
    sourceKind: 'text',
    sections: [{ ...EMPTY_SECTION }],
  };
}

function bookToForm(book) {
  return {
    title: book.title || '',
    author: book.author || '',
    years: book.years || '',
    genre: book.genre || 'other',
    description: book.description || '',
    note: book.note || '',
    sourceKind: book.sourceType === 'text' ? 'text' : 'file',
    sections:
      book.sections?.length > 0
        ? book.sections.map((s) => ({
            title: s.title || '',
            paragraphsText: (s.paragraphs || []).join('\n\n'),
          }))
        : [{ ...EMPTY_SECTION }],
  };
}

function formatSize(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function WriterLinkPanel({ book, text, onChanged }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const writers = book.writers || [];

  useEffect(() => {
    const needle = q.trim();
    if (needle.length < 2) {
      setHits([]);
      return undefined;
    }
    let cancelled = false;
    const t = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetchAdminWriters({ q: needle, limit: 8 });
        if (!cancelled) setHits(res.items || []);
      } catch {
        if (!cancelled) setHits([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [q]);

  async function linkWriter(writer) {
    setBusy(true);
    setErr('');
    try {
      await adminLinkBookWriter(book.id, { writerId: writer.id, role: 'author' });
      setQ('');
      setHits([]);
      onChanged();
    } catch (ex) {
      setErr(ex.message || text('Baylanıstırıw ámelge aspadı'));
    } finally {
      setBusy(false);
    }
  }

  async function unlink(writerId) {
    setBusy(true);
    setErr('');
    try {
      await adminUnlinkBookWriter(book.id, writerId);
      onChanged();
    } catch (ex) {
      setErr(ex.message || text('Óshiriw ámelge aspadı'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 qp-card qp-card--static p-3">
      <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ink/45">
        {text('Shoirlar')}
      </p>
      {writers.length ? (
        <ul className="mb-2 space-y-1">
          {writers.map((w) => (
            <li key={w.writerId} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-ink">{text(w.name || w.nameLatin || w.nameCyrillic)}</span>
              <button
                type="button"
                disabled={busy}
                onClick={() => unlink(w.writerId)}
                className="text-xs text-rose-700"
              >
                {text('Ayırıw')}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-2 text-xs text-rose-700/80">{text('Shoir baylanıspaǵan')}</p>
      )}
      <div className="relative">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={text('Shoirdi izleń…')}
          className="w-full rounded-xl border border-ink/15 px-3 py-1.5 text-sm"
        />
        {searching ? <p className="mt-1 text-xs text-ink/40">{text('Izlenip atır…')}</p> : null}
        {hits.length > 0 ? (
          <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-xl border border-ink/10 bg-white shadow-lg">
            {hits.map((hit) => (
              <li key={hit.id}>
                <button
                  type="button"
                  disabled={busy}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-teal-50"
                  onClick={() => linkWriter(hit)}
                >
                  {text(hit.name || hit.nameLatin || hit.nameCyrillic)}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {err ? <p className="mt-1 text-xs text-rose-700">{text(err)}</p> : null}
    </div>
  );
}

function emptyPieceForm() {
  return {
    id: null,
    title: '',
    paragraphsText: '',
    workYear: '',
    workDateLabel: '',
    workPlace: '',
    writerId: '',
    sortOrder: '',
  };
}

function PiecesPanel({ book, text }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyPieceForm);
  const [showForm, setShowForm] = useState(false);
  const [writerQ, setWriterQ] = useState('');
  const [writerHits, setWriterHits] = useState([]);
  const [pickedWriter, setPickedWriter] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const res = await fetchAdminPieces({ bookId: book.id, limit: 100 });
      setItems(res.items || []);
    } catch (ex) {
      setErr(ex.message || text('Júklew qáteligi'));
    } finally {
      setLoading(false);
    }
  }, [book.id, text]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const needle = writerQ.trim();
    if (needle.length < 2 || pickedWriter) {
      setWriterHits([]);
      return undefined;
    }
    let cancelled = false;
    const t = window.setTimeout(async () => {
      try {
        const res = await fetchAdminWriters({ q: needle, limit: 8 });
        if (!cancelled) setWriterHits(res.items || []);
      } catch {
        if (!cancelled) setWriterHits([]);
      }
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [writerQ, pickedWriter]);

  function openCreate() {
    setForm(emptyPieceForm());
    setPickedWriter(null);
    setWriterQ('');
    setShowForm(true);
  }

  function openEdit(piece) {
    setForm({
      id: piece.id,
      title: piece.titleLatin || piece.title || '',
      paragraphsText: (piece.paragraphsLatin || piece.paragraphs || []).join('\n\n'),
      workYear: piece.workYear != null ? String(piece.workYear) : '',
      workDateLabel: piece.workDateLabel || '',
      workPlace: piece.workPlace || '',
      writerId: piece.writerId != null ? String(piece.writerId) : '',
      sortOrder: piece.sortOrder != null ? String(piece.sortOrder) : '',
    });
    setPickedWriter(
      piece.writerId
        ? { id: piece.writerId, name: piece.writerName || String(piece.writerId) }
        : null
    );
    setWriterQ('');
    setShowForm(true);
  }

  async function onSave(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const paragraphs = form.paragraphsText
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean);
      await saveAdminPiece({
        id: form.id || undefined,
        bookId: book.id,
        title: form.title.trim(),
        paragraphs,
        workYear: form.workYear || null,
        workDateLabel: form.workDateLabel.trim() || '',
        workPlace: form.workPlace.trim() || '',
        writerId: pickedWriter?.id ?? (form.writerId ? Number(form.writerId) : null),
        sortOrder: form.sortOrder !== '' ? Number(form.sortOrder) : undefined,
        status: 'published',
      });
      setShowForm(false);
      await reload();
    } catch (ex) {
      setErr(ex.message || text('Saqlaw qáteligi'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-teal-200/50 bg-teal-50/40 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ink/45">
          {text('Asar bólekleri')} ({items.length})
        </p>
        <button
          type="button"
          onClick={openCreate}
          className="qp-btn-primary !px-3 !py-1 !text-xs"
        >
          {text('+ Bólek')}
        </button>
      </div>
      {loading ? <p className="text-xs text-ink/45">{text('Júklenip atır…')}</p> : null}
      {err ? <p className="mb-2 text-xs text-rose-700">{text(err)}</p> : null}

      {showForm ? (
        <form onSubmit={onSave} className="mb-3 space-y-2 qp-card qp-card--static p-3">
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder={text('Bólek atı')}
            required
            className="w-full rounded-xl border border-ink/15 px-3 py-1.5 text-sm"
          />
          <textarea
            value={form.paragraphsText}
            onChange={(e) => setForm((f) => ({ ...f, paragraphsText: e.target.value }))}
            rows={5}
            required
            placeholder={text('Paragraflar — bos qator menen')}
            className="w-full rounded-xl border border-ink/15 px-3 py-1.5 text-sm"
          />
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              value={form.workYear}
              onChange={(e) => setForm((f) => ({ ...f, workYear: e.target.value }))}
              placeholder={text('Jıl')}
              className="rounded-xl border border-ink/15 px-3 py-1.5 text-sm"
            />
            <input
              value={form.workDateLabel}
              onChange={(e) => setForm((f) => ({ ...f, workDateLabel: e.target.value }))}
              placeholder={text('Sáne belgisi')}
              className="rounded-xl border border-ink/15 px-3 py-1.5 text-sm"
            />
            <input
              value={form.workPlace}
              onChange={(e) => setForm((f) => ({ ...f, workPlace: e.target.value }))}
              placeholder={text('Orın')}
              className="rounded-xl border border-ink/15 px-3 py-1.5 text-sm"
            />
          </div>
          <div className="relative">
            {pickedWriter ? (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-1.5 text-sm">
                <span>{text(pickedWriter.name)}</span>
                <button
                  type="button"
                  className="text-xs text-teal-900 underline"
                  onClick={() => {
                    setPickedWriter(null);
                    setForm((f) => ({ ...f, writerId: '' }));
                  }}
                >
                  {text('Ayırıw')}
                </button>
              </div>
            ) : (
              <input
                value={writerQ}
                onChange={(e) => setWriterQ(e.target.value)}
                placeholder={text('Shoir (ixtiyarıy)…')}
                className="w-full rounded-xl border border-ink/15 px-3 py-1.5 text-sm"
              />
            )}
            {!pickedWriter && writerHits.length > 0 ? (
              <ul className="absolute z-10 mt-1 max-h-36 w-full overflow-auto rounded-xl border border-ink/10 bg-white shadow-lg">
                {writerHits.map((hit) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-teal-50"
                      onClick={() => {
                        setPickedWriter({
                          id: hit.id,
                          name: hit.name || hit.nameLatin || hit.nameCyrillic,
                        });
                        setWriterHits([]);
                        setWriterQ('');
                      }}
                    >
                      {text(hit.name || hit.nameLatin || hit.nameCyrillic)}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy}
              className="qp-btn-primary !px-4 !py-1.5 !text-xs disabled:opacity-50"
            >
              {text(busy ? '…' : 'Saqlaw')}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-full border border-ink/15 px-4 py-1.5 text-xs text-ink/60"
            >
              {text('Biykar')}
            </button>
          </div>
        </form>
      ) : null}

      <ul className="space-y-1.5">
        {items.map((piece) => (
          <li
            key={piece.id}
            className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${
              piece.isHidden
                ? 'border-ink/10 bg-ink/[0.04] opacity-70'
                : 'border-ink/10 bg-white/70'
            }`}
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-ink">
                {text(piece.title)}
                {piece.isHidden ? (
                  <span className="ml-2 text-[0.65rem] uppercase text-ink/45">
                    {text('Jasıriq')}
                  </span>
                ) : null}
              </p>
              <p className="truncate font-mono text-[0.65rem] text-ink/40">
                #{piece.sortOrder} · {piece.id}
                {piece.writerName ? ` · ${piece.writerName}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => openEdit(piece)}
                className="text-xs font-semibold text-teal-800"
              >
                {text('Ózgertiw')}
              </button>
              {piece.isHidden ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await restoreAdminPiece(piece.id);
                      await reload();
                    } catch (ex) {
                      setErr(ex.message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="text-xs font-semibold text-emerald-800"
                >
                  {text('Ashıw')}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await hideAdminPiece(piece.id);
                      await reload();
                    } catch (ex) {
                      setErr(ex.message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="text-xs text-ink/60"
                >
                  {text('Jasıriw')}
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  if (!window.confirm(text('Bólek tolıq óshirilsin be?'))) return;
                  setBusy(true);
                  try {
                    await deleteAdminPiece(piece.id);
                    await reload();
                  } catch (ex) {
                    setErr(ex.message);
                  } finally {
                    setBusy(false);
                  }
                }}
                className="text-xs font-semibold text-rose-700"
              >
                {text('Óshiriw')}
              </button>
            </div>
          </li>
        ))}
        {!loading && !items.length ? (
          <li className="py-3 text-center text-xs text-ink/45">{text('Bólek joq')}</li>
        ) : null}
      </ul>
    </div>
  );
}

export default function BooksAdmin() {
  const { text } = useUiScript();
  usePageMeta(text('Kitaplar admin'), text('Kitap qosıw / redaktorlaw — tek admin.'));

  const [authed, setAuthed] = useState(() => Boolean(getAdminToken()));
  const [books, setBooks] = useState([]);
  const [listQ, setListQ] = useState('');
  const [orphansOnly, setOrphansOnly] = useState(false);
  const [hiddenOnly, setHiddenOnly] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const [listFilter, setListFilter] = useState({
    q: '',
    orphansOnly: false,
    hiddenOnly: false,
    importStatus: '',
  });
  const [writersBookId, setWritersBookId] = useState(null);
  const [piecesBookId, setPiecesBookId] = useState(null);

  const { status, data, error: loadError, reload } = usePageData(
    () =>
      loadPageBundle({
        books: async () => {
          const res = await adminListBooks({
            q: listFilter.q,
            orphansOnly: listFilter.orphansOnly,
            hiddenOnly: listFilter.hiddenOnly,
            importStatus: listFilter.importStatus,
          });
          return res.books || [];
        },
      }),
    {
      enabled: authed,
      deps: [
        authed,
        listFilter.q,
        listFilter.orphansOnly,
        listFilter.hiddenOnly,
        listFilter.importStatus,
      ],
    }
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (data?.books) setBooks(data.books);
  }, [data]);

  const applyListFilter = useCallback(() => {
    setListFilter({
      q: listQ.trim(),
      orphansOnly,
      hiddenOnly,
      importStatus,
    });
  }, [listQ, orphansOnly, hiddenOnly, importStatus]);

  const logout = () => {
    clearAdminToken();
    setAuthed(false);
    setShowForm(false);
    setEditingId(null);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFile(null);
    setMsg('');
    setShowForm(true);
  };

  const openEdit = async (book) => {
    setBusy(true);
    setMsg('');
    try {
      const dataRes = await adminFetchBook(book.id);
      setEditingId(book.id);
      setForm(bookToForm(dataRes.book));
      setFile(null);
      setShowForm(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const updateSection = (idx, patch) => {
    setForm((f) => ({
      ...f,
      sections: f.sections.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    }));
  };

  const addSection = () => {
    setForm((f) => ({ ...f, sections: [...f.sections, { ...EMPTY_SECTION }] }));
  };

  const removeSection = (idx) => {
    setForm((f) => ({
      ...f,
      sections: f.sections.length <= 1 ? f.sections : f.sections.filter((_, i) => i !== idx),
    }));
  };

  const buildPayload = () => {
    const payload = {
      title: form.title.trim(),
      author: form.author.trim(),
      years: form.years.trim(),
      genre: form.genre,
      description: form.description.trim(),
      note: form.note.trim(),
      sourceType: form.sourceKind === 'text' ? 'text' : undefined,
    };
    if (form.sourceKind === 'text') {
      payload.sections = form.sections.map((s) => ({
        title: s.title.trim(),
        paragraphs: s.paragraphsText
          .split(/\n\s*\n/)
          .map((p) => p.trim())
          .filter(Boolean),
      }));
    }
    return payload;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    setError('');
    try {
      const payload = buildPayload();
      if (!payload.title || !payload.author) {
        throw new Error('Atı hám avtor kerek');
      }
      if (form.sourceKind === 'file' && !file && !editingId) {
        throw new Error('PDF / DOC / DOCX fayl tańlań');
      }
      if (form.sourceKind === 'text') {
        if (!payload.sections.some((s) => s.title && s.paragraphs.length)) {
          throw new Error('Keminde 1 bólim hám paragraf kerek');
        }
      }

      if (editingId) {
        await adminUpdateBook(
          editingId,
          payload,
          form.sourceKind === 'file' && file ? file : null
        );
        setMsg('Kitap jańalandı');
      } else {
        await adminCreateBook(payload, form.sourceKind === 'file' ? file : null);
        setMsg('Kitap qosıldı');
      }
      setShowForm(false);
      setEditingId(null);
      setFile(null);
      await reload();
    } catch (err) {
      if (String(err.message || '').includes('Admin ruxsat')) {
        setAuthed(false);
      }
      setError(err.message || 'Saqlaw qáteligi');
    } finally {
      setBusy(false);
    }
  };

  const onHide = async (book) => {
    setBusy(true);
    setError('');
    try {
      await adminHideBook(book.id);
      setMsg('Kitap jasıldı (soft)');
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const onRestore = async (book) => {
    setBusy(true);
    setError('');
    try {
      await adminRestoreBook(book.id);
      setMsg('Kitap qayta ashıldı');
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (book) => {
    if (!window.confirm(text(`«${book.title}» tolıq óshirilsin be? Fayl da óshedi.`))) return;
    setBusy(true);
    setError('');
    try {
      await adminDeleteBook(book.id);
      setMsg('Kitap óshirildi');
      if (editingId === book.id) {
        setShowForm(false);
        setEditingId(null);
      }
      await reload();
    } catch (err) {
      if (String(err.message || '').includes('Admin ruxsat')) {
        setAuthed(false);
      }
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!authed) {
    return (
      <DictShell className="pt-24 pb-24">
        <section className="relative mx-auto max-w-md px-6 pt-12">
          <p className="mb-2 text-[0.7rem] uppercase tracking-[0.22em] text-teal-800/60">
            {text('Admin')}
          </p>
          <h1 className="mb-3 font-display text-3xl text-ink">{text('Kitaplar basqarıw')}</h1>
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
            <p className="mb-2 text-[0.7rem] uppercase tracking-[0.22em] text-teal-800/60">
              {text('Admin')}
            </p>
            <h1 className="font-display text-3xl text-ink md:text-4xl">
              {text('Kitaplar basqarıw')}
            </h1>
            <p className="mt-1 text-xs text-ink/45">
              {text('Orphan · shoir · asar bólekleri · jasıriw')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openCreate}
              className="qp-btn-primary !px-4 !py-2.5 !text-sm"
            >
              {text('+ Jańa kitap')}
            </button>
            <button
              type="button"
              onClick={logout}
              className="qp-btn-ghost !px-4 !py-2.5 !text-sm"
            >
              {text('Shıǵıw')}
            </button>
          </div>
        </div>

        {msg && (
          <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {text(msg)}
          </p>
        )}
        {error && (
          <p className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{text(error)}</p>
        )}

        {showForm && (
          <form
            onSubmit={onSubmit}
            className="mb-10 space-y-4 qp-panel p-6"
          >
            <h2 className="font-display text-2xl text-ink">
              {text(editingId ? 'Redaktorlaw' : 'Jańa kitap')}
            </h2>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm text-ink/60 md:col-span-2">
                {text('Atı')} *
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  required
                  className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2"
                />
              </label>
              <label className="text-sm text-ink/60">
                {text('Avtor')} *
                <input
                  value={form.author}
                  onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
                  required
                  className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2"
                />
              </label>
              <label className="text-sm text-ink/60">
                {text('Dáwir / jıllar')}
                <input
                  value={form.years}
                  onChange={(e) => setForm((f) => ({ ...f, years: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2"
                />
              </label>
              <label className="text-sm text-ink/60">
                {text('Janr')}
                <select
                  value={form.genre}
                  onChange={(e) => setForm((f) => ({ ...f, genre: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2"
                >
                  {GENRES.map((g) => (
                    <option key={g.value} value={g.value}>
                      {text(g.label)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-ink/60 md:col-span-2">
                {text('Mazmunı')}
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2"
                />
              </label>
              <label className="text-sm text-ink/60 md:col-span-2">
                {text('Nota')}
                <input
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2"
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, sourceKind: 'text' }))}
                className={`rounded-full px-4 py-2 text-sm font-medium ${
                  form.sourceKind === 'text'
                    ? 'bg-teal-100 text-teal-900 shadow-sm'
                    : 'bg-ink/[0.04] text-ink/55 hover:bg-teal-50/70'
                }`}
              >
                {text('Tekst bólimleri')}
              </button>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, sourceKind: 'file' }))}
                className={`rounded-full px-4 py-2 text-sm font-medium ${
                  form.sourceKind === 'file'
                    ? 'bg-teal-100 text-teal-900 shadow-sm'
                    : 'bg-ink/[0.04] text-ink/55 hover:bg-teal-50/70'
                }`}
              >
                {text('PDF / DOC fayl')}
              </button>
            </div>

            {form.sourceKind === 'file' ? (
              <div className="rounded-2xl border border-dashed border-teal-400/40 bg-teal-50/40 p-4">
                <label className="block text-sm text-ink/60">
                  {text('Fayl (PDF, DOC, DOCX)')}
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="mt-2 block w-full text-sm"
                    aria-label={text('Fayl (PDF, DOC, DOCX)')}
                  />
                </label>
                {file && (
                  <p className="mt-2 text-sm text-teal-900">
                    {text('Tańlandı')}: {file.name} ({formatSize(file.size)})
                  </p>
                )}
                {editingId && !file && (
                  <p className="mt-2 text-xs text-ink/45">
                    {text('Jańa fayl tańlamasańız, ázirgi fayl saqlanıp qaladı.')}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {form.sections.map((section, idx) => (
                  <div
                    key={idx}
                    className="qp-card qp-card--static p-4"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-wider text-teal-800/70">
                        {text('Bólim')} {idx + 1}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeSection(idx)}
                        className="text-xs text-rose-600"
                      >
                        {text('Óshiriw')}
                      </button>
                    </div>
                    <input
                      value={section.title}
                      onChange={(e) => updateSection(idx, { title: e.target.value })}
                      placeholder={text('Bólim atı')}
                      className="mb-2 w-full rounded-xl border border-ink/15 px-3 py-2 text-sm"
                    />
                    <textarea
                      value={section.paragraphsText}
                      onChange={(e) =>
                        updateSection(idx, { paragraphsText: e.target.value })
                      }
                      rows={5}
                      placeholder={text('Paragraflar — bos qator menen ajıratıń')}
                      className="w-full rounded-xl border border-ink/15 px-3 py-2 text-sm"
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addSection}
                  className="rounded-xl border border-teal-700/30 px-4 py-2 text-sm font-medium text-teal-900"
                >
                  {text('+ Bólim qosıw')}
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="submit"
                disabled={busy}
                className="qp-btn-primary !px-6 !py-3 !text-sm disabled:opacity-50"
              >
                {text(busy ? 'Saqlanıp atır...' : editingId ? 'Jańalaw' : 'Qosıw')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setFile(null);
                }}
                className="qp-btn-ghost !px-6 !py-3 !text-sm"
              >
                {text('Biykarlaw')}
              </button>
            </div>
          </form>
        )}

        <div className="mb-4 flex flex-wrap items-end gap-2">
          <label className="min-w-[12rem] flex-1">
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ink/45">
              {text('Tizimde izlew')}
            </span>
            <input
              type="search"
              value={listQ}
              onChange={(e) => setListQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  applyListFilter();
                }
              }}
              placeholder={text('Atı / avtor / id…')}
              className="mt-1 w-full rounded-full border border-ink/15 bg-white px-3 py-1.5 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-ink/60">
            <input
              type="checkbox"
              checked={orphansOnly}
              onChange={(e) => setOrphansOnly(e.target.checked)}
            />
            {text('Tek orphan')}
          </label>
          <label className="flex items-center gap-2 text-xs text-ink/60">
            <input
              type="checkbox"
              checked={hiddenOnly}
              onChange={(e) => setHiddenOnly(e.target.checked)}
            />
            {text('Tek jasıriq')}
          </label>
          <label className="text-xs text-ink/60">
            <span className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ink/45">
              {text('import_status')}
            </span>
            <select
              value={importStatus}
              onChange={(e) => setImportStatus(e.target.value)}
              className="rounded-full border border-ink/15 bg-white px-3 py-1.5 text-sm"
            >
              <option value="">{text('Barlıq')}</option>
              <option value="seed">seed</option>
              <option value="imported">imported</option>
              <option value="draft">draft</option>
              <option value="skipped">skipped</option>
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

        <PageGate status={status} error={loadError} onRetry={reload}>
          <ul className="space-y-3">
            {books.map((book) => (
              <li
                key={book.id}
                className={`qp-card qp-card--static px-4 py-4 ${
                  book.isHidden
                    ? 'opacity-80'
                    : book.isOrphan
                      ? 'border-rose-300/50 bg-rose-50/50'
                      : ''
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-xl text-ink">{text(book.title)}</p>
                    <p className="text-sm text-ink/55">{text(book.author)}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="qp-chip !px-2.5 !py-1 text-teal-900">
                        {book.sourceType}
                      </span>
                      {book.importStatus ? (
                        <span
                          className={`rounded-full px-2.5 py-1 font-semibold ${
                            book.importStatus === 'skipped'
                              ? 'bg-ink/10 text-ink/60'
                              : book.importStatus === 'imported'
                                ? 'bg-emerald-100 text-emerald-900'
                                : book.importStatus === 'draft'
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-sky-100 text-sky-900'
                          }`}
                        >
                          {book.importStatus}
                        </span>
                      ) : null}
                      {book.isHidden ? (
                        <span className="rounded-full bg-ink/10 px-2.5 py-1 font-semibold text-ink/60">
                          {text('Jasıriq')}
                        </span>
                      ) : null}
                      {book.missingFile ? (
                        <span className="rounded-full bg-rose-100 px-2.5 py-1 font-semibold text-rose-800">
                          {text('Fayl joq')}
                        </span>
                      ) : null}
                      {book.noWriter ? (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-900">
                          {text('Shoirsiz')}
                        </span>
                      ) : null}
                      {book.hasFile && !book.missingFile && (
                        <span className="qp-chip !px-2.5 !py-1 text-teal-900">
                          {book.originalName} · {formatSize(book.fileSize)}
                        </span>
                      )}
                      {book.sourceType !== 'text' && book.hasFile && !book.missingFile && (
                        <a
                          href={bookFileUrl(book.id, { download: book.sourceType !== 'pdf' })}
                          className="rounded-full bg-sky-100 px-2.5 py-1 font-medium text-sky-900"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {text('Fayldı ashıw')}
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        if (writersBookId === book.id) {
                          setWritersBookId(null);
                          return;
                        }
                        setPiecesBookId(null);
                        try {
                          const res = await adminFetchBook(book.id);
                          setBooks((prev) =>
                            prev.map((b) => (b.id === book.id ? { ...b, ...res.book } : b))
                          );
                          setWritersBookId(book.id);
                        } catch (err) {
                          setError(err.message);
                        }
                      }}
                      disabled={busy}
                      className="rounded-lg border border-teal-700/25 px-3 py-1.5 text-sm text-teal-900"
                    >
                      {text('Shoirlar')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (piecesBookId === book.id) {
                          setPiecesBookId(null);
                          return;
                        }
                        setWritersBookId(null);
                        setPiecesBookId(book.id);
                      }}
                      disabled={busy}
                      className="rounded-lg border border-teal-700/25 px-3 py-1.5 text-sm text-teal-900"
                    >
                      {text('Bólekler')}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(book)}
                      disabled={busy}
                      className="rounded-lg border border-teal-700/25 px-3 py-1.5 text-sm text-teal-900"
                    >
                      {text('Ózgertiw')}
                    </button>
                    {book.isHidden ? (
                      <button
                        type="button"
                        onClick={() => onRestore(book)}
                        disabled={busy}
                        className="rounded-lg border border-emerald-600/30 px-3 py-1.5 text-sm text-emerald-800"
                      >
                        {text('Qayta ashıw (restore)')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onHide(book)}
                        disabled={busy}
                        className="rounded-lg border border-ink/20 px-3 py-1.5 text-sm text-ink/70"
                      >
                        {text('Skip / jasıriw')}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onDelete(book)}
                      disabled={busy}
                      className="rounded-lg border border-rose-500/30 px-3 py-1.5 text-sm text-rose-700"
                    >
                      {text('Óshiriw')}
                    </button>
                  </div>
                </div>
                {writersBookId === book.id ? (
                  <WriterLinkPanel
                    book={book}
                    text={text}
                    onChanged={async () => {
                      const res = await adminFetchBook(book.id);
                      setBooks((prev) =>
                        prev.map((b) => (b.id === book.id ? { ...b, ...res.book } : b))
                      );
                    }}
                  />
                ) : null}
                {piecesBookId === book.id ? <PiecesPanel book={book} text={text} /> : null}
              </li>
            ))}
            {books.length === 0 && (
              <p className="py-10 text-center text-ink/50">{text('Ele kitap joq.')}</p>
            )}
          </ul>
        </PageGate>
      </section>
    </DictShell>
  );
}
