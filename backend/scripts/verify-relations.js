import dotenv from 'dotenv';
import TusindirmeService from '../src/services/tusindirmeService.js';
import db from '../src/config/dictionary.db.js';

dotenv.config();

const words = [
  'КЕЛИЎ',
  'КЕТИЎ',
  'КӨТЕРИЎ',
  'ТҮСИРИЎ',
  'ҚЫЙНАЛЫЎ',
  'АЗАПЛАНЫЎ',
  'КАРҒА',
  'ҒАРҒА',
  'САҒАТ',
  'СААТ',
  'АЙҚЫНЛАЎ',
  'АНЫҚЛАЎ',
];
const service = new TusindirmeService();

for (const word of words) {
  const [[title]] = await db.query(
    'SELECT id, soz FROM titles WHERE status = 1 AND soz = ? LIMIT 1',
    [word]
  );
  if (!title) {
    console.log(`${word}: topilmadi`);
    continue;
  }
  const detail = await service.getSozById(title.id);
  console.log(
    `${word}: sinonim=[${detail.relations.synonyms.map((item) => item.soz).join(', ')}], ` +
      `antonim=[${detail.relations.antonyms.map((item) => item.soz).join(', ')}]`
  );
}

const [stats] = await db.query(
  `SELECT relation_type, source_kind, COUNT(*) AS total
   FROM word_relations
   GROUP BY relation_type, source_kind
   ORDER BY relation_type, source_kind`
);
console.log('\nStatistika:', stats);

// getSozById ko'rish statistikasini fire-and-forget yozadi; poolni yopishdan oldin tugatsin.
await new Promise((resolve) => setTimeout(resolve, 100));
await db.end();
