const BASE = process.env.API_BASE || 'http://localhost:5000/api/tusindirme';

const QUERIES = [
  'jaqsi',        // lotin, diakritikasiz -> ЖАҚСЫ
  'jaqsı',        // lotin, diakritikali
  'sóz',          // lotin -> СӨЗ
  'soz',          // lotin diakritikasiz
  'qarǵa',        // lotin -> ҚАРҒА/ҒАРҒА
  'shahar',       // sh digrafi
  'ЖАҚСЫ',        // kirill (eski yo'l buzilmaganini tekshirish)
  'китап',        // kirill oddiy
  'kitap',        // lotin
];

for (const q of QUERIES) {
  const res = await fetch(`${BASE}/search?q=${encodeURIComponent(q)}&limit=5`);
  const json = await res.json();
  const words = (json.data || []).map((w) => w.soz);
  const sugg = (json.suggestions || []).map((w) => w.soz);
  console.log(
    `${q.padEnd(10)} [${json.searchType}] ->`,
    words.length ? words.join(', ') : `(takliflar: ${sugg.join(', ') || 'yo‘q'})`
  );
}
