import { Link } from 'react-router-dom';
import Icon from '../Icon';
import { useUiScript } from '../../contexts/UiScriptContext';
import { KAA } from '../../i18n/kaa';
import OrnamentFrame from './OrnamentFrame';

function ruDisplayWord(word) {
  return String(word || '')
    .replace(/([А-ЯЁа-яёA-Za-z])\/{1,2}([А-ЯЁа-яёA-Za-z])/g, '$1$2')
    .trim();
}

function SenseList({ senses }) {
  if (!Array.isArray(senses) || !senses.length) return null;
  return (
    <ol className="mt-2 space-y-2 text-sm text-ink/75">
      {senses.map((s) => (
        <li key={s.n || s.text} className="leading-relaxed">
          {senses.length > 1 && (
            <span className="mr-1.5 font-semibold text-teal-800">{s.n}.</span>
          )}
          {s.text}
          {(s.examples || []).slice(0, 1).map((ex, i) => (
            <p key={i} className="mt-1 pl-3 text-xs italic text-ink/50 border-l border-teal-800/20">
              {ex.example}
              {ex.author ? (
                <>
                  {' '}
                  {ex.authorSlug ? (
                    <Link
                      to={`/writers/${encodeURIComponent(ex.authorSlug)}`}
                      className="not-italic font-semibold text-teal-900 no-underline hover:underline"
                    >
                      ({ex.author})
                    </Link>
                  ) : (
                    <span className="not-italic">({ex.author})</span>
                  )}
                </>
              ) : null}
            </p>
          ))}
        </li>
      ))}
    </ol>
  );
}

export function MorphologyPanel({ morphology }) {
  const { text } = useUiScript();
  if (!morphology) return null;
  const tags = Array.isArray(morphology.tags) ? morphology.tags : [];
  const segments = Array.isArray(morphology.segments) ? morphology.segments : [];
  const approximate = Boolean(morphology.approximate || morphology.source === 'qq-approx');
  const sourceLabel = approximate
    ? text('Taxminiy')
    : morphology.source === 'apertium-kaa'
      ? 'apertium'
      : morphology.source || 'morph';

  const hasSplit =
    Boolean(morphology.displaySplit) &&
    String(morphology.displaySplit).includes('+') &&
    segments.some((s) => s && !s.isRoot);

  const rootLabel =
    morphology.rootHeadword ||
    morphology.rootCyrillic ||
    morphology.lemmaLatin ||
    morphology.surfaceLatin;

  return (
    <section className="qp-card qp-card--static p-5 md:p-6">
      <div className="qp-section-head mb-3">
        <h2 className="font-display text-xl text-ink">{text('Morfologiya')}</h2>
        <span className="qp-chip">{sourceLabel}</span>
      </div>
      {approximate && (
        <p className="mb-2 text-xs text-ink/50">
          {text('Avtomatik túbir+qosımta bóliw — taxminiy; qol menen tekseriw múmkin.')}
        </p>
      )}
      {hasSplit ? (
        <p className="font-mono text-sm tracking-wide text-teal-900">
          {text(morphology.displaySplit)}
        </p>
      ) : (
        <p className="font-mono text-sm tracking-wide text-teal-900">
          {text(rootLabel || morphology.surfaceLatin || '')}
          <span className="ml-2 font-sans text-xs text-ink/40">
            ({text('bóleklenbeytuǵın túbir')})
          </span>
        </p>
      )}
      {hasSplit && (
        <p className="mt-1 text-sm text-ink/55">
          {text('Túbir')}: <strong className="text-ink">{text(rootLabel)}</strong>
        </p>
      )}
      {hasSplit && morphology.rootGloss && (
        <p className="mt-2 text-sm leading-relaxed text-ink/70">
          <span className="font-semibold text-ink/55">{text('Túbir mánisi')}: </span>
          {morphology.rootTitleId ? (
            <Link
              to={`/dictionary/${encodeURIComponent(morphology.rootTitleId)}`}
              className="text-teal-900 hover:underline"
            >
              {text(morphology.rootGloss)}
            </Link>
          ) : (
            text(morphology.rootGloss)
          )}
        </p>
      )}
      {hasSplit && tags.length > 0 && (
        <div className="motion-chip-stagger mt-3 flex flex-wrap gap-1.5">
          {tags.map((t, i) => (
            <span key={i} className="rounded-full border border-teal-700/15 bg-teal-50/80 px-2.5 py-1 text-[0.7rem] font-semibold text-teal-900">
              {t.form ? text(`-${t.form}`) : ''} {text(t.gloss || t.tag || '')}
            </span>
          ))}
        </div>
      )}
      {hasSplit && segments.length > 0 && (
        <div className="motion-chip-stagger mt-3 flex flex-wrap gap-1.5">
          {segments.map((seg, i) => (
            <span
              key={i}
              className={`rounded-lg px-2 py-1 text-xs border ${
                seg.isRoot
                  ? 'bg-teal-50/90 text-teal-950 border-teal-800/20 font-semibold'
                  : 'bg-white/70 text-ink/70 border-ink/10'
              }`}
            >
              {text(typeof seg === 'string' ? seg : seg.surface || seg.form || '')}
              {seg.role && !seg.isRoot ? (
                <span className="ml-1 text-[0.65rem] text-ink/40">({text(seg.role)})</span>
              ) : null}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

export function TranslationsPanel({ translations }) {
  const { text } = useUiScript();
  if (!translations) return null;
  const {
    uzb = [],
    lexicon = [],
    en = [],
    ru = [],
    frazeologiya = [],
    adamAtlari = [],
    imla = [],
  } = translations;
  if (
    !uzb.length &&
    !lexicon.length &&
    !en.length &&
    !ru.length &&
    !frazeologiya.length &&
    !adamAtlari.length &&
    !imla.length
  ) {
    return null;
  }

  return (
    <section className="space-y-5">
      {(uzb.length > 0 || lexicon.length > 0) && (
        <OrnamentFrame>
          <div className="qp-section-head mb-4">
            <h2 className="font-display text-xl text-ink">{text('Ózbeksha')}</h2>
            <Link to="/dictionary/uzb" className="qp-chip">{text('Sózlik')}</Link>
          </div>
          <div className="qp-entry-list">
            {uzb.slice(0, 4).map((row) => (
              <div key={row.id}>
                <Link to={`/dictionary/uzb/${row.id}`} className="font-semibold text-teal-900 hover:underline">
                  {row.word}
                </Link>
                {row.primary && <span className="ml-2 text-sm text-ink/45">→ {row.primary}</span>}
                <SenseList senses={row.senses} />
              </div>
            ))}
          </div>
          {lexicon.length > 0 && (
            <ul className="qp-entry-list mt-4 text-sm text-ink/60">
              {lexicon.slice(0, 6).map((r) => (
                <li key={`${r.uzb}-${r.kaa}`}>
                  <span className="font-medium text-ink/80">{r.uzb}</span>
                  <span className="mx-1.5 text-ink/30">↔</span>
                  {r.kaa}
                </li>
              ))}
            </ul>
          )}
        </OrnamentFrame>
      )}

      {en.length > 0 && (
        <OrnamentFrame>
          <div className="qp-section-head mb-4">
            <h2 className="font-display text-xl text-ink">English</h2>
            <Link to="/dictionary/en" className="qp-chip">{text('Sózlik')}</Link>
          </div>
          <div className="qp-entry-list">
            {en.slice(0, 4).map((row) => (
              <div key={row.id}>
                <Link to={`/dictionary/en/${row.id}`} className="font-semibold text-sky-900 hover:underline">
                  {row.word}
                </Link>
                {row.pos && <span className="ml-2 text-xs italic text-ink/45">{row.pos}</span>}
                <SenseList senses={row.senses} />
              </div>
            ))}
          </div>
        </OrnamentFrame>
      )}

      {ru.length > 0 && (
        <OrnamentFrame>
          <div className="qp-section-head mb-4">
            <h2 className="font-display text-xl text-ink">Русский</h2>
            <Link to="/dictionary/ru" className="qp-chip">{text('Sózlik')}</Link>
          </div>
          <div className="qp-entry-list">
            {ru.slice(0, 6).map((row) => (
              <div key={row.id}>
                <Link to={`/dictionary/ru/${row.id}`} className="font-semibold text-amber-950 hover:underline">
                  {ruDisplayWord(row.word)}
                </Link>
                {row.pos && <span className="ml-2 text-xs italic text-ink/45">{row.pos}</span>}
                <SenseList senses={row.senses} />
              </div>
            ))}
          </div>
        </OrnamentFrame>
      )}

      {frazeologiya.length > 0 && (
        <OrnamentFrame>
          <div className="qp-section-head mb-4">
            <h2 className="font-display text-xl text-ink">{text('Frazeologizmler')}</h2>
            <Link to="/dictionary/frazeologiya" className="qp-chip">{text('Sózlik')}</Link>
          </div>
          <div className="qp-entry-list">
            {frazeologiya.slice(0, 6).map((row) => (
              <div key={row.id}>
                <Link
                  to={`/dictionary/frazeologiya/${row.id}`}
                  className="font-semibold text-teal-900 hover:underline"
                >
                  {row.phrase}
                </Link>
                <SenseList senses={row.senses} />
              </div>
            ))}
          </div>
        </OrnamentFrame>
      )}

      {adamAtlari.length > 0 && (
        <OrnamentFrame>
          <div className="qp-section-head mb-4">
            <h2 className="font-display text-xl text-ink">{text('Adam atları')}</h2>
            <Link to="/dictionary/adam-atlari" className="qp-chip">{text('Sózlik')}</Link>
          </div>
          <div className="qp-entry-list">
            {adamAtlari.slice(0, 6).map((row) => (
              <div key={row.id}>
                <Link
                  to={`/dictionary/adam-atlari/${row.id}`}
                  className="font-semibold text-teal-900 hover:underline"
                >
                  {row.name}
                </Link>
                {row.gender ? (
                  <span className="ml-2 text-xs text-ink/40">
                    {row.gender === 'ul' ? text('Ul') : text('Qız')}
                  </span>
                ) : null}
                <SenseList senses={row.senses} />
              </div>
            ))}
          </div>
        </OrnamentFrame>
      )}

      {imla.length > 0 && (
        <OrnamentFrame>
          <div className="qp-section-head mb-4">
            <h2 className="font-display text-xl text-ink">{text('Imla')}</h2>
            <Link to="/dictionary/imla" className="qp-chip">{text('Sózlik')}</Link>
          </div>
          <div className="qp-entry-list">
            {imla.slice(0, 6).map((row) => (
              <div key={row.id}>
                <Link
                  to={`/dictionary/imla/${row.id}`}
                  className="font-semibold text-teal-900 hover:underline"
                >
                  {row.word}
                </Link>
                <p className="mt-1 text-sm text-ink/55 line-clamp-2">{row.entryText}</p>
              </div>
            ))}
          </div>
        </OrnamentFrame>
      )}
    </section>
  );
}

export function DictHubCards() {
  const { text } = useUiScript();
  const cards = [
    {
      to: '/dictionary',
      title: text('Túsindirme'),
      sub: text('Qaraqalpaqsha anıqlama sózlik'),
      lang: 'kaa',
    },
    {
      to: '/dictionary/uzb',
      title: text('Ózbeksha–Qaraqalpaqsha'),
      sub: text('Tarjima · Qaraqalpaq tiline'),
      lang: 'uzb→kaa',
    },
    {
      to: '/dictionary/en',
      title: 'English',
      sub: text('Qaraqalpaqsha → English'),
      lang: 'kaa→en',
    },
    {
      to: '/dictionary/ru',
      title: 'Русский',
      sub: text('Русский → Qaraqalpaqsha'),
      lang: 'ru→kaa',
    },
    {
      to: '/dictionary/frazeologiya',
      title: text('Frazeologizmler'),
      sub: text('Turaqlı birikpeler · mánisi'),
      lang: 'kaa',
    },
    {
      to: '/dictionary/adam-atlari',
      title: text('Adam atları'),
      sub: text('Atlar · mánisi · ul / qız'),
      lang: 'kaa',
    },
    {
      to: '/dictionary/imla',
      title: text('Imla sózligi'),
      sub: text('2020 · GitHub · ózimizdiń'),
      lang: 'kaa',
    },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <Link key={c.to + c.title} to={c.to} className="qp-card block p-4 no-underline">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-teal-800/70">
            {text(KAA.qaraqalpaqTili)}
          </p>
          <p className="mt-1 font-display text-lg text-ink">{c.title}</p>
          <p className="mt-1 text-xs text-ink/50">{c.sub}</p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-teal-800">
            {text('Ashiw')} <Icon name="right" />
          </span>
        </Link>
      ))}
    </div>
  );
}

export function KaaMonthsPanel({ months = [] }) {
  const { text } = useUiScript();
  if (!months.length) return null;
  return (
    <section className="qp-surface p-5 md:p-6 mb-10">
      <div className="qp-section-head mb-4">
        <div>
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-teal-800/60">
            {text('Qaraqalpaq tili')}
          </p>
          <h2 className="font-display text-2xl text-ink mt-1">
            {text('Anʼanavıy ay atamaları')}
          </h2>
          <p className="mt-1 text-sm text-ink/50">
            {text('Arabsha atamalar — Qaraqalpaqsha mánisi, grigorian ayı hám kelip shıǵıwı')}
          </p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {months.map((m) => {
          const inner = (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-display text-lg text-ink">{m.soz}</span>
                <span className="text-lg text-ink/55" dir="rtl" lang="ar">
                  {m.arabic}
                </span>
              </div>
              <p className="mt-1 text-sm text-ink/65">{m.meaning}</p>
              <p className="mt-1 text-xs font-semibold text-teal-800">{m.gregorianMonth}</p>
              {m.etymology && (
                <p className="mt-2 text-[0.7rem] leading-snug text-ink/45">{m.etymology}</p>
              )}
            </>
          );
          return m.titleId ? (
            <Link
              key={m.monthNum}
              to={`/dictionary/${m.titleId}`}
              className="qp-card block p-3.5 no-underline"
            >
              {inner}
            </Link>
          ) : (
            <div key={m.monthNum} className="qp-card qp-card--static p-3.5">
              {inner}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PackCard({ children, title, subtitle }) {
  const { text } = useUiScript();
  return (
    <section className="qp-surface p-5 md:p-6 mb-6">
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-teal-800/60">
        {text('Qaraqalpaq tili')}
      </p>
      <h2 className="font-display text-2xl text-ink mt-1">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-ink/50">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function KaaCulturePanels({ culture }) {
  const { text } = useUiScript();
  if (!culture?.packs?.length) return null;
  const byId = Object.fromEntries(culture.packs.map((p) => [p.id, p]));

  const bes = byId['besqala'];
  const founded = byId.founded;
  const urpaq = byId['jeti-urpaq'];
  const gimn = byId.gimn;
  const gaziynie = byId['jeti-gaziynie'];

  return (
    <div className="mb-10 space-y-0">
      {bes && (
        <PackCard title={text(bes.title)} subtitle={text(bes.subtitle)}>
          <div className="flex flex-wrap gap-2">
            {bes.items.map((it) => {
              const label = it.note ? `${it.name} (${it.note})` : it.name;
              return it.titleId ? (
                <Link key={it.name} to={`/dictionary/${it.titleId}`} className="qp-chip no-underline">
                  {label}
                </Link>
              ) : (
                <span key={it.name} className="qp-chip">
                  {label}
                </span>
              );
            })}
          </div>
        </PackCard>
      )}

      {founded && (
        <PackCard title={text(founded.title)} subtitle={text(founded.subtitle)}>
          <ul className="grid gap-2 sm:grid-cols-2">
            {founded.items.map((it) => (
              <li
                key={it.name}
                className="flex items-baseline justify-between gap-3 border-b border-ink/5 pb-2 text-sm"
              >
                <span className="font-medium text-ink">{it.name}</span>
                <span className="shrink-0 text-xs text-teal-800">{it.date}</span>
              </li>
            ))}
          </ul>
        </PackCard>
      )}

      {urpaq && (
        <PackCard title={text(urpaq.title)} subtitle={text(urpaq.subtitle)}>
          <ol className="grid gap-2 sm:grid-cols-2">
            {urpaq.items.map((it) => (
              <li key={it.name} className="qp-card qp-card--static flex items-center gap-3 p-3">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-teal-50 text-xs font-bold text-teal-900">
                  {it.n}
                </span>
                {it.titleId ? (
                  <Link to={`/dictionary/${it.titleId}`} className="font-semibold text-ink no-underline hover:text-teal-900">
                    {it.name}
                  </Link>
                ) : (
                  <span className="font-semibold text-ink">{it.name}</span>
                )}
              </li>
            ))}
          </ol>
        </PackCard>
      )}

      {gaziynie && (
        <PackCard title={text(gaziynie.title)} subtitle={text(gaziynie.subtitle)}>
          <ul className="space-y-2">
            {gaziynie.items.map((it) => (
              <li key={it.name} className="qp-card qp-card--static p-3.5">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-xs font-bold text-teal-800">{it.n}.</span>
                  {it.titleId ? (
                    <Link to={`/dictionary/${it.titleId}`} className="font-display text-lg text-ink no-underline hover:text-teal-900">
                      {it.name}
                    </Link>
                  ) : (
                    <span className="font-display text-lg text-ink">{it.name}</span>
                  )}
                </div>
                <p className="mt-1 text-sm text-ink/60">{it.gloss}</p>
              </li>
            ))}
          </ul>
        </PackCard>
      )}

      {gimn && (
        <PackCard title={text(gimn.title)} subtitle={text(gimn.subtitle)}>
          <p className="mb-3 text-sm text-ink/55">
            {text('Avtor')}: <strong>{gimn.meta?.author}</strong>
            {' · '}
            {text('Kompozitor')}: <strong>{gimn.meta?.composer}</strong>
            {gimn.titleId && (
              <>
                {' · '}
                <Link to={`/dictionary/${gimn.titleId}`} className="font-semibold text-teal-900">
                  {text('Sózlikte')}
                </Link>
              </>
            )}
          </p>
          <div className="qp-card qp-card--static space-y-1 p-4 font-display text-base leading-relaxed text-ink/80">
            {(gimn.lyrics || []).map((line, i) =>
              line ? (
                <p key={i}>{line}</p>
              ) : (
                <div key={i} className="h-3" />
              )
            )}
          </div>
        </PackCard>
      )}
    </div>
  );
}
