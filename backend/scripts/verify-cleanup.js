import db from '../src/config/dictionary.db.js';

const [t] = await db.query(
  `SELECT soz FROM titles
   WHERE soz LIKE 'comp\\_%' OR soz LIKE 'smoke\\_%' OR soz LIKE 'testsin\\_%'`
);
const [[s]] = await db.query('SELECT COUNT(*) AS n FROM community_suggestions');
const [[cw]] = await db.query('SELECT COUNT(*) AS n FROM compound_words');
console.log('leftover titles:', t.length, '| suggestions:', s.n, '| compounds:', cw.n);
await db.end();
