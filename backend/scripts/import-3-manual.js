import dotenv from 'dotenv';
import { validateTitlesArray } from '../src/validators/title.validator.js';
import TusindirmeService from '../src/services/tusindirmeService.js';
import db from '../src/config/dictionary.db.js';

dotenv.config();

// Shubhali papkadan qo'lda tekshirilgan 3 yozuv (format tuzatildi)
const items = [
  {
    soz: 'ҚАБАҚ ІІ',
    normalized: 'қабақ іі',
    descriptions: [
      {
        category: 'ат.',
        definition: 'Хожалыққа пайдаланылатуғын палыз өсимлигинен жасалған ыдыс.',
        order: 1,
        example: [
          {
            order: 1,
            example:
              'Биресе қабақтан қазанға суў куяды, биресе ошақтағы отты ысырады',
            author: 'Т.Қайыпбергенов',
          },
        ],
        idioms: [
          {
            order: 1,
            phrase: 'Суў қабақ',
            description:
              'Ишине суў куятуғын ыдыс. Қызлар суў қабағын ийнине салып, алдына түсип жол баслады («Алпамыс»).',
          },
        ],
      },
    ],
  },
  {
    soz: 'КӨК VII',
    normalized: 'көк vii',
    descriptions: [{ category: 'ат.', definition: 'Тигис.', order: 1 }],
  },
  {
    soz: 'ҚАРҚАРА ІІ',
    normalized: 'қарқара іі',
    descriptions: [{ category: 'ат.', definition: 'Кутан.', order: 1 }],
  },
];

if (!validateTitlesArray(items)) {
  console.error('AJV xato:', validateTitlesArray.errors);
  process.exit(2);
}

const service = new TusindirmeService();
const result = await service.insertNested(items);
console.log(`IMPORT: ${result.added} qo‘shildi, ${result.skipped} tashlab ketildi.`);
await db.end();
