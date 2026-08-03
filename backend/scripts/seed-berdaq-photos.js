import { pools } from '../src/config/db.js';
import { toCyrillic, toLatin } from '../src/utils/qqScript.js';

const db = pools.poets;

const [[writer]] = await db.query(
  `SELECT id, slug FROM literature_writers WHERE slug = 'berdaq-gargabay-uly' LIMIT 1`
);
if (!writer) {
  console.error('Berdaq tabılmadı');
  process.exit(1);
}

await db.query('DELETE FROM writer_photos WHERE writer_id = ?', [writer.id]);

const frames = [
  {
    year: 1845,
    file: 'berdaq-1845.png',
    caption:
      'Jaslıq dáwiri. Qaraqalpaq dalasındaǵı awıl kórinisi — Berdaq ómiriniń bası.',
  },
  {
    year: 1860,
    file: 'berdaq-1860.png',
    caption:
      'Jas shayır. Qoljazba hám bilim jolı — dóretiwshiliktiń dáslepki basqıshı.',
  },
  {
    year: 1880,
    file: 'berdaq-1880.png',
    caption:
      'Aqınlıq. Ot basında qosıq aytıw — xalıq penen birge bolǵan waqıt.',
  },
  {
    year: 1898,
    file: 'berdaq-1898.png',
    caption:
      'Keshki ómir. Qamıs jaǵasında oy-pikir — úlken shayırdıń sońǵı jılları.',
  },
];

let order = 0;
for (const frame of frames) {
  const url = `/uploads/writers/${frame.file}`;
  await db.query(
    `INSERT INTO writer_photos
      (writer_id, year, caption_original, caption_latin, image_url, stored_name, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      writer.id,
      frame.year,
      toCyrillic(frame.caption),
      toLatin(frame.caption),
      url,
      frame.file,
      order++,
    ]
  );
  console.log(`+ ${frame.year} ${frame.file}`);
}

console.log(`✓ Berdaq (#${writer.id}) waqıt mashinası: ${frames.length} kadr`);
process.exit(0);
