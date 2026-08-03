import dotenv from 'dotenv';
dotenv.config();
import db from '../src/config/dictionary.db.js';
import TusindirmeService from '../src/services/tusindirmeService.js';

const [rows] = await db.query(
  "SELECT id, soz FROM titles WHERE soz LIKE ?",
  ['АБСОЛЮТ%']
);
console.log('before', rows);

await db.query(
  "UPDATE titles SET soz = ?, normalized = ? WHERE soz = ?",
  ['АБСОЛЮТ І', 'абсолют і', 'АБСОЛЮТ']
);

const service = new TusindirmeService();
const result = await service.insertNested([
  {
    soz: 'АБСОЛЮТ ІІ',
    normalized: 'абсолют іі',
    descriptions: [
      {
        category: 'кел.',
        definition: 'Тураклы, тыянаклы.',
        order: 1,
      },
    ],
  },
  {
    soz: 'АБСОЛЮТ ІІІ',
    normalized: 'абсолют ііі',
    descriptions: [
      {
        category: 'ат.',
        definition:
          'Идеалистлик философияда ҳәмме нәрсениң мәңги ҳәм өзгермес негизинин ҳақыйқатлығы.',
        order: 1,
      },
    ],
  },
]);

console.log('insert', result);
const [after] = await db.query(
  "SELECT id, soz FROM titles WHERE soz LIKE ?",
  ['АБСОЛЮТ%']
);
console.log('after', after);
await db.end();
