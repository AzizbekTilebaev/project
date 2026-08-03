import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import usePageData, { loadPageBundle } from '../hooks/usePageData';
import usePageMeta from '../hooks/usePageMeta';
import PageGate from '../components/PageGate';
import DictShell from '../components/dictionary/DictShell';
import { fetchKaaMonths, fetchKaaCulture } from '../api/dicts';
import { useUiScript } from '../contexts/UiScriptContext';
import { KAA } from '../i18n/kaa';
import { COUNTRY_SYMBOLS } from '../data/countrySymbols';
import { EXTRA_CULTURE_PACKS } from '../data/extraCulturePacks';

const TABS = [
  { id: 'global', labelKey: 'qiziqarliTabGlobal' },
  { id: 'belgi', labelKey: 'qiziqarliTabBelgi' },
  { id: 'ay', labelKey: 'qiziqarliTabAy' },
  { id: 'qala', labelKey: 'qiziqarliTabQala' },
  { id: 'tuwis', labelKey: 'qiziqarliTabTuwis' },
  { id: 'dastur', labelKey: 'qiziqarliTabDastur' },
];

function PackShell({ title, subtitle, children }) {
  return (
    <section className="qp-surface p-5 md:p-6 mb-5">
      <h2 className="font-display text-2xl text-ink tracking-tight">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-ink/50">{subtitle}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function NumberedList({ items, text }) {
  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <li key={it.name} className="qp-card qp-card--static p-3.5">
          <div className="flex flex-wrap items-baseline gap-2">
            {it.n != null ? <span className="text-xs font-bold text-teal-800">{it.n}.</span> : null}
            {it.titleId ? (
              <Link
                to={`/dictionary/${it.titleId}`}
                className="font-display text-lg text-ink no-underline hover:text-teal-900"
              >
                {text(it.name)}
              </Link>
            ) : (
              <span className="font-display text-lg text-ink">{text(it.name)}</span>
            )}
          </div>
          {it.gloss ? <p className="mt-1 text-sm text-ink/60">{text(it.gloss)}</p> : null}
        </li>
      ))}
    </ul>
  );
}

function BodyPack({ pack, title, subtitle, text }) {
  if (!pack) return null;
  return (
    <PackShell title={title} subtitle={subtitle}>
      {pack.meta?.date ? (
        <p className="mb-3 text-sm text-teal-900">
          <span className="text-ink/45">{text(KAA.qiziqarliSane)}: </span>
          <span className="font-semibold">{text(pack.meta.date)}</span>
        </p>
      ) : null}
      {pack.body ? <p className="text-sm leading-relaxed text-ink/70">{text(pack.body)}</p> : null}
      {pack.items?.length ? (
        <div className={pack.body ? 'mt-4' : undefined}>
          <NumberedList items={pack.items} text={text} />
        </div>
      ) : null}
      {pack.note ? <p className="mt-3 text-sm text-ink/50">{text(pack.note)}</p> : null}
    </PackShell>
  );
}

function MonthsBlock({ months, text }) {
  if (!months.length) {
    return <p className="text-sm text-ink/45">{text(KAA.qiziqarliBos)}</p>;
  }
  return (
    <PackShell title={text(KAA.qiziqarliAyTitle)} subtitle={text(KAA.qiziqarliAySub)}>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {months.map((m) => {
          const body = (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-display text-lg text-ink">{text(m.soz)}</span>
                <span className="text-lg text-ink/55" dir="rtl" lang="ar">
                  {m.arabic}
                </span>
              </div>
              <p className="mt-1 text-sm text-ink/65">{text(m.meaning)}</p>
              <p className="mt-1 text-xs font-semibold text-teal-800">{text(m.gregorianMonth)}</p>
              {m.etymology ? (
                <p className="mt-2 text-[0.7rem] leading-snug text-ink/45">{text(m.etymology)}</p>
              ) : null}
            </>
          );
          return m.titleId ? (
            <Link key={m.monthNum} to={`/dictionary/${m.titleId}`} className="qp-card block p-3.5 no-underline">
              {body}
            </Link>
          ) : (
            <div key={m.monthNum} className="qp-card qp-card--static p-3.5">
              {body}
            </div>
          );
        })}
      </div>
    </PackShell>
  );
}

function CitiesBlock({ packs, text }) {
  const bes = packs.besqala;
  const founded = packs.founded;
  const sayaxat = packs['sayaxat-7'];
  const toponim = packs['toponim-neshe'];
  if (!bes && !founded && !sayaxat && !toponim) {
    return <p className="text-sm text-ink/45">{text(KAA.qiziqarliBos)}</p>;
  }
  return (
    <>
      {bes ? (
        <PackShell title={text(KAA.qiziqarliBesTitle)} subtitle={text(KAA.qiziqarliBesSub)}>
          <div className="flex flex-wrap gap-2">
            {bes.items.map((it) => {
              const label = it.note ? `${it.name} (${it.note})` : it.name;
              return it.titleId ? (
                <Link key={it.name} to={`/dictionary/${it.titleId}`} className="qp-chip no-underline">
                  {text(label)}
                </Link>
              ) : (
                <span key={it.name} className="qp-chip">
                  {text(label)}
                </span>
              );
            })}
          </div>
        </PackShell>
      ) : null}

      {founded ? (
        <PackShell title={text(KAA.qiziqarliFoundedTitle)} subtitle={text(KAA.qiziqarliFoundedSub)}>
          <ul className="grid gap-2 sm:grid-cols-2">
            {founded.items.map((it) => (
              <li
                key={it.name}
                className="flex items-baseline justify-between gap-3 border-b border-ink/5 pb-2 text-sm"
              >
                <span className="font-medium text-ink">{text(it.name)}</span>
                <span className="shrink-0 text-xs text-teal-800">{text(it.date)}</span>
              </li>
            ))}
          </ul>
        </PackShell>
      ) : null}

      <BodyPack
        pack={sayaxat}
        title={text(KAA.qiziqarliSayaxatTitle)}
        subtitle={text(KAA.qiziqarliSayaxatSub)}
        text={text}
      />
      <BodyPack
        pack={toponim}
        title={toponim?.title || 'Toponimika'}
        subtitle={toponim?.subtitle}
        text={text}
      />
    </>
  );
}

function KinshipBlock({ packs, text }) {
  const urpaq = packs['jeti-urpaq'];
  if (!urpaq) {
    return <p className="text-sm text-ink/45">{text(KAA.qiziqarliBos)}</p>;
  }
  return (
    <PackShell title={text(KAA.qiziqarliUrpaqTitle)} subtitle={text(KAA.qiziqarliUrpaqSub)}>
      <ol className="grid gap-2 sm:grid-cols-2">
        {urpaq.items.map((it) => (
          <li key={it.name} className="qp-card qp-card--static flex items-center gap-3 p-3">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-teal-50 text-xs font-bold text-teal-900">
              {it.n}
            </span>
            {it.titleId ? (
              <Link
                to={`/dictionary/${it.titleId}`}
                className="font-semibold text-ink no-underline hover:text-teal-900"
              >
                {text(it.name)}
              </Link>
            ) : (
              <span className="font-semibold text-ink">{text(it.name)}</span>
            )}
          </li>
        ))}
      </ol>
    </PackShell>
  );
}

function GlobalBlock({ packs, text }) {
  const gaziynie = packs['jeti-gaziynie'];
  const hapte = packs['hapte-kunleri'];
  const til = packs['til-kuni'];
  const musil = packs['musulmansha-jil'];
  const olshem = packs['olshem-sozler'];
  if (!gaziynie && !hapte && !til && !musil && !olshem) {
    return <p className="text-sm text-ink/45">{text(KAA.qiziqarliBos)}</p>;
  }
  return (
    <>
      <BodyPack
        pack={gaziynie}
        title={text(KAA.qiziqarliGaziynieTitle)}
        subtitle={text(KAA.qiziqarliGaziynieSub)}
        text={text}
      />
      <BodyPack
        pack={hapte}
        title={text(KAA.qiziqarliHapteTitle)}
        subtitle={text(KAA.qiziqarliHapteSub)}
        text={text}
      />
      <BodyPack
        pack={til}
        title={text(KAA.qiziqarliTilKuniTitle)}
        subtitle={text(KAA.qiziqarliTilKuniSub)}
        text={text}
      />
      <BodyPack
        pack={musil}
        title={musil?.title || 'Musılmansha jıl atamaları'}
        subtitle={musil?.subtitle}
        text={text}
      />
      <BodyPack
        pack={olshem}
        title={olshem?.title || 'Ólshem sózler'}
        subtitle={olshem?.subtitle}
        text={text}
      />
    </>
  );
}

function DasturBlock({ packs, text }) {
  const aydar = packs.aydar;
  const enshi = packs.enshi;
  const tagam = packs['milliy-tagam'];
  const quraq = packs.quraq;
  const qumay = packs['qumay-aniz'];
  if (!aydar && !enshi && !tagam && !quraq && !qumay) {
    return <p className="text-sm text-ink/45">{text(KAA.qiziqarliBos)}</p>;
  }
  return (
    <>
      <BodyPack
        pack={aydar}
        title={text(KAA.qiziqarliAydarTitle)}
        subtitle={text(KAA.qiziqarliAydarSub)}
        text={text}
      />
      <BodyPack
        pack={enshi}
        title={text(KAA.qiziqarliEnshiTitle)}
        subtitle={text(KAA.qiziqarliEnshiSub)}
        text={text}
      />
      <BodyPack
        pack={tagam}
        title={text(KAA.qiziqarliTagamTitle)}
        subtitle={text(KAA.qiziqarliTagamSub)}
        text={text}
      />
      <BodyPack
        pack={quraq}
        title={text(KAA.qiziqarliQuraqTitle)}
        subtitle={text(KAA.qiziqarliQuraqSub)}
        text={text}
      />
      <BodyPack
        pack={qumay}
        title={text(KAA.qiziqarliQumayTitle)}
        subtitle={text(KAA.qiziqarliQumaySub)}
        text={text}
      />
    </>
  );
}

function SymbolRow({ title, adopted, image, alt, meaning, text, children }) {
  return (
    <div className="border-b border-ink/8 py-5 last:border-b-0 last:pb-0 first:pt-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="font-display text-xl text-ink tracking-tight">{title}</h3>
        {adopted ? (
          <p className="text-sm text-teal-900">
            <span className="text-ink/45">{text(KAA.qiziqarliQabul)}: </span>
            <span className="font-semibold">{text(adopted)}</span>
          </p>
        ) : null}
      </div>
      {image ? (
        <div className="mt-4 flex justify-center rounded-xl bg-ink/[0.03] p-4">
          <img
            src={image}
            alt={alt}
            className="max-h-36 w-auto object-contain drop-shadow-sm md:max-h-44"
            loading="lazy"
          />
        </div>
      ) : null}
      {meaning ? (
        <p className="mt-4 text-sm leading-relaxed text-ink/65">{text(meaning)}</p>
      ) : !children ? (
        <p className="mt-3 text-sm text-ink/40">{text(KAA.qiziqarliMeaningSoon)}</p>
      ) : null}
      {children}
    </div>
  );
}

function SymbolsBlock({ packs, text }) {
  const [country, setCountry] = useState('kaa');
  const data = COUNTRY_SYMBOLS[country];
  const gimn = packs.gimn;

  const countries = [
    { id: 'uzb', labelKey: 'qiziqarliCountryUzb' },
    { id: 'kaa', labelKey: 'qiziqarliCountryKaa' },
  ];

  return (
    <PackShell title={text(KAA.qiziqarliTabBelgi)} subtitle={text(KAA.qiziqarliBelgiSub)}>
      <div className="mb-5 flex gap-2" role="tablist" aria-label={text(KAA.qiziqarliTabBelgi)}>
        {countries.map((c) => {
          const active = country === c.id;
          return (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setCountry(c.id)}
              className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition sm:flex-none sm:min-w-[10rem] ${
                active
                  ? 'bg-teal-800 text-white shadow-sm'
                  : 'border border-ink/10 bg-white/70 text-ink/65 hover:bg-white hover:text-teal-900'
              }`}
            >
              {text(KAA[c.labelKey])}
            </button>
          );
        })}
      </div>

      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-2xl text-ink tracking-tight">{text(data.name)}</h3>
        <a
          href={data.wiki}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold text-teal-900 underline underline-offset-2"
        >
          {text(KAA.qiziqarliWiki)}
        </a>
      </div>

      <div className="mb-5 space-y-2 rounded-xl bg-ink/[0.03] p-4 text-sm">
        <p>
          <span className="text-ink/45">{text(KAA.qiziqarliPaytaxt)}: </span>
          <span className="font-medium text-ink">{text(data.capital)}</span>
        </p>
        <p>
          <span className="text-ink/45">{text(KAA.qiziqarliMaydan)}: </span>
          <span className="font-medium text-ink">{text(data.area)}</span>
        </p>
        <p className="leading-relaxed text-ink/65">
          <span className="text-ink/45">{text(KAA.qiziqarliGeo)}: </span>
          {text(data.location)}
        </p>
      </div>

      <SymbolRow
        title={text(KAA.qiziqarliBayraq)}
        adopted={data.flag.adopted}
        image={data.flag.image}
        alt={text(data.name) + ' — ' + text(KAA.qiziqarliBayraq)}
        meaning={data.flag.meaning}
        text={text}
      />

      <SymbolRow
        title={text(KAA.qiziqarliGerb)}
        adopted={data.emblem.adopted}
        image={data.emblem.image}
        alt={text(data.name) + ' — ' + text(KAA.qiziqarliGerb)}
        meaning={data.emblem.meaning}
        text={text}
      />

      <SymbolRow
        title={text(KAA.qiziqarliGimnTitle)}
        adopted={data.anthem.adopted}
        meaning={data.anthem.meaning}
        text={text}
      >
        {(() => {
          const author = data.anthem.useCultureGimn ? gimn?.meta?.author : data.anthem.author;
          const composer = data.anthem.useCultureGimn ? gimn?.meta?.composer : data.anthem.composer;
          const lyrics = data.anthem.useCultureGimn ? gimn?.lyrics : data.anthem.lyrics;
          const titleId = data.anthem.useCultureGimn ? gimn?.titleId : null;
          if (!lyrics?.length && !author && !composer) return null;
          return (
            <div className="mt-4">
              {author || composer ? (
                <p className="mb-3 text-sm text-ink/55">
                  {author ? (
                    <>
                      {text(KAA.qiziqarliAvtor)}: <strong>{author}</strong>
                    </>
                  ) : null}
                  {author && composer ? ' · ' : null}
                  {composer ? (
                    <>
                      {text(KAA.qiziqarliKompozitor)}: <strong>{composer}</strong>
                    </>
                  ) : null}
                  {titleId ? (
                    <>
                      {' · '}
                      <Link to={`/dictionary/${titleId}`} className="font-semibold text-teal-900">
                        {text(KAA.qiziqarliSozlikte)}
                      </Link>
                    </>
                  ) : null}
                </p>
              ) : null}
              {lyrics?.length ? (
                <div className="space-y-1 rounded-xl bg-ink/[0.03] p-4 font-display text-base leading-relaxed text-ink/80">
                  {lyrics.map((line, i) =>
                    line ? (
                      <p key={i}>{data.anthem.useCultureGimn ? text(line) : line}</p>
                    ) : (
                      <div key={i} className="h-3" />
                    )
                  )}
                </div>
              ) : null}
            </div>
          );
        })()}
      </SymbolRow>
    </PackShell>
  );
}

export default function CultureFacts() {
  const { text } = useUiScript();
  const [tab, setTab] = useState('global');

  const { status, data, error, reload } = usePageData(
    () =>
      loadPageBundle({
        months: async () => {
          try {
            const res = await fetchKaaMonths();
            return res.data || [];
          } catch {
            return [];
          }
        },
        culture: async () => {
          try {
            const res = await fetchKaaCulture();
            return res.data || null;
          } catch {
            return null;
          }
        },
      }),
    { deps: [] }
  );

  usePageMeta(text(KAA.qiziqarliTitle), text(KAA.qiziqarliLede));

  const months = data?.months || [];
  const packs = useMemo(() => {
    const list = data?.culture?.packs || [];
    const map = Object.fromEntries(list.map((p) => [p.id, p]));
    for (const p of EXTRA_CULTURE_PACKS) {
      if (!map[p.id]) map[p.id] = p;
    }
    return map;
  }, [data?.culture]);

  return (
    <PageGate status={status} error={error} onRetry={reload} backHref="/" backLabel={text(KAA.basBet)}>
      <DictShell className="pt-24 pb-24">
        <div className="relative mx-auto max-w-4xl px-5 md:px-8 pt-6 md:pt-10">
          <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-teal-800/65">
            {text(KAA.qaraqalpaqTili)}
          </p>
          <h1 className="font-display text-4xl md:text-6xl tracking-tight text-ink">
            {text(KAA.qiziqarliTitle)}
          </h1>
          <p className="mt-3 max-w-2xl text-base md:text-lg text-ink/60 leading-relaxed">
            {text(KAA.qiziqarliLede)}
          </p>
          <p className="mt-4 text-sm text-ink/45">
            {text(KAA.qiziqarliDictHint)}{' '}
            <Link to="/dictionary" className="font-semibold text-teal-900 underline underline-offset-2">
              {text(KAA.sozlik)}
            </Link>
          </p>

          <div
            className="mt-8 -mx-1 flex gap-2 overflow-x-auto px-1 pb-2"
            role="tablist"
            aria-label={text(KAA.qiziqarliTitle)}
          >
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.id)}
                  className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                    active
                      ? 'bg-teal-800 text-white shadow-sm'
                      : 'border border-ink/10 bg-white/70 text-ink/65 hover:bg-white hover:text-teal-900'
                  }`}
                >
                  {text(KAA[t.labelKey])}
                </button>
              );
            })}
          </div>

          <div className="mt-6" role="tabpanel">
            {tab === 'global' ? <GlobalBlock packs={packs} text={text} /> : null}
            {tab === 'belgi' ? <SymbolsBlock packs={packs} text={text} /> : null}
            {tab === 'ay' ? <MonthsBlock months={months} text={text} /> : null}
            {tab === 'qala' ? <CitiesBlock packs={packs} text={text} /> : null}
            {tab === 'tuwis' ? <KinshipBlock packs={packs} text={text} /> : null}
            {tab === 'dastur' ? <DasturBlock packs={packs} text={text} /> : null}
          </div>
        </div>
      </DictShell>
    </PageGate>
  );
}
