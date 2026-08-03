import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import CommunitySuggestionRow from './CommunitySuggestionRow';
import { fetchMySuggestions } from '../api/tusindirme';
import { useUiScript } from '../contexts/UiScriptContext';
import { KAA } from '../i18n/kaa';
import { AnimChevron, anim } from '../animations';

/** Profile — soft strip: meniń usınıslarım + contribute / mine CTAs. */
export default function CommunityProfileStrip({ className = '' }) {
  const { text } = useUiScript();
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchMySuggestions({ status: 'all', limit: 5 })
      .then((res) => {
        if (alive) setItems(res.suggestions || []);
      })
      .catch(() => {
        if (alive) setItems([]);
      })
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!loaded) return null;

  return (
    <div
      className={`rounded-2xl border border-teal-700/15 bg-gradient-to-br from-teal-50/70 via-white/80 to-sky-50/40 px-4 py-4 ${className}`}
    >
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-teal-800/60">
            {text(KAA.jamiyet)}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-ink">{text(KAA.jamiyetProfileTitle)}</p>
        </div>
        <Link
          to="/community?tab=mine"
          className={`inline-flex items-center gap-1.5 text-sm font-semibold text-teal-900 ${anim.underlineGrow}`}
        >
          {text(KAA.jamiyetSeeMine)}
          <AnimChevron count={2} className="opacity-60" />
        </Link>
      </div>

      {items.length === 0 ? (
        <div>
          <p className="mb-3 text-sm text-ink/50">{text(KAA.jamiyetProfileEmpty)}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/dictionary"
              className={`${anim.shine} inline-flex items-center gap-1.5 rounded-full bg-teal-900 px-3.5 py-1.5 text-xs font-bold text-white`}
            >
              <Icon name="book" /> {text(KAA.jamiyetFeedCtaDict)}
              <AnimChevron count={2} className="opacity-80" style={{ ['--dch-color']: '#ecfdf5' }} />
            </Link>
            <Link
              to="/community"
              className="inline-flex items-center gap-1.5 rounded-full border border-teal-700/25 bg-white px-3.5 py-1.5 text-xs font-bold text-teal-950"
            >
              <Icon name="users" /> {text(KAA.jamiyetSeeFeed)}
            </Link>
          </div>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((s) => (
            <CommunitySuggestionRow
              key={s.id}
              item={s}
              showSource
              showStatus
              compact
              onUpdated={(next) =>
                setItems((prev) => prev.map((row) => (row.id === next.id ? next : row)))
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}
