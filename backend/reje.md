# 📋 Tusindirme Sozlik — Bajarilgan ishlar (Bugungacha)

**Loyiha:** Qoraqalpoqcha izohli lug‘at ekotizimi (Backend)
**Texnologiyalar:** Node.js, Express, MySQL2 (Raw SQL), ES Modules, AJV, JWT
**Muallif:** Aziz
**Sana:** 2026-06-17

---

## 1. Ma'lumotlar bazasi

- MySQL (`tusindirme_sozlik`) bazasi yaratilgan.
- Asosiy jadvallar: `titles`, `description`, `translations`, `examples`, `categorys`, `idioms`, `idiom_desc`, `idiom_examples`, `etimologiya`, `synonym_groups`, `synonym_group_descriptions`, `word_antonyms`, `users`, `activity_logs`, `search_logs`, `change_history`.
- Dump eksport qilinib, `baza.md` sifatida butun struktura hujjatlashtirildi.
- `translations` jadvalida foreign key (`fk_tr_desc`) to‘g‘ri o‘rnatildi.
- `categorys` jadvalidagi `Atliq` kategoriyasi alohida hujjatlashtirildi (`category-atliq.md`).

---

## 2. Backend arxitekturasi

Arxitektura quyidagi katlamlardan iborat:
- **Router** (`routes/`) — marshrutlar, middleware zanjiri.
- **Controller** (`controllers/`) — so‘rov va javob boshqaruvi.
- **Service** (`services/`) — biznes-logika (class ko‘rinishida).
- **Model** (`models/`) — raw SQL so‘rovlar (class ko‘rinishida).
- **Utils** (`utils/`) — yordamchi funksiyalar va klasslar.
- **Validators** (`validators/`) — AJV schemalar.
- **Config** (`config/`) — ma'lumotlar bazasi ulanishi.

Barcha fayllar ES Modules (`import/export`) formatida.

---

## 3. Bajarilgan modullar

### 3.1. Ma'lumotlar bazasi ulanishi
- `config/dictionary.db.js` — MySQL2 pool asosida ulanish.
- Transaction uchun `connection` olish va qaytarish mexanizmi yo‘lga qo‘yilgan.

### 3.2. ID Generator
- `utils/id.generate.js` — `IdGenerator` klassi.
- `generateShortId(length)` — hex asosida qisqa ID.
- `generateTempId(prefix)` — prefix bilan vaqtinchalik ID.

### 3.3. Response Helper
- `utils/response.js` — `ResponseHelper` klassi.
- `success(res, data, message, statusCode)`
- `error(res, message, statusCode, errors)`

### 3.4. Model qatlami (`TusindirmeModel`)
`models/tusindirme.model.js` ichidagi metodlar:
- `getTotalSozCount()` — umumiy tasdiqlangan so‘zlar soni.
- `getSozler(limit, offset)` — sahifalangan so‘zlar ro‘yxati.
- `getSozById(id)` — bitta so‘z.
- `incrementViewCount(id)` — ko‘rishlar sonini oshirish.
- `getAniqlamalarBySozId(id)` — so‘zning izohlari.
- `getMisallarByAniqlamaId(aniqlamaIds)` — misollar.
- `getIdioms(aniqlamaIds)` — idiomalar.
- `getIdiomExamples(idiomIds)` — idioma misollari.
- `fulltextSearch(query, limit)` — to‘liq matnli qidiruv.
- `likeSearch(query, limit)` — LIKE asosida qidiruv.
- `logSearchStat(...)` — qidiruv statistikasi.
- `getSozlerByLetter(letter, limit, offset)` — harf bo‘yicha.
- `getCountByLetter(letter)` — harf bo‘yicha son.
- `getDailyStats(days)` — kunlik statistika.
- `getTopSozler(type, limit)` — top so‘zlar.
- `getTotalCountForRandom()` — tasodifiy so‘z uchun umumiy son.
- `getRandomSoz(offset)` — tasodifiy so‘z.
- `getAlphabetStats()` — harflar statistikasi.
- `findTitleBySoz(connection, soz)` — (transaction uchun) so‘z borligini tekshirish.
- `findOrCreate(connection, name)` — kategoriya topish yoki yaratish (transaction).
- `insertTitle(connection, ...)` — title qo‘shish (transaction).
- `insertDescription(connection, ...)` — description qo‘shish (transaction).
- `insertExample(connection, ...)` — example qo‘shish (transaction).

### 3.5. Service qatlami (Query + Command)
Servislar ikkita faylga ajratilgan:
- `services/wordQuery.service.js` — barcha o‘qish operatsiyalari.
  - `getAllSozler`, `getSozById`, `searchSoz`, `getSozlerByLetter`, `getStatistics`, `getTopSozler`, `getRandomSoz`, `searchMaqal`, `getAlphabet`.
- `services/wordCommand.service.js` — barcha yozish operatsiyalari.
  - `insertNested(items)` — transaction ichida so‘z, izoh, misol qo‘shish.

### 3.6. Controller qatlami
- `controllers/tusindirme.controller.js` — `TusindirmeController` klassi.
  - Har bir metod `try/catch` bilan, `next(err)` xatolik middleware’iga uzatadi.
  - `ResponseHelper` orqali standart javob formati.

### 3.7. Router qatlami
- `routes/tusindirme.routes.js` — barcha GET marshrutlari.
  - `/sozler`, `/soz/:id`, `/search`, `/letter/:letter`, `/statistics`, `/top`, `/random`, `/maqal`, `/alphabet`.
- `routes/import.routes.js` — `/import` marshruti (POST).
  - Validatsiya (AJV) qo‘llanilgan.

### 3.8. Validatsiya
- `validators/titleImportValidator.js` — AJV asosida import uchun qat'iy schema.
  - `exampleSchema`, `descriptionSchema`, `titleItemSchema`, `titlesArraySchema`.
  - `additionalProperties: false` bilan xavfsizlik kuchaytirilgan.
  - `allowUnionTypes: true` (temp_id uchun).

### 3.9. Asosiy server fayli
- `server.js` — Express ilova, CORS, middleware’lar, router’lar ulangan.
- `dotenv/config` orqali `.env` o‘zgaruvchilari ishlatilgan.

---

## 4. Yechilgan asosiy muammolar

1.  **Transaction rollback ishlamasligi** — model metodlari `pool.query` o‘rniga `connection.query` ga o‘tkazildi.
2.  **Foreign key xatosi** — `translations.descriptionId` va `description.id` tiplari moslashtirildi.
3.  **Prisma’dan voz kechish** — butun loyiha raw SQL’ga o‘tkazildi.
4.  **ES Modules o‘tish** — barcha fayllar `require` dan `import/export` ga ko‘chirildi.
5.  **Class arxitekturaga o‘tish** — `class` maydonlari (class fields) va metodlar to‘g‘ri ishlatildi.
6.  **AJV validatsiya** — import uchun to‘liq schema yozildi, xatoliklar aniq ko‘rsatiladi.
7.  **`database.js` topilmasligi** — fayl yo‘li va eksport formati to‘g‘rilandi.

---

## 5. Joriy holat

- GET operatsiyalari to‘liq ishlamoqda.
- POST (import) operatsiyasi transaction bilan to‘liq ishlamoqda.
- Alifbo statistikasi (`getAlphabetStats`) barcha so‘zlar yoki status bo‘yicha filtrlash imkoniyati bilan tayyor.
- Kod to‘liq `class` va ES Modules asosida, qatlamlarga ajratilgan.

---

## 6. Keyingi qadamlar

- [ ] Update (`PATCH /words/:id`) va Delete (`DELETE /words/:id`) operatsiyalari.
- [ ] Foydalanuvchi autentifikatsiyasi (JWT login, register) — router’ga ulangan.
- [ ] Izohlar (comments) moduli.
- [ ] Tarjimon moduli (Apertium qoidalarisiz, o‘z lug‘at asosida).
- [ ] Frontend (React yoki oddiy HTML).
- [ ] Swagger/OpenAPI hujjatlashtirish.
- [ ] Testlar (Jest yoki Vitest).