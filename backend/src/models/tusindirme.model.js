import { pools } from '../config/db.js';

const db = pools.tusindirme;
import { POS_LIST, THEME_LIST, getPosBySlug, getThemeBySlug } from '../config/dictionaryTaxonomy.js';
import searchFold from '../utils/searchFold.js';

/** LIKE wildcardsni escape — foydalanuvchi %/_ yuborsa keng scan bo'lmasin */
function escapeLike(s) {
  return String(s || '').replace(/[!%_]/g, (ch) => `!${ch}`);
}

const FIRST_SENSE_SELECT = `
  s.id, s.soz, s.normalized, s.st_let, s.views_count, s.created_at,
  (SELECT d.description FROM description d
   WHERE d.titles_id = s.id ORDER BY d.sort_order LIMIT 1) AS birinshi_aniqlama,
  (SELECT c.name FROM description d
   LEFT JOIN categorys c ON d.categorys_id = c.id
   WHERE d.titles_id = s.id ORDER BY d.sort_order LIMIT 1) AS category`;

class TusindirmeModel {

  // tekserilgen sozler sanin sanaw ushin
  getTotalSozCount = async () => {
    const [[{ total }]] = await db.query(
      "SELECT COUNT(*) as total FROM titles WHERE status = 1"
    );
    return total;
  };

  // titles (tekserilgen sozlerdi aliw) — birinchi anıqlama bilan
  getSozler = async (limit, offset) => {
    const [rows] = await db.query(
      `SELECT ${FIRST_SENSE_SELECT}
       FROM titles s
       WHERE s.status = 1
       ORDER BY s.\`order\`
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    return rows;
  };

  // id arqali tekserilgen sozdi aliw -- id, soz, views_count, created_at
  getSozById = async (id) => {
    const [[row]] = await db.query(
      "SELECT id, soz, views_count, created_at FROM titles WHERE id = ? AND status = 1",
      [id]
    );
    return row;
  };

  // korilgen sanin kobeytiw. views_count
  incrementViewCount = async (id) => {
    await db.query("UPDATE titles SET views_count = views_count + 1 WHERE id = ?", [id]);
  };

  // Alifbo bo'yicha qo'shni so'zlar (omonim sheriklar o'tkazib yuboriladi,
  // chunki ular bitta sahifada birga ko'rsatiladi)
  getNeighbors = async (id, baseSoz) => {
    const [[cur]] = await db.query('SELECT `order` FROM titles WHERE id = ?', [id]);
    if (!cur) return { prev: null, next: null };
    const esc = baseSoz.replace(/([.^$*+?()[\]{}|\\])/g, '\\$1');
    const sameGroup = `(soz = ? OR soz REGEXP CONCAT('^', ?, '[[:space:]](I|II|III|IV|V|VI|VII|\u0406|\u0406\u0406|\u0406\u0406\u0406|\u0406V|V\u0406|V\u0406\u0406)$'))`;
    const [[prev]] = await db.query(
      `SELECT id, soz FROM titles WHERE status = 1 AND \`order\` < ? AND NOT ${sameGroup}
       ORDER BY \`order\` DESC LIMIT 1`,
      [cur.order, baseSoz, esc]
    );
    const [[next]] = await db.query(
      `SELECT id, soz FROM titles WHERE status = 1 AND \`order\` > ? AND NOT ${sameGroup}
       ORDER BY \`order\` ASC LIMIT 1`,
      [cur.order, baseSoz, esc]
    );
    return { prev: prev || null, next: next || null };
  };

  // Kun so'zi: sifatli (ta'rif + avtorli misolga ega) so'zlardan deterministik tanlov
  getWordOfDay = async (seed) => {
    const [[{ n }]] = await db.query(
      `SELECT COUNT(DISTINCT t.id) n FROM titles t
       JOIN description d ON d.titles_id = t.id
       JOIN examples e ON e.descriptions_id = d.id
       WHERE t.status = 1 AND e.author IS NOT NULL AND e.author != ''
         AND CHAR_LENGTH(d.description) > 20`
    );
    if (!n) return null;
    const offset = seed % n;
    const [[row]] = await db.query(
      `SELECT DISTINCT t.id, t.soz, t.\`order\` FROM titles t
       JOIN description d ON d.titles_id = t.id
       JOIN examples e ON e.descriptions_id = d.id
       WHERE t.status = 1 AND e.author IS NOT NULL AND e.author != ''
         AND CHAR_LENGTH(d.description) > 20
       ORDER BY t.\`order\`
       LIMIT 1 OFFSET ?`,
      [offset]
    );
    return row || null;
  };

  // O'zakdosh so'zlar: bosh so'z bilan boshlanadigan boshqa so'zlar
  findRelatedByPrefix = async (baseSoz, limit = 8) => {
    const esc = baseSoz.replace(/([.^$*+?()[\]{}|\\])/g, '\\$1');
    const [rows] = await db.query(
      `SELECT id, soz FROM titles
       WHERE status = 1
         AND soz LIKE CONCAT(?, '%')
         AND soz != ?
         AND soz NOT REGEXP CONCAT('^', ?, '[[:space:]](I|II|III|IV|V|VI|VII|\u0406|\u0406\u0406|\u0406\u0406\u0406|\u0406V|V\u0406|V\u0406\u0406)$')
       ORDER BY \`order\`
       LIMIT ?`,
      [baseSoz, baseSoz, esc, limit]
    );
    return rows;
  };

  // Omonimlar: "BAZA", "BAZA І", "BAZA ІІ" ... (kiril І va lotin I aralash bo'lishi mumkin)
  findHomonyms = async (baseSoz) => {
    const [rows] = await db.query(
      `SELECT id, soz FROM titles
       WHERE status = 1
         AND (soz = ? OR soz REGEXP CONCAT('^', ?, '[[:space:]](I|II|III|IV|V|VI|VII|\u0406|\u0406\u0406|\u0406\u0406\u0406|\u0406V|V\u0406|V\u0406\u0406)$'))
       ORDER BY \`order\``,
      [baseSoz, baseSoz.replace(/([.^$*+?()[\]{}|\\])/g, '\\$1')]
    );
    return rows;
  };

  // ------------------- ANIQLAMALAR va MISALLAR -------------------
  getAniqlamalarBySozId = async (sozId) => {
    const [rows] = await db.query(
      `SELECT d.id, d.sort_order, c.name AS category, d.description
      FROM description d
      LEFT JOIN categorys c ON d.categorys_id = c.id
      WHERE titles_id = ?
      ORDER BY sort_order`,
      [sozId]
    );
    return rows;
  };

  // 2. Berilgen aniqlamalar idlari boyinsha misallardi aliw
getMisallarByAniqlamaId = async (aniqlamaIds) => {
  if (!aniqlamaIds.length) return [];
  const placeholders = aniqlamaIds.map(() => '?').join(',');
  const [misallar] = await db.query(
    `SELECT descriptions_id, id, sort_order, example, author, created_at FROM examples 
     WHERE is_approved = 1 AND descriptions_id IN (${placeholders})
     ORDER BY descriptions_id, sort_order`,
    aniqlamaIds
  );
  return misallar;
};

// 3. fraziologizmlerdi aliw
getIdioms = async (aniqlamaIds) => {
  if (!aniqlamaIds.length) return [];
  const placeholders = aniqlamaIds.map(() => '?').join(',');
  const [idioms] = await db.query(
    `SELECT * FROM idioms 
    WHERE descriptions_id IN (${placeholders})
    ORDER BY descriptions_id, sort_order`,
    aniqlamaIds
  );
  return idioms;
}

// fraziologizm manislerin aliw
getIdiomDesc = async(idiomIds) => {
  if (!idiomIds.length) return [];
  const placeholders = idiomIds.map(() => '?').join(',');
  const [idiomDesc] = await db.query(
    `SELECT * FROM idiom_desc 
       WHERE idioms_id IN (${placeholders})
       ORDER BY idioms_id, created_at, id`,
    idiomIds
  );
  return idiomDesc;
}

  // ------------------- SINONIMLER / ANTONIMLER -------------------
  // Juftlik DBda bir marta saqlanadi; so'z qaysi tomonda bo'lishidan qat'i nazar qaytadi.
  getWordRelations = async (titleIds) => {
    if (!titleIds?.length) return [];
    const placeholders = titleIds.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT
         wr.id AS relationId,
         wr.relation_type AS type,
         wr.note,
         CASE
           WHEN wr.source_title_id IN (${placeholders}) THEN target.id
           ELSE source.id
         END AS id,
         CASE
           WHEN wr.source_title_id IN (${placeholders}) THEN target.soz
           ELSE source.soz
         END AS soz
       FROM word_relations wr
       JOIN titles source ON source.id = wr.source_title_id AND source.status = 1
       JOIN titles target ON target.id = wr.target_title_id AND target.status = 1
       WHERE wr.source_title_id IN (${placeholders})
          OR wr.target_title_id IN (${placeholders})
       ORDER BY wr.relation_type DESC, soz`,
      [...titleIds, ...titleIds, ...titleIds, ...titleIds]
    );
    return rows;
  };

  // ------------------- SÓZ OYINI (quiz) -------------------
  /**
   * O'yin uchun yaroqli (so'z, ta'rif) juftliklari: qisqa emas, uzun emas,
   * havola/grammatik forma emas — tasodifiy tanlanadi.
   */
  /**
   * Berilgan title_id lar ushın oyın juftligi (unatqanlar / qáteler mashqı).
   * Ta'rif uzunlıǵı biraz keńirek — saqlanǵan sózdiń ózi áhmiyetli.
   */
  getQuizPoolByTitleIds = async (titleIds) => {
    if (!titleIds?.length) return [];
    const ids = [...new Set(titleIds.map(String).filter(Boolean))].slice(0, 40);
    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT t.id, t.soz,
              (
                SELECT d.description FROM description d
                WHERE d.titles_id = t.id
                  AND CHAR_LENGTH(d.description) BETWEEN 15 AND 400
                  AND d.description NOT LIKE 'к.%'
                  AND d.description NOT LIKE 'қ.%'
                ORDER BY d.sort_order
                LIMIT 1
              ) AS description,
              (
                SELECT c.name FROM description d
                LEFT JOIN categorys c ON d.categorys_id = c.id
                WHERE d.titles_id = t.id
                ORDER BY d.sort_order
                LIMIT 1
              ) AS category
       FROM titles t
       WHERE t.status = 1 AND t.id IN (${placeholders})`,
      ids
    );
    const byId = new Map(
      rows.filter((r) => r.description).map((r) => [String(r.id), r])
    );
    return ids.map((id) => byId.get(String(id))).filter(Boolean);
  };

  getQuizPool = async (limit) => {
    // ORDER BY RAND() o'rniga: tasodifiy offset + keyingi oyna
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total
       FROM titles t
       JOIN description d ON d.titles_id = t.id
       LEFT JOIN categorys c ON d.categorys_id = c.id
       WHERE t.status = 1
         AND CHAR_LENGTH(d.description) BETWEEN 35 AND 200
         AND (c.name IS NULL OR c.name != 'грамм. форма')
         AND d.description NOT LIKE 'к.%'
         AND d.description NOT LIKE 'қ.%'
         AND d.description NOT LIKE '%дәрежеси.%'
         AND d.description NOT LIKE '%фейили%'`
    );
    if (!total) return [];
    const take = Math.min(limit, total);
    const maxOffset = Math.max(0, total - take);
    const offset = Math.floor(Math.random() * (maxOffset + 1));
    const [rows] = await db.query(
      `SELECT t.id, t.soz, d.description, c.name AS category
       FROM titles t
       JOIN description d ON d.titles_id = t.id
       LEFT JOIN categorys c ON d.categorys_id = c.id
       WHERE t.status = 1
         AND CHAR_LENGTH(d.description) BETWEEN 35 AND 200
         AND (c.name IS NULL OR c.name != 'грамм. форма')
         AND d.description NOT LIKE 'к.%'
         AND d.description NOT LIKE 'қ.%'
         AND d.description NOT LIKE '%дәрежеси.%'
         AND d.description NOT LIKE '%фейили%'
       ORDER BY t.\`order\`, d.sort_order
       LIMIT ? OFFSET ?`,
      [take, offset]
    );
    // Natijani aralashtirish (offset ketma-ketlikdan chiqish uchun)
    for (let i = rows.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rows[i], rows[j]] = [rows[j], rows[i]];
    }
    return rows;
  };

  // ------------------- QIDIRUV (LIKE + ta'rif bo'yicha) -------------------
  /** Title topilmasa — ta'rif matnidan yumshoq qidiruv (joriy schema) */
  descriptionSearch = async (query, limit) => {
    const q = `%${escapeLike(query)}%`;
    const [rows] = await db.query(
      `SELECT ${FIRST_SENSE_SELECT}
       FROM titles s
       WHERE s.status = 1
         AND EXISTS (
           SELECT 1 FROM description d
           WHERE d.titles_id = s.id AND d.description LIKE ? ESCAPE '!'
         )
       ORDER BY s.\`order\`
       LIMIT ?`,
      [q, limit]
    );
    return rows;
  };

  /** Prefiks — indeks do‘stona (`soz%`); avvalo shu, keyin contains. */
  prefixSearch = async (query, limit, foldedQuery = null) => {
    const eq = escapeLike(query);
    const folded = escapeLike(foldedQuery || query.toLowerCase());
    const [rows] = await db.query(
      `SELECT s.id, s.soz, s.normalized, s.st_let, s.views_count, s.created_at,
              (SELECT d.description FROM description d
               WHERE d.titles_id = s.id ORDER BY d.sort_order LIMIT 1) AS birinshi_aniqlama,
              (SELECT c.name FROM description d
               LEFT JOIN categorys c ON d.categorys_id = c.id
               WHERE d.titles_id = s.id ORDER BY d.sort_order LIMIT 1) AS category
       FROM titles s
       WHERE s.status = 1
         AND (s.soz LIKE ? ESCAPE '!' OR s.normalized LIKE ? ESCAPE '!' OR s.search_key LIKE ? ESCAPE '!')
       ORDER BY CHAR_LENGTH(s.soz), s.\`order\`
       LIMIT ?`,
      [`${eq}%`, `${escapeLike((foldedQuery || query).toLowerCase())}%`, `${folded}%`, limit]
    );
    return rows;
  };

  likeSearch = async (query, limit, foldedQuery = null) => {
    const eq = escapeLike(query);
    const folded = escapeLike(foldedQuery || query.toLowerCase());
    // Avvalo prefiks (LIKE 'kitap%') — full table scan emas
    if (String(query).trim().length >= 2) {
      const prefixRows = await this.prefixSearch(query, limit, foldedQuery);
      if (prefixRows.length >= Math.min(limit, 8)) return prefixRows;
      if (prefixRows.length > 0 && String(query).trim().length <= 3) return prefixRows;
    }
    const q = `%${eq}%`;
    const fq = `%${folded}%`;
    const [rows] = await db.query(
      `SELECT s.id, s.soz, s.normalized, s.st_let, s.views_count, s.created_at,
              (SELECT d.description FROM description d
               WHERE d.titles_id = s.id ORDER BY d.sort_order LIMIT 1) AS birinshi_aniqlama,
              (SELECT c.name FROM description d
               LEFT JOIN categorys c ON d.categorys_id = c.id
               WHERE d.titles_id = s.id ORDER BY d.sort_order LIMIT 1) AS category
       FROM titles s
       WHERE s.status = 1
         AND (s.soz LIKE ? ESCAPE '!' OR s.normalized LIKE ? ESCAPE '!' OR s.search_key LIKE ? ESCAPE '!')
       ORDER BY
         CASE
           WHEN s.soz LIKE ? ESCAPE '!' THEN 0
           WHEN s.normalized LIKE ? ESCAPE '!' THEN 1
           WHEN s.search_key LIKE ? ESCAPE '!' THEN 2
           ELSE 3
         END,
         CHAR_LENGTH(s.soz),
         s.\`order\`
       LIMIT ?`,
      [q, q, fq, `${eq}%`, `${escapeLike(query.toLowerCase())}%`, `${folded}%`, limit]
    );
    return rows;
  };

  findTitlesBySozList = async (sozList) => {
    if (!sozList?.length) return [];
    const placeholders = sozList.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT id, soz, normalized, st_let, views_count, created_at
       FROM titles
       WHERE status = 1 AND soz IN (${placeholders})`,
      sozList
    );
    // preserve curated order
    const map = Object.fromEntries(rows.map((r) => [r.soz, r]));
    return sozList.map((s) => map[s]).filter(Boolean);
  };

  // Curated (premium-50) so‘zlar — `title_id` da UUID yoki so‘z matni saqlangan bo‘lishi mumkin
  getCuratedSozList = async () => {
    try {
      const [rows] = await db.query(
        `SELECT COALESCE(t.soz, cw.title_id) AS soz
         FROM curated_words cw
         LEFT JOIN titles t ON t.id = cw.title_id
         ORDER BY cw.sort_order ASC, cw.id ASC`
      );
      return rows.map((r) => r.soz).filter(Boolean);
    } catch {
      return [];
    }
  };

  // ------------------- ALPHABET -------------------
  // Qaraqalpaq alifbosi tartibi (MySQL kolatsiyasi buni bilmaydi)
  static KK_ALPHABET = 'АӘБВГҒДЕЁЖЗИЙКҚЛМНҢОӨПРСТУҮЎФХҲЦЧШЩЪЫІЬЭЮЯ';

  getAlphabetStats = async () => {
    const letters = TusindirmeModel.KK_ALPHABET.split('');
    const fieldList = letters.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT 
    st_let as arip,
    COUNT(*) as jami,
    SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as tastiyiqlangan,
    SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) as tastiyiqlanbagan
FROM titles
GROUP BY st_let
ORDER BY FIELD(st_let, ${fieldList});`,
      letters
    );
    return rows;
  };

  // ------------------- MAQAL-MATEL -------------------
  getLatestMaqal = async (limit) => {
    const [rows] = await db.query(
      `SELECT m.*,
              GROUP_CONCAT(s.soz ORDER BY s.soz SEPARATOR ', ') as baylanisli_sozler
       FROM maqal_mateller m
       LEFT JOIN maqal_sozler ms ON m.id = ms.maqal_id
       LEFT JOIN titles s ON ms.soz_id = s.id
       GROUP BY m.id
       ORDER BY m.qosilgan_waqit DESC
       LIMIT ?`,
      [limit]
    );
    return rows;
  };

  searchMaqalFulltext = async (query, limit) => {
    const [rows] = await db.query(
      `SELECT m.*,
              GROUP_CONCAT(s.soz ORDER BY s.soz SEPARATOR ', ') as baylanisli_sozler,
              MATCH(m.maqal) AGAINST(? IN NATURAL LANGUAGE MODE) as relevance
       FROM maqal_mateller m
       LEFT JOIN maqal_sozler ms ON m.id = ms.maqal_id
       LEFT JOIN titles s ON ms.soz_id = s.id
       WHERE MATCH(m.maqal) AGAINST(? IN NATURAL LANGUAGE MODE)
       GROUP BY m.id
       ORDER BY relevance DESC
       LIMIT ?`,
      [query, query, limit]
    );
    return rows;
  };

  // ------------------- TOP SOZLAR (statistika jadvalidan) -------------------
  // Eng ko'p ko'rilgan so'zlar (joriy schema: titles.views_count)
  getTopSozler = async (type, limit) => {
    const [rows] = await db.query(
      `SELECT ${FIRST_SENSE_SELECT}
       FROM titles s
       WHERE s.status = 1 AND s.views_count > 0
       ORDER BY s.views_count DESC, s.\`order\`
       LIMIT ?`,
      [limit]
    );
    return rows;
  };

  // ------------------- LETTER FILTER -------------------
  getSozlerByLetter = async (letter, limit, offset) => {
    const lit = String(letter || '').charAt(0);
    const [rows] = await db.query(
      `SELECT ${FIRST_SENSE_SELECT}
       FROM titles s
       WHERE s.status = 1 AND s.st_let = ?
       ORDER BY s.\`order\`
       LIMIT ? OFFSET ?`,
      [lit, limit, offset]
    );
    return rows;
  };

  // ------------------- POS (so'z turkumi) -------------------
  _posCategoryClause = (pos) => {
    if (pos.nullCategory) {
      const likes = pos.like.map(() => 'LOWER(c.name) LIKE ?').join(' OR ');
      return {
        sql: `(d.categorys_id IS NULL OR c.name IS NULL OR LOWER(TRIM(c.name)) IN ('белгисиз','belgisiz') OR ${likes})`,
        params: pos.like.map((p) => p.toLowerCase()),
      };
    }
    const likes = pos.like.map(() => 'LOWER(c.name) LIKE ?').join(' OR ');
    return {
      sql: `(${likes})`,
      params: pos.like.map((p) => p.toLowerCase()),
    };
  };

  getPosStats = async () => {
    const selects = [];
    const queryParams = [];
    for (const [index, pos] of POS_LIST.entries()) {
      const { sql, params: clauseParams } = this._posCategoryClause(pos);
      selects.push(`COUNT(DISTINCT CASE WHEN ${sql} THEN s.id END) AS pos_${index}`);
      queryParams.push(...clauseParams);
    }
    const [[row]] = await db.query(
      `SELECT ${selects.join(', ')}
       FROM titles s
       JOIN description d ON d.titles_id = s.id
       LEFT JOIN categorys c ON d.categorys_id = c.id
       WHERE s.status = 1`,
      queryParams
    );
    return POS_LIST.map((pos, index) => ({
        slug: pos.slug,
        label: pos.label,
        count: Number(row[`pos_${index}`]) || 0,
      }));
  };

  getSozlerByPos = async (posSlug, limit, offset) => {
    const pos = getPosBySlug(posSlug);
    if (!pos) return [];
    const { sql, params } = this._posCategoryClause(pos);
    const [rows] = await db.query(
      `SELECT ${FIRST_SENSE_SELECT}
       FROM titles s
       WHERE s.status = 1
         AND EXISTS (
           SELECT 1 FROM description d
           LEFT JOIN categorys c ON d.categorys_id = c.id
           WHERE d.titles_id = s.id AND ${sql}
         )
       ORDER BY s.\`order\`
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return rows;
  };

  getCountByPos = async (posSlug) => {
    const pos = getPosBySlug(posSlug);
    if (!pos) return 0;
    const { sql, params } = this._posCategoryClause(pos);
    const [[{ total }]] = await db.query(
      `SELECT COUNT(DISTINCT s.id) AS total
       FROM titles s
       JOIN description d ON d.titles_id = s.id
       LEFT JOIN categorys c ON d.categorys_id = c.id
       WHERE s.status = 1 AND ${sql}`,
      params
    );
    return Number(total) || 0;
  };

  // ------------------- THEMES (avtomatik mavzu) -------------------
  _themeWhere = (theme) => {
    const parts = [];
    const params = [];
    for (const p of theme.categoryLikes || []) {
      parts.push('LOWER(IFNULL(c.name, \'\')) LIKE ?');
      params.push(p.toLowerCase());
    }
    for (const p of theme.textLikes || []) {
      parts.push('LOWER(d.description) LIKE ?');
      params.push(p.toLowerCase());
    }
    if (!parts.length) return { sql: '1=0', params: [] };
    return { sql: `(${parts.join(' OR ')})`, params };
  };

  getThemeStats = async () => {
    const selects = [];
    const queryParams = [];
    for (const [index, theme] of THEME_LIST.entries()) {
      const { sql, params } = this._themeWhere(theme);
      selects.push(`COUNT(DISTINCT CASE WHEN ${sql} THEN s.id END) AS theme_${index}`);
      queryParams.push(...params);
    }
    const [[row]] = await db.query(
      `SELECT ${selects.join(', ')}
       FROM titles s
       JOIN description d ON d.titles_id = s.id
       LEFT JOIN categorys c ON d.categorys_id = c.id
       WHERE s.status = 1`,
      queryParams
    );
    return THEME_LIST.map((theme, index) => ({
        slug: theme.slug,
        label: theme.label,
        blurb: theme.blurb,
        count: Number(row[`theme_${index}`]) || 0,
      }));
  };

  getSozlerByTheme = async (themeSlug, limit, offset) => {
    const theme = getThemeBySlug(themeSlug);
    if (!theme) return [];
    const { sql, params } = this._themeWhere(theme);
    const [rows] = await db.query(
      `SELECT ${FIRST_SENSE_SELECT}
       FROM titles s
       WHERE s.status = 1
         AND EXISTS (
           SELECT 1 FROM description d
           LEFT JOIN categorys c ON d.categorys_id = c.id
           WHERE d.titles_id = s.id AND ${sql}
         )
       ORDER BY s.\`order\`
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return rows;
  };

  getCountByTheme = async (themeSlug) => {
    const theme = getThemeBySlug(themeSlug);
    if (!theme) return 0;
    const { sql, params } = this._themeWhere(theme);
    const [[{ total }]] = await db.query(
      `SELECT COUNT(DISTINCT s.id) AS total
       FROM titles s
       JOIN description d ON d.titles_id = s.id
       LEFT JOIN categorys c ON d.categorys_id = c.id
       WHERE s.status = 1 AND ${sql}`,
      params
    );
    return Number(total) || 0;
  };

  getCountByLetter = async (letter) => {
    const lit = String(letter || '').charAt(0);
    const [[{ total }]] = await db.query(
      'SELECT COUNT(*) as total FROM titles WHERE status = 1 AND st_let = ?',
      [lit]
    );
    return total;
  };

  suggestByPrefix = async (prefix, limit = 8, foldedPrefix = null) => {
    if (!prefix) return [];
    const p = `${escapeLike(prefix)}%`;
    const fp = `${escapeLike(foldedPrefix || prefix.toLowerCase())}%`;
    const [rows] = await db.query(
      `SELECT s.id, s.soz, s.normalized, s.st_let,
              (SELECT d.description FROM description d
               WHERE d.titles_id = s.id ORDER BY d.sort_order LIMIT 1) AS birinshi_aniqlama
       FROM titles s
       WHERE s.status = 1
         AND (s.soz LIKE ? ESCAPE '!' OR s.normalized LIKE ? ESCAPE '!' OR s.search_key LIKE ? ESCAPE '!')
       ORDER BY s.\`order\`
       LIMIT ?`,
      [p, p, fp, limit]
    );
    return rows;
  };

  /**
   * Typo/fuzzy uchun kandidatlar: folded prefix + uzunlik diapazoni.
   * Birinchi harf xato bo‘lsa — faqat uzunlik bo‘yicha kengaytirilgan pool.
   */
  fuzzyCandidatePool = async (foldedQuery, { limit = 400 } = {}) => {
    const folded = String(foldedQuery || '').trim();
    if (folded.length < 2) return [];
    const len = folded.length;
    const minLen = Math.max(2, len - 2);
    const maxLen = len + 2;
    const cap = Math.min(Math.max(Number(limit) || 400, 50), 800);
    const byId = new Map();

    const merge = (rows) => {
      for (const row of rows || []) {
        if (row?.id != null && !byId.has(row.id)) byId.set(row.id, row);
      }
    };

    const fetchPrefixed = async (prefix) => {
      if (!prefix) return [];
      const p = `${escapeLike(prefix)}%`;
      try {
        const [rows] = await db.query(
          `SELECT s.id, s.soz, s.normalized, s.search_key, s.st_let,
                  (SELECT d.description FROM description d
                   WHERE d.titles_id = s.id ORDER BY d.sort_order LIMIT 1) AS birinshi_aniqlama
           FROM titles s
           WHERE s.status = 1
             AND CHAR_LENGTH(IFNULL(s.search_key, s.normalized)) BETWEEN ? AND ?
             AND (
               s.search_key LIKE ? ESCAPE '!'
               OR s.normalized LIKE ? ESCAPE '!'
               OR LOWER(s.soz) LIKE ? ESCAPE '!'
             )
           ORDER BY CHAR_LENGTH(s.soz), s.\`order\`
           LIMIT ?`,
          [minLen, maxLen, p, p, p, cap]
        );
        return rows;
      } catch {
        return [];
      }
    };

    merge(await fetchPrefixed(folded.slice(0, Math.min(2, folded.length))));
    if (byId.size < 40) merge(await fetchPrefixed(folded.slice(0, 1)));

    // Birinchi harf noto‘g‘ri bo‘lishi mumkin — faqat uzunlik diapazoni
    if (byId.size < 24) {
      try {
        const [rows] = await db.query(
          `SELECT s.id, s.soz, s.normalized, s.search_key, s.st_let,
                  (SELECT d.description FROM description d
                   WHERE d.titles_id = s.id ORDER BY d.sort_order LIMIT 1) AS birinshi_aniqlama
           FROM titles s
           WHERE s.status = 1
             AND CHAR_LENGTH(IFNULL(s.search_key, s.normalized)) BETWEEN ? AND ?
           ORDER BY CHAR_LENGTH(s.soz), s.\`order\`
           LIMIT ?`,
          [minLen, maxLen, Math.min(cap, 350)]
        );
        merge(rows);
      } catch {
        /* ignore */
      }
    }

    return [...byId.values()];
  };

  // Havola nishonini topish (bir nechta yozuv varianti bilan)
  findTitleByNormalizedVariants = async (variants) => {
    if (!variants?.length) return null;
    const placeholders = variants.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT id, soz, normalized FROM titles
       WHERE status = 1 AND normalized IN (${placeholders})
       LIMIT 1`,
      variants
    );
    return rows[0] || null;
  };

  // OCR imlo farqlarini yutadigan qidiruv (қ=к, ғ=г, ў=ү=у, ҳ=х, ң=н)
  findTitleByFolded = async (foldedTarget) => {
    const FOLD =
      "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(normalized," +
      "'\u049B','к'),'\u0493','г'),'\u04A3','н'),'\u045E','у'),'\u04AF','у'),'\u04B1','у'),'\u04B3','х'),'\u0456','i')";
    const [rows] = await db.query(
      `SELECT id, soz, normalized FROM titles
       WHERE status = 1
         AND (${FOLD} = ? OR ${FOLD} LIKE CONCAT(?, ' %'))
       ORDER BY CASE WHEN ${FOLD} = ? THEN 0 ELSE 1 END, \`order\`
       LIMIT 1`,
      [foldedTarget, foldedTarget, foldedTarget]
    );
    return rows[0] || null;
  };

  // Bazada so'z borligini tekshirish (soz + normalized)
  findTitleBySoz = async (connection, soz, normalized = null) => {
    const norm = (normalized || soz || '').toLocaleLowerCase('kk');
    const [rows] = await connection.query(
      'SELECT id FROM titles WHERE soz = ? OR normalized = ? LIMIT 1',
      [soz, norm]
    );
    return rows[0] || null;
  };

  getFirstSensesByTitleIds = async (titleIds) => {
    if (!titleIds?.length) return [];
    const placeholders = titleIds.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT d.id, d.titles_id, d.description, c.name AS category, d.sort_order
       FROM description d
       LEFT JOIN categorys c ON c.id = d.categorys_id
       WHERE d.titles_id IN (${placeholders})
       ORDER BY d.titles_id, d.sort_order`,
      titleIds
    );
    return rows;
  };

  getSenseCountsByTitleIds = async (titleIds) => {
    if (!titleIds?.length) return [];
    const placeholders = titleIds.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT titles_id, COUNT(*) AS total
       FROM description
       WHERE titles_id IN (${placeholders})
       GROUP BY titles_id`,
      titleIds
    );
    return rows;
  };

 //category tbaiw yaki jaratiw
    findOrCreate = async (connection, name) => { 
        const [rows] = await connection.query(
            'SELECT id FROM categorys WHERE LOWER(name) = LOWER(?)',
            [name]
        );
        if (rows[0]) return rows[0].id;
        const [result] = await connection.query(
            'INSERT INTO categorys (temp_id, name, code) VALUES (?, ?, ?)',
            [`cat_${name}`, name, name.toLowerCase()]
          );
        return result.insertId;
    };

    // Title qo'shish (yangi soz vaqtincha oxiriga qo'yiladi;
    // to'liq alifbo tartibi uchun scripts/rebuild-sort-order.js ishga tushiriladi)
    insertTitle = async (connection, id, soz, normalized, st_let) => {
        await connection.query(
            `INSERT INTO titles (id, soz, normalized, search_key, st_let, \`order\`)
             VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(t2.\`order\`), 0) + 1 FROM titles t2))`,
            [id, soz, normalized, searchFold(soz), st_let]
        );
    };

    // Description qo'shish
    insertDescription = async (connection, id, titles_id, categorys_id, definition, order) => {
        await connection.query(
            'INSERT INTO description (id, titles_id, categorys_id, description, sort_order) VALUES (?, ?, ?, ?, ?)',
            [id, titles_id, categorys_id, definition, order || 1]
        );
    };

    // Misol qo'shish (ixtiyoriy)
    insertExample = async (connection, id, descId, exampleText, author, order) => {
        await connection.query(
            'INSERT INTO examples (id, descriptions_id, example, author, sort_order, is_approved) VALUES (?, ?, ?, ?, ?, 1)',
            [id, descId, exampleText, author || null, order || 1]
        );
    };

    insertIdiom = async (connection, id, descId, phrase, order) => {
        await connection.query(
            'INSERT INTO idioms (id, descriptions_id, phrase, sort_order) VALUES (?, ?, ?, ?)',
            [id, descId, phrase, order || 1]
        );
    };

    insertIdiomDesc = async (connection, id, idiomsId, description) => {
        await connection.query(
            'INSERT INTO idiom_desc (id, idioms_id, description) VALUES (?, ?, ?)',
            [id, idiomsId, description]
        );
    };

    insertEtymology = async (connection, id, titleId, etymology) => {
        await connection.query(
            `INSERT INTO etimologiya
              (id, title_id, etymology_type, original_language, root_word, description)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                id,
                titleId,
                etymology.etymology_type || 'unknown',
                etymology.original_language || null,
                etymology.root_word || null,
                etymology.description,
            ]
        );
    };

};

export default TusindirmeModel;