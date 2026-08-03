import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DictShell from '../components/dictionary/DictShell';
import ScriptPreview from '../components/admin/ScriptPreview';
import usePageMeta from '../hooks/usePageMeta';
import { useUiScript } from '../contexts/UiScriptContext';
import {
  clearAdminToken,
  getAdminToken,
  fetchAdminMe,
  fetchAdminWriters,
  fetchAdminWriter,
  createAdminWriter,
  updateAdminWriter,
  deleteAdminWriter,
  saveAdminCreativeWork,
  deleteAdminCreativeWork,
  uploadAdminWriterPhoto,
  deleteAdminWriterPhoto,
} from '../api/admin';
import AdminLoginForm from '../components/AdminLoginForm';

function emptyForm() {
  return {
    id: null,
    name: '',
    slug: '',
    biography: '',
    birthplace: '',
    birthYear: '',
    deathYear: '',
    status: 'published',
  };
}

export default function WritersAdmin() {
  const { text } = useUiScript();
  usePageMeta(text('Shayırlar admin'), text('Shayır qosıw, redaktorlaw hám dóretiwshilik jumısları.'));

  const [authed, setAuthed] = useState(() => Boolean(getAdminToken()));

  const [data, setData] = useState({ items: [], total: 0, page: 1, pages: 1 });
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [geocodeFilter, setGeocodeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(null);
  const [detail, setDetail] = useState(null);
  const [workForm, setWorkForm] = useState(null);
  const [photoForm, setPhotoForm] = useState(null);

  const load = useCallback(async () => {
    setError('');
    try {
      await fetchAdminMe();
      const res = await fetchAdminWriters({
        q,
        status: statusFilter,
        geocode: geocodeFilter,
        page,
        limit: 20,
      });
      setData(res);
    } catch (err) {
      setError(err.message || 'Júklew qátesi');
      if (!getAdminToken()) setAuthed(false);
    }
  }, [q, statusFilter, geocodeFilter, page]);

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  async function openDetail(id) {
    setBusy(true);
    setError('');
    try {
      const res = await fetchAdminWriter(id);
      setDetail(res.writer);
      setForm(null);
      setWorkForm(null);
      setPhotoForm(null);
      setMsg('');
    } catch (err) {
      setError(err.message || 'Ashıw qátesi');
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        biography: form.biography.trim(),
        birthplace: form.birthplace.trim(),
        birthYear: form.birthYear === '' ? null : Number(form.birthYear),
        deathYear: form.deathYear === '' ? null : Number(form.deathYear),
        status: form.status,
      };
      if (form.id) {
        await updateAdminWriter(form.id, payload);
        setMsg(text('Shayır jańalandı'));
        await openDetail(form.id);
      } else {
        const res = await createAdminWriter(payload);
        setMsg(text('Shayır qosıldı'));
        setForm(null);
        await load();
        if (res.writer?.id) await openDetail(res.writer.id);
      }
    } catch (err) {
      setError(err.message || 'Saqlaw qátesi');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(writer) {
    const warn =
      (writer.creativeCount || 0) + (writer.bookCount || 0) > 0
        ? `"${writer.name}" shayırı menen birge ${writer.creativeCount || 0} dóretiw hám ${writer.bookCount || 0} kitap baylanısı óshiriledi. Isenimlisiz be?`
        : `"${writer.name}" shayırı óshiriledi. Isenimlisiz be?`;
    if (!window.confirm(text(warn))) return;
    setBusy(true);
    try {
      await deleteAdminWriter(writer.id);
      setMsg(text('Shayır óshirildi'));
      setDetail(null);
      setForm(null);
      await load();
    } catch (err) {
      setError(err.message || 'Óshiriw qátesi');
    } finally {
      setBusy(false);
    }
  }

  async function handleWorkSubmit(e) {
    e.preventDefault();
    if (!detail?.id) return;
    setBusy(true);
    setError('');
    try {
      await saveAdminCreativeWork(detail.id, {
        id: workForm.id || undefined,
        title: workForm.title.trim(),
        body: workForm.body.trim(),
        workType: workForm.workType.trim() || 'qosıq',
        yearLabel: workForm.yearLabel.trim(),
        availability: workForm.availability || 'not_imported',
      });
      setMsg(text(workForm.id ? 'Jumıs jańalandı' : 'Jumıs qosıldı'));
      setWorkForm(null);
      await openDetail(detail.id);
    } catch (err) {
      setError(err.message || 'Jumıs saqlaw qátesi');
    } finally {
      setBusy(false);
    }
  }

  async function handlePhotoSubmit(e) {
    e.preventDefault();
    if (!detail?.id) return;
    if (!photoForm.file) {
      setError(text('Rasm faylı kerek'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await uploadAdminWriterPhoto(detail.id, {
        file: photoForm.file,
        year: photoForm.year,
        caption: photoForm.caption,
      });
      setMsg(text('Rasm qosıldı'));
      setPhotoForm(null);
      await openDetail(detail.id);
    } catch (err) {
      setError(err.message || 'Rasm júklew qátesi');
    } finally {
      setBusy(false);
    }
  }

  async function handlePhotoDelete(photoId) {
    if (!window.confirm(text('Bul rásim óshiriledi. Isenimlisiz be?'))) return;
    setBusy(true);
    try {
      await deleteAdminWriterPhoto(detail.id, photoId);
      setMsg(text('Rásim óshirildi'));
      await openDetail(detail.id);
    } catch (err) {
      setError(err.message || 'Óshiriw qátesi');
    } finally {
      setBusy(false);
    }
  }

  async function handleWorkDelete(workId) {
    if (!window.confirm(text('Bul dóretiwshilik jumıs óshiriledi. Isenimlisiz be?'))) return;
    setBusy(true);
    try {
      await deleteAdminCreativeWork(detail.id, workId);
      setMsg(text('Jumıs óshirildi'));
      await openDetail(detail.id);
    } catch (err) {
      setError(err.message || 'Óshiriw qátesi');
    } finally {
      setBusy(false);
    }
  }

  if (!authed) {
    return (
      <DictShell className="pt-24 pb-24">
        <section className="mx-auto max-w-md px-6 pt-8">
          <h1 className="mb-6 font-display text-3xl text-ink">{text('Shayırlar admin')}</h1>
          <AdminLoginForm onSuccess={() => setAuthed(true)} />
        </section>
      </DictShell>
    );
  }

  return (
    <DictShell className="pt-24 pb-24">
      <section className="mx-auto max-w-4xl px-6 pt-6">
        <div className="qp-section-head">
          <div>
            <h1 className="font-display text-3xl text-ink">{text('Shayırlar admin')}</h1>
            <Link to="/admin" className="text-sm text-teal-800 underline">{text('← Basqarıw paneli')}</Link>
          </div>
          <div className="flex gap-2">
            {!form && !detail && (
              <button onClick={() => { setForm(emptyForm()); setMsg(''); }} className="qp-btn-primary !px-5 !py-2.5 !text-sm">
                {text('+ Jańa shayır')}
              </button>
            )}
            <button onClick={() => { clearAdminToken(); setAuthed(false); }} className="qp-btn-ghost !px-5 !py-2.5 !text-sm">
              {text('Shıǵıw')}
            </button>
          </div>
        </div>

        {error && <p className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{text(error)}</p>}
        {msg && <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{text(msg)}</p>}

        {form ? (
          <form onSubmit={handleSubmit} className="space-y-4 qp-panel p-6">
            <h2 className="font-display text-xl text-ink">
              {text(form.id ? `Shayırdı redaktorlaw: ${form.name || form.id}` : 'Jańa shayır')}
            </h2>
            <label className="block text-sm">
              {text('Atı (latın yamasa kirill)')}
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2" required />
            </label>
            <ScriptPreview value={form.name} label={text('Atı — eki alifba')} />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                {text('Slug (bos bolsa avtomat)')}
                <input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2" />
              </label>
              <label className="block text-sm">
                {text('Status')}
                <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2">
                  <option value="published">{text('Járiyalanǵan')}</option>
                  <option value="draft">{text('Qaralama')}</option>
                </select>
              </label>
              <label className="block text-sm">
                {text('Tuwılǵan jıl')}
                <input type="number" min="700" max="2100" value={form.birthYear} onChange={(e) => setForm((f) => ({ ...f, birthYear: e.target.value }))} className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2" />
              </label>
              <label className="block text-sm">
                {text('Ólim jılı')}
                <input type="number" min="700" max="2100" value={form.deathYear} onChange={(e) => setForm((f) => ({ ...f, deathYear: e.target.value }))} className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2" />
              </label>
            </div>
            <label className="block text-sm">
              {text('Tuwılǵan jer')}
              <input value={form.birthplace} onChange={(e) => setForm((f) => ({ ...f, birthplace: e.target.value }))} className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2" />
            </label>
            {form.birthplace && <ScriptPreview value={form.birthplace} label={text('Jer — eki alifba')} />}
            <label className="block text-sm">
              {text('Ómirbayán')}
              <textarea value={form.biography} onChange={(e) => setForm((f) => ({ ...f, biography: e.target.value }))} rows={6} className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2" />
            </label>
            <ScriptPreview value={form.biography} label={text('Ómirbayán — eki alifba')} multiline />
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className="qp-btn-primary !px-6 !py-2.5 !text-sm disabled:opacity-50">
                {text(busy ? 'Saqlanıp atır…' : 'Saqlaw')}
              </button>
              <button type="button" onClick={() => setForm(null)} className="rounded-full border border-ink/15 px-6 py-2.5 text-sm">{text('Biykarlaw')}</button>
            </div>
          </form>
        ) : detail ? (
          <div className="space-y-5">
            <div className="qp-panel p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl text-ink">{detail.nameLatin}</h2>
                  <p className="mt-1 text-sm text-ink/55">{detail.nameCyrillic}</p>
                  <p className="mt-2 text-xs text-ink/45">
                    {detail.lifeSpan || '—'} · /{detail.slug}
                    {detail.birthplaceLatin ? ` · ${detail.birthplaceLatin}` : ''}
                    {' · '}{detail.creativeCount || 0} {text('dóretiw')} · {detail.bookCount || 0} {text('kitap')}
                    {detail.geocodeStatus ? (
                      <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 font-semibold text-sky-900">
                        geocode: {detail.geocodeStatus}
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setForm({
                      id: detail.id,
                      name: detail.nameLatin,
                      slug: detail.slug,
                      biography: detail.biographyLatin || '',
                      birthplace: detail.birthplaceLatin || '',
                      birthYear: detail.birthYear ?? '',
                      deathYear: detail.deathYear ?? '',
                      status: detail.status,
                    })}
                    className="rounded-full border border-teal-800 px-4 py-1.5 text-xs font-semibold text-teal-800"
                  >
                    {text('Redaktorlaw')}
                  </button>
                  <button onClick={() => handleDelete(detail)} disabled={busy} className="rounded-full border border-rose-300 px-4 py-1.5 text-xs font-semibold text-rose-700">
                    {text('Óshiriw')}
                  </button>
                  <button onClick={() => setDetail(null)} className="rounded-full border border-ink/15 px-4 py-1.5 text-xs">
                    {text('← Dizim')}
                  </button>
                </div>
              </div>
              {detail.biographyLatin && (
                <p className="mt-4 max-h-40 overflow-auto whitespace-pre-wrap text-sm leading-relaxed text-ink/70">
                  {detail.biographyLatin}
                </p>
              )}
            </div>

            <div className="qp-panel p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-lg text-ink">{text('Waqıt mashinası (rásimler)')}</h3>
                {!photoForm && (
                  <button
                    onClick={() => setPhotoForm({ file: null, year: '', caption: '' })}
                    className="rounded-full bg-amber-700 px-4 py-1.5 text-xs font-semibold text-white"
                  >
                    {text('+ Rásim')}
                  </button>
                )}
              </div>

              {photoForm && (
                <form onSubmit={handlePhotoSubmit} className="mb-5 space-y-3 rounded-2xl border border-amber-900/10 bg-amber-50/40 p-4">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={(e) => setPhotoForm((f) => ({ ...f, file: e.target.files?.[0] || null }))}
                    className="w-full text-sm"
                    required
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      type="number"
                      min="700"
                      max="2100"
                      value={photoForm.year}
                      onChange={(e) => setPhotoForm((f) => ({ ...f, year: e.target.value }))}
                      placeholder={text('Jıl (máselen 1880)')}
                      className="rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm"
                    />
                    <input
                      value={photoForm.caption}
                      onChange={(e) => setPhotoForm((f) => ({ ...f, caption: e.target.value }))}
                      placeholder={text('Sharh (eki alifbağa ótedi)')}
                      className="rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <ScriptPreview value={photoForm.caption} label={text('Sharh — eki alifba')} />
                  <div className="flex gap-2">
                    <button type="submit" disabled={busy} className="rounded-full bg-amber-700 px-4 py-1.5 text-xs font-semibold text-white">{text('Júklew')}</button>
                    <button type="button" onClick={() => setPhotoForm(null)} className="rounded-full border border-ink/15 px-4 py-1.5 text-xs">{text('Biykarlaw')}</button>
                  </div>
                </form>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                {(detail.photos || []).map((photo) => (
                  <article key={photo.id} className="overflow-hidden qp-card qp-card--static">
                    <img src={photo.imageUrl} alt="" className="aspect-video w-full object-cover" />
                    <div className="flex items-start justify-between gap-2 p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold tabular-nums text-ink">{photo.year || '—'}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-ink/55">{photo.captionLatin || photo.caption}</p>
                      </div>
                      <button onClick={() => handlePhotoDelete(photo.id)} className="shrink-0 text-xs font-semibold text-rose-700">{text('Óshiriw')}</button>
                    </div>
                  </article>
                ))}
              </div>
              {!detail.photos?.length && !photoForm && (
                <p className="py-6 text-center text-sm text-ink/45">{text('Házirshe rásimler joq. Waqıt mashinası ushın qosıń.')}</p>
              )}
            </div>

            <div className="qp-panel p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-lg text-ink">{text('Dóretiwshilik jumısları')}</h3>
                {!workForm && (
                  <button
                    onClick={() => setWorkForm({
                      id: null,
                      title: '',
                      body: '',
                      workType: 'qosıq',
                      yearLabel: '',
                      availability: 'not_imported',
                    })}
                    className="qp-btn-primary !px-4 !py-1.5 !text-xs"
                  >
                    {text('+ Qosıq / jumıs')}
                  </button>
                )}
              </div>

              {workForm && (
                <form onSubmit={handleWorkSubmit} className="mb-5 space-y-3 rounded-2xl border border-teal-900/10 bg-teal-50/40 p-4">
                  <input
                    value={workForm.title}
                    onChange={(e) => setWorkForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder={text('Atı')}
                    className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm"
                    required
                  />
                  <ScriptPreview value={workForm.title} label={text('Atı — eki alifba')} />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      value={workForm.workType}
                      onChange={(e) => setWorkForm((f) => ({ ...f, workType: e.target.value }))}
                      placeholder={text('Túri (qosıq, poemа…)')}
                      className="rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm"
                    />
                    <input
                      value={workForm.yearLabel}
                      onChange={(e) => setWorkForm((f) => ({ ...f, yearLabel: e.target.value }))}
                      placeholder={text('Jıl / sáne')}
                      className="rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <textarea
                    value={workForm.body}
                    onChange={(e) => setWorkForm((f) => ({ ...f, body: e.target.value }))}
                    placeholder={text('Tekst (qosıq)')}
                    rows={5}
                    className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm"
                  />
                  <label className="block text-xs text-ink/60">
                    {text('availability')}
                    <select
                      value={workForm.availability || 'not_imported'}
                      onChange={(e) => setWorkForm((f) => ({ ...f, availability: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm"
                    >
                      <option value="not_imported">not_imported</option>
                      <option value="mentioned_only">mentioned_only</option>
                      <option value="in_library">in_library</option>
                    </select>
                  </label>
                  <ScriptPreview value={workForm.body} label={text('Tekst — eki alifba')} multiline />
                  <div className="flex gap-2">
                    <button type="submit" disabled={busy} className="qp-btn-primary !px-4 !py-1.5 !text-xs">{text('Saqlaw')}</button>
                    <button type="button" onClick={() => setWorkForm(null)} className="rounded-full border border-ink/15 px-4 py-1.5 text-xs">{text('Biykarlaw')}</button>
                  </div>
                </form>
              )}

              <div className="space-y-2">
                {(detail.creativeWorks || []).map((work) => (
                  <article key={work.id} className="flex flex-wrap items-center justify-between gap-2 qp-card qp-card--static p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{work.titleLatin || work.titleCyrillic}</p>
                      <p className="text-xs text-ink/45">
                        {work.workType}{work.yearLabel ? ` · ${work.yearLabel}` : ''}
                        {work.availability ? ` · ${work.availability}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setWorkForm({
                          id: work.id,
                          title: work.titleLatin || work.titleCyrillic,
                          body: '',
                          workType: work.workType || 'qosıq',
                          yearLabel: work.yearLabel || '',
                          availability: work.availability || 'not_imported',
                        })}
                        className="text-xs font-semibold text-teal-800"
                      >
                        {text('Redaktorlaw')}
                      </button>
                      <button onClick={() => handleWorkDelete(work.id)} className="text-xs font-semibold text-rose-700">{text('Óshiriw')}</button>
                    </div>
                  </article>
                ))}
                {!detail.creativeWorks?.length && !workForm && (
                  <p className="py-6 text-center text-sm text-ink/45">{text('Házirshe dóretiwshilik jumısları joq.')}</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              <input
                value={q}
                onChange={(e) => { setQ(e.target.value); setPage(1); }}
                placeholder={text('Izlew…')}
                className="min-w-48 flex-1 rounded-2xl border border-ink/10 bg-white/70 px-4 py-2 text-sm"
              />
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="rounded-2xl border border-ink/10 bg-white/70 px-3 py-2 text-sm"
              >
                <option value="">{text('Barlıq status')}</option>
                <option value="published">{text('Járiyalanǵan')}</option>
                <option value="draft">{text('Qaralama')}</option>
              </select>
              <select
                value={geocodeFilter}
                onChange={(e) => { setGeocodeFilter(e.target.value); setPage(1); }}
                className="rounded-2xl border border-ink/10 bg-white/70 px-3 py-2 text-sm"
              >
                <option value="">{text('geocode_status')}</option>
                <option value="none">none</option>
                <option value="pending">pending</option>
                <option value="resolved">resolved</option>
                <option value="failed">failed</option>
                <option value="manual">manual</option>
              </select>
            </div>
            <p className="mb-3 text-xs text-ink/50">{text('Jámi')}: {data.total} · {text('Bet')} {data.page}/{data.pages}</p>
            <div className="space-y-2">
              {data.items.map((item) => (
                <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 qp-card qp-card--static p-4">
                  <button onClick={() => openDetail(item.id)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-semibold text-ink">{item.nameLatin}</p>
                    <p className="mt-0.5 truncate text-xs text-ink/50">
                      {item.nameCyrillic} · {item.lifeSpan || '—'} · {item.creativeCount || 0} {text('dóretiw')}
                      {item.status !== 'published' && (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">{text('Qaralama')}</span>
                      )}
                      {item.geocodeStatus && item.geocodeStatus !== 'none' && (
                        <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-sky-900">
                          {item.geocodeStatus}
                        </span>
                      )}
                    </p>
                  </button>
                  <div className="flex gap-2">
                    <button onClick={() => openDetail(item.id)} disabled={busy} className="rounded-full border border-teal-800 px-4 py-1.5 text-xs font-semibold text-teal-800">
                      {text('Ashıw')}
                    </button>
                    <button onClick={() => handleDelete(item)} disabled={busy} className="rounded-full border border-rose-300 px-4 py-1.5 text-xs font-semibold text-rose-700">
                      {text('Óshiriw')}
                    </button>
                  </div>
                </article>
              ))}
              {!data.items.length && (
                <p className="rounded-2xl bg-white/60 p-8 text-center text-sm text-ink/50">{text('Shayırlar tabılmadı.')}</p>
              )}
            </div>
            {data.pages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-3">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-full border border-ink/15 px-4 py-1.5 text-sm disabled:opacity-30">←</button>
                <span className="text-sm text-ink/60">{data.page} / {data.pages}</span>
                <button onClick={() => setPage((p) => Math.min(data.pages, p + 1))} disabled={page >= data.pages} className="rounded-full border border-ink/15 px-4 py-1.5 text-sm disabled:opacity-30">→</button>
              </div>
            )}
          </>
        )}
      </section>
    </DictShell>
  );
}
