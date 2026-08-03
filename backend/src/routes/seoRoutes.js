import express from 'express';
import { pools } from '../config/db.js';

const db = pools.tusindirme;
const router = express.Router();

// Sitemap bir soatlik keshda saqlanadi — har so'rovda 10k qatorni o'qimaslik uchun
const CACHE_TTL_MS = 60 * 60 * 1000;
let cache = { xml: null, at: 0 };

function siteOrigin() {
  const configured = process.env.SITE_ORIGIN || process.env.FRONTEND_ORIGIN || '';
  const first = configured.split(',')[0].trim();
  return (first || 'http://localhost:3000').replace(/\/$/, '');
}

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

router.get('/sitemap.xml', async (req, res, next) => {
  try {
    const now = Date.now();
    if (!cache.xml || now - cache.at > CACHE_TTL_MS) {
      const origin = siteOrigin();
      const [rows] = await db.query(
        `SELECT id, DATE_FORMAT(created_at, '%Y-%m-%d') AS lastmod
         FROM titles WHERE status = 1 ORDER BY \`order\``
      );

      const staticUrls = [
        { loc: `${origin}/`, priority: '1.0' },
        { loc: `${origin}/dictionary`, priority: '0.9' },
        { loc: `${origin}/dictionary/all`, priority: '0.8' },
        { loc: `${origin}/dictionary/game`, priority: '0.6' },
        { loc: `${origin}/quiz`, priority: '0.7' },
        { loc: `${origin}/crossword`, priority: '0.6' },
        { loc: `${origin}/books`, priority: '0.6' },
      ];

      const parts = ['<?xml version="1.0" encoding="UTF-8"?>'];
      parts.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
      for (const u of staticUrls) {
        parts.push(
          `<url><loc>${xmlEscape(u.loc)}</loc><priority>${u.priority}</priority></url>`
        );
      }
      for (const row of rows) {
        parts.push(
          `<url><loc>${xmlEscape(`${origin}/dictionary/${row.id}`)}</loc>` +
            (row.lastmod ? `<lastmod>${row.lastmod}</lastmod>` : '') +
            `<priority>0.5</priority></url>`
        );
      }
      parts.push('</urlset>');
      cache = { xml: parts.join('\n'), at: now };
    }

    res.type('application/xml').send(cache.xml);
  } catch (err) {
    next(err);
  }
});

router.get('/robots.txt', (req, res) => {
  const origin = siteOrigin();
  res.type('text/plain').send(
    ['User-agent: *', 'Allow: /', 'Disallow: /api/', '', `Sitemap: ${origin}/sitemap.xml`].join('\n')
  );
});

export default router;
