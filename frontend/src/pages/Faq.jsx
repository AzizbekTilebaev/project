import { useEffect, useId, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import DictShell from '../components/dictionary/DictShell';
import Icon from '../components/Icon';
import FreePlayCtaRow from '../components/FreePlayCtaRow';
import { useUiScript } from '../contexts/UiScriptContext';
import { KAA } from '../i18n/kaa';
import { FAQ_ITEMS } from '../data/siteInfo';
import { FAQ_CTAS, FOOTER_FREE_LINKS } from '../data/siteDeepLinks';
import { AnimIconDivider } from '../animations';

function FaqItem({ item, open, onToggle, panelId, buttonId }) {
  const { text } = useUiScript();
  const ctas = FAQ_CTAS[item.id] || [];
  return (
    <div id={item.id} className="scroll-mt-28 border-b border-ink/10 last:border-b-0">
      <h2 className="m-0">
        <button
          type="button"
          id={buttonId}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full items-start justify-between gap-4 py-4 text-left transition-colors hover:text-teal-900"
        >
          <span className="font-display text-lg tracking-tight text-ink sm:text-xl">
            {text(item.q)}
          </span>
          <span
            className={`mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm transition ${
              open
                ? 'border-teal-700 bg-teal-800 text-white'
                : 'border-ink/15 text-ink/50'
            }`}
            aria-hidden
          >
            {open ? '−' : '+'}
          </span>
        </button>
      </h2>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        hidden={!open}
        className="pb-4 pr-10 text-sm leading-relaxed text-ink/65 sm:text-base"
      >
        {text(item.a)}
        {open && ctas.length > 0 ? <FreePlayCtaRow links={ctas} className="mt-4" /> : null}
      </div>
    </div>
  );
}

function hashToFaqId(hash) {
  const id = String(hash || '')
    .replace(/^#/, '')
    .trim();
  if (!id) return null;
  return FAQ_ITEMS.some((x) => x.id === id) ? id : null;
}

export default function Faq() {
  const { text } = useUiScript();
  const location = useLocation();
  const baseId = useId();
  const [openId, setOpenId] = useState(() => hashToFaqId(location.hash) || FAQ_ITEMS[0]?.id || null);

  usePageMeta(text(KAA.faqTitle), text(KAA.faqLead));

  useEffect(() => {
    const fromHash = hashToFaqId(location.hash);
    if (!fromHash) return;
    setOpenId(fromHash);
    const t = window.setTimeout(() => {
      document.getElementById(fromHash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => window.clearTimeout(t);
  }, [location.hash]);

  return (
    <DictShell className="pt-24 pb-28">
      <section className="relative mx-auto max-w-2xl px-5 pt-8 sm:px-6 md:px-10">
        <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-teal-800/70">
          {text(KAA.faqEyebrow)}
        </p>
        <h1 className="mb-2 font-display text-3xl tracking-tight text-ink sm:text-4xl">
          {text(KAA.faqTitle)}
        </h1>
        <AnimIconDivider amber className="mb-3" />
        <p className="mb-8 max-w-xl text-ink/55">{text(KAA.faqLead)}</p>

        <div className="qp-surface px-4 sm:px-6">
          {FAQ_ITEMS.map((item) => (
            <FaqItem
              key={item.id}
              item={item}
              open={openId === item.id}
              onToggle={() => {
                setOpenId((cur) => {
                  const next = cur === item.id ? null : item.id;
                  if (next && typeof window !== 'undefined') {
                    window.history.replaceState(null, '', `#${next}`);
                  } else if (typeof window !== 'undefined') {
                    window.history.replaceState(null, '', window.location.pathname);
                  }
                  return next;
                });
              }}
              panelId={`${baseId}-${item.id}-panel`}
              buttonId={`${baseId}-${item.id}-btn`}
            />
          ))}
        </div>

        <div className="mt-10">
          <p className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-teal-800/55">
            {text(KAA.footerFreeEyebrow)}
          </p>
          <FreePlayCtaRow links={FOOTER_FREE_LINKS} showSoftProfile showStats />
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              to="/community"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-900 hover:underline"
            >
              <Icon name="users" /> {text(KAA.jamiyet)}
            </Link>
            <Link
              to="/about"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-900 hover:underline"
            >
              {text(KAA.aboutTitle)}
            </Link>
          </div>
        </div>
      </section>
    </DictShell>
  );
}
