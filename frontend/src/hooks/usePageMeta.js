import { useEffect } from 'react';

const SITE = 'Sozlik — Qaraqalpaq túsindirme';
const DEFAULT_DESCRIPTION =
  'Qaraqalpaq tili túsindirme sózligi — anıqlama, sinonim, antonim hám testler.';

function setMeta(selector, attrs) {
  let el = document.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    for (const [k, v] of Object.entries(attrs.identity)) el.setAttribute(k, v);
    document.head.appendChild(el);
  }
  el.setAttribute('content', attrs.content);
}

function setCanonical(url) {
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', url);
}

// Sahifa <title>, description, OG meta va canonical ni dinamik boshqarish
export default function usePageMeta(title, description) {
  useEffect(() => {
    const fullTitle = title ? `${title} — ${SITE}` : SITE;
    document.title = fullTitle;
    setMeta('meta[property="og:title"]', {
      identity: { property: 'og:title' },
      content: fullTitle,
    });

    const short = (description || DEFAULT_DESCRIPTION).slice(0, 160);
    setMeta('meta[name="description"]', {
      identity: { name: 'description' },
      content: short,
    });
    setMeta('meta[property="og:description"]', {
      identity: { property: 'og:description' },
      content: short,
    });

    setCanonical(window.location.origin + window.location.pathname);
    setMeta('meta[property="og:url"]', {
      identity: { property: 'og:url' },
      content: window.location.origin + window.location.pathname,
    });

    return () => {
      document.title = SITE;
      setMeta('meta[name="description"]', {
        identity: { name: 'description' },
        content: DEFAULT_DESCRIPTION,
      });
      setMeta('meta[property="og:description"]', {
        identity: { property: 'og:description' },
        content: DEFAULT_DESCRIPTION,
      });
    };
  }, [title, description]);
}
