/**
 * Kitapxana — tańlawlı (kurator) kitap ID leri.
 * Tártip saqlanadı; DB’da joq bolsa ótkiziledi.
 */
export const FEATURED_BOOK_IDS = [
  'qirq-qiz',
  'berdaq',
  'ajiniyaz',
  'kunxoja',
  'ibrayim-yusupov',
  'qaipbergenov',
];

/**
 * @param {Array<{ id: string, sourceType?: string, isHidden?: boolean }>} books
 * @param {number} [limit=6]
 */
export function pickFeaturedBooks(books, limit = 6) {
  const list = Array.isArray(books) ? books.filter((b) => b && !b.isHidden) : [];
  if (!list.length) return [];
  const byId = new Map(list.map((b) => [String(b.id), b]));
  const picked = [];
  const seen = new Set();

  for (const id of FEATURED_BOOK_IDS) {
    const book = byId.get(String(id));
    if (!book || seen.has(book.id)) continue;
    picked.push(book);
    seen.add(book.id);
    if (picked.length >= limit) return picked;
  }

  // Tolıqtırıw: tekst kitaplardan, keyin qalǵanlardan
  const rest = list
    .filter((b) => !seen.has(b.id))
    .sort((a, b) => {
      const aText = a.sourceType === 'text' ? 0 : 1;
      const bText = b.sourceType === 'text' ? 0 : 1;
      return aText - bText;
    });

  for (const book of rest) {
    picked.push(book);
    if (picked.length >= limit) break;
  }
  return picked;
}
