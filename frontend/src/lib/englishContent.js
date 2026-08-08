/**
 * Ingliz tili maktab MD → HTML (QQ qoidalar menen bir usıl).
 */
import { mdToHtml } from './mdToHtml';
import { cleanGrammarMarkdown } from './grammarContent';

import mdTolıq from '../../../fordata/english/english-tolıq.md?raw';
import md14 from '../../../fordata/english/english-1-4-kids.md?raw';
import md56 from '../../../fordata/english/english-5-6.md?raw';
import md79 from '../../../fordata/english/english-7-9.md?raw';
import md1011 from '../../../fordata/english/english-10-11.md?raw';
import mdG5 from '../../../fordata/english/5-klass-fly-high-grammatika.md?raw';
import mdG6 from '../../../fordata/english/6-klass-teens-grammatika.md?raw';
import mdG10 from '../../../fordata/english/10-klass-english-grammar-guide.md?raw';

export const ENGLISH_BOOKS = [
  {
    id: 'en-tolıq',
    label: 'Baǵdar',
    title: 'Inglis tili — baǵdar',
    subtitle: 'Sóz, fraza, mashq',
    markdown: mdTolıq,
  },
  {
    id: 'en-1-4',
    label: '1–4',
    title: 'Kids’ English',
    subtitle: 'Fraza + kúnlik mashq',
    markdown: md14,
  },
  {
    id: 'en-5-6',
    label: '5–6',
    title: 'Fly High · Teens',
    subtitle: 'Fraza + Present/Past',
    markdown: md56,
  },
  {
    id: 'en-g5',
    label: '5 gram.',
    title: '5-klass grammatika (QQ)',
    subtitle: 'Atlıq, artikl, kóplik…',
    markdown: mdG5,
  },
  {
    id: 'en-g6',
    label: '6 gram.',
    title: '6-klass grammatika (QQ)',
    subtitle: 'Teens’ English grammar',
    markdown: mdG6,
  },
  {
    id: 'en-7-9',
    label: '7–9',
    title: 'Teens · Fly High',
    subtitle: 'Pikir, dialog, jazıw',
    markdown: md79,
  },
  {
    id: 'en-10-11',
    label: '10–11',
    title: 'English 10–11',
    subtitle: 'B1 fraza + Passive',
    markdown: md1011,
  },
  {
    id: 'en-g10',
    label: '10 Guide',
    title: '10 Grammar Guide',
    subtitle: 'Present Simple hám basqalar (EN)',
    markdown: mdG10,
  },
];

export function englishBookHtml(book) {
  return mdToHtml(cleanGrammarMarkdown(book.markdown));
}
