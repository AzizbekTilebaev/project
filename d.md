# Qaraqalpaq Til Platformasi — to‘liq ma’lumotnoma

**Fayl:** `d.md`  
**Loyiha:** `qaraqalpaq-til-platformasi`  
**Manzil:** `/home/azizbek/work/proyekt2`  
**Yangilangan:** 2026-07-29  
**Asos:** haqiqiy kod (`server.js`, `App.jsx`, `package.json`, `.env.example`) — root `README.md` / `SETUP.md` eskirgan.

---

## 1. Loyiha nima?

Qaraqalpaq tilini o‘rganish uchun **full-stack interaktiv web-platforma**:

- Túsinirme sozlik (qidiruv, harf, kun so‘zi, sevimlilar, community)
- Testlar (oddiy + adaptiv IRT + multiplayer xonalar)
- Krossvord (yakka + real-time xona)
- Ádebiyat (shoirlar, asarlar, kitoblar, o‘qish darslari + SRS)
- Jumbaqlar
- Úyretiwshi / Tutor (kunlik mashq, xatolar banki; tashqi LLM yo‘q)
- Immersion (audio tinglash / produce)
- Ball tizimi, kvotalar, anonim mehmon progressi
- Admin paneli (RBAC)
- Morfologiya (so‘zni túbir + qo‘shimtalarga bo‘lish)

UI asosan **qaraqalpaq**; lotin ↔ kirill almashtirish bor (`frontend/src/i18n/kaa.js`).

---

## 2. Yuqori darajadagi tuzilma

```
proyekt2/
├── backend/           # Express API + MySQL (mysql2) + Socket.IO
├── frontend/          # React 18 + Vite + Tailwind SPA
├── fordata/           # Import manbasi (lug‘at, kitob, jumbaq, tool’lar)
├── animations/        # CSSKit animatsiya kutubxonasi
├── tmp/               # Apertium-kaa manba/extract (morfologiya ishlanmasi)
├── .github/workflows/ # CI (frontend lint+build, backend test)
├── package.json       # Root helper: install/dev/build
├── README.md          # ESKIRGAN (Prisma, port 5173)
├── SETUP.md           # ESKIRGAN (prisma migrate)
├── CLEANUP_REPORT.md  # 2026-07 tozalash hisoboti
├── START_ALL.ps1      # Windows start (frontend porti eski: 5173)
├── ziyonet_book.pdf
└── d.md               # Shu to‘liq ma’lumotnoma
```

| Papka | Vazifa |
|--------|--------|
| **backend/** | API, 10× MySQL pool, Socket.IO, skriptlar, testlar, uploadlar |
| **frontend/** | SPA; Vite proxy `/api`, `/socket.io`, `/uploads` → `:5000`; **dev port 3000** |
| **fordata/** | Bir martalik/qayta import manbasi; runtime asosan MySQL’dan |
| **animations/** | CSSKit; frontend’da `AnimMatrixRain`, `AnimChevron` va boshqalar |
| **tmp/** | `apertium-kaa` + extract — morfologiya ishlanmasi |

---

## 3. Texnologiyalar

### Backend (`backend/package.json`)

| Texnologiya | Izoh |
|-------------|------|
| Node.js (ESM) | `"type": "module"`, entry: `src/server.js` |
| Express ^4.18 | HTTP API |
| mysql2 ^3.4 | **Prisma yo‘q** |
| Socket.IO ^4.8 | Multiplayer xonalar |
| dotenv, cors, helmet, compression | Konfig / CORS / xavfsizlik / gzip |
| express-rate-limit | Rate limit |
| multer | Fayl yuklash |
| ajv | JSON validatsiya (import) |
| nodemon, eslint | Dev |

**Port:** `5000` (default).

### Frontend (`frontend/package.json`)

| Texnologiya | Izoh |
|-------------|------|
| React 18 | UI |
| React Router 6 | Marshrutlar |
| Vite 5 | Build; **port 3000** |
| Tailwind 3 | Stil |
| socket.io-client | Realtime |

---

## 4. Backend arxitekturasi

### 4.1 Kirish nuqtasi

`backend/src/server.js`:

1. Helmet (prod CSP), CORS (`FRONTEND_ORIGIN`), compression, JSON 1mb
2. `GET /` — API indeks
3. `GET /api/health` — DB ping
4. Upload papkalarini yaratish
5. `/api` rate-limit + barcha API marshrutlari
6. `/uploads` static
7. Prod’da `frontend/dist` SPA serve
8. HTTP + Socket.IO (`attachGameSocket`)

### 4.2 API prefixlar

| Prefix | Route fayl |
|--------|------------|
| `/api/tusindirme` | `tusindirmeRoutes.js` |
| `/api/quizzes` | `quizRoutes.js` |
| `/api/books` | `booksRoutes.js` |
| `/api/rooms` | `gameRoomRoutes.js` |
| `/api/crosswords` | `crosswordRoutes.js` |
| `/api/tutor` | `tutorRoutes.js` |
| `/api/immersion` | `immersionRoutes.js` |
| `/api/literature` | `literatureRoutes.js` |
| `/api/jumbaqlar` | `jumbaqRoutes.js` |
| `/api/reading` | `readingRoutes.js` |
| `/api/morphology` | `morphologyRoutes.js` |
| `/api/points` | `pointsRoutes.js` |
| `/api/auth` | `authRoutes.js` |
| `/api/favorites` | `favoritesRoutes.js` |
| `/api/recent-words` | `recentWordsRoutes.js` |
| `/api/quotas` | `quotasRoutes.js` |
| `/api/stats` | `statsRoutes.js` |
| `/api/feedback` | `feedbackRoutes.js` |
| `/api/admin` | `adminAccountsRoutes.js` |
| `/api/v1` | `publicApiRoutes.js` |
| `/` (SEO) | `seoRoutes.js` → `/sitemap.xml`, `/robots.txt` |

### 4.3 Asosiy endpoint guruhlari

**Auth** (`/api/auth`):
- `GET /config`, `GET /me`
- `POST /register`, `/login`, `/login/totp`, `/google`, `/google/link|unlink`
- `POST /forgot-password`, `/reset-password`, `/change-password`
- `PUT /profile`, avatar, logout, sessions
- Flaglar bilan: TOTP, Google People, phone OTP

**Sozlik** (`/api/tusindirme`):
- `/sozler`, `/search`, `/letter/:letter`, `/soz/:id`, `/alphabet`, `/pos`, `/themes`
- `/dashboard`, `/random`, `/top`, `/curated`
- Kun so‘zi + check-in + combo chest
- Dict quiz: `/quiz`, `/quiz/start`, check/answer/history
- Community suggestions + vote + moderator approve
- Moderator: ghost titles, relations, compounds, senses CRUD
- `POST /import-nested` (`IMPORT_API_KEY`)

**Quiz** (`/api/quizzes`):
- Admin CRUD: `/admin`, `/admin/list`, `/admin/:id`
- Public: `GET /`, `GET /:id` (**javobsiz**), `POST /:id/start`
- Attempt: `answer` → `finalize` → `result` / `review` (+ unlock ball evaziga)
- Adaptive: `/adaptive/start`, answer/abandon, `/ability`
- Eski `POST /:id/submit` — o‘chirilgan

**Kitoblar / Adabiyot / Jumbaq / Reading / Immersion / Crossword / Rooms / Tutor / Morphology / Points** — mos prefixlar ostida list/get/CRUD, progress, SRS, multiplayer.

**Boshqalar:** favorites, recent-words, quotas, stats, feedback; admin dashboard/logs/users; public v1 API.

### 4.4 Servislar (`backend/src/services/`)

| Servis | Vazifa |
|--------|--------|
| `tusindirmeService` | Sozlik, dashboard, curated, dict quiz, community |
| `quizService` / `quizAdminService` | Urinishlar, baholash, review unlock, admin |
| `adaptiveQuizService` + `irtService` | Adaptiv test + IRT |
| `quizDictBridge` | Quiz ↔ sozlik |
| `booksService` / `bookProgressService` | E-kitoblar |
| `literatureService` / `literatureAdminService` | Shoirlar, asarlar |
| `jumbaqService` | Topishmoqlar |
| `crosswordService` / `crosswordRoomService` | Krossvord |
| `gameRoomService` / `quizRoomService` | Multiplayer |
| `readingService` / `readingLessonEngine` | O‘qish darslari + SRS |
| `tutorService` / `localTutorAiService` / `mistakeBankService` | Tutor, lokal tip’lar, xato banki |
| `immersionService` | Audio immersion |
| `dictGameService` | Sozlik o‘yini |
| `morphologyService` | Affiks segmentatsiya |
| `authService` / `totpService` / `phoneAuthService` / `googlePeopleService` | Auth |
| `actorService` | Anonim actor |
| `pointsService` / `comboChestService` / `wordOfDayCheckinService` | Ball, chest, check-in |
| `quotaService` | Mehmon kvotalari |
| `favoritesService` / `recentWordsService` | Sevimlilar / so‘nggi so‘zlar |
| `communityService` | Community |
| `statsService` / `adminDashboardService` | Statistika |
| `adminAccountsService` / `usersAdminService` | Admin RBAC |

**Middleware:**
- `auth.js` — Bearer token (`optionalAuth` / `requireAuth`)
- `actor.js` — `X-Anonymous-Id` → HMAC → `anonymous_actors`
- `rbac.js` — owner/editor/uploader/moderator
- `adminAuth.js` — legacy `ADMIN_PASSWORD` token
- `apiKey.js` — public API kalitlari
- `security.js` — rate limit, import key
- Upload middleware’lar (book, avatar, writer photo, immersion)

**Utils:** `qqScript.js` (lotin↔kirill), `actorHash.js`, `errorLogger.js`  
**Data:** `qqAffixes.js` — morfologiya affiks inventari

### 4.5 Ma’lumotlar bazasi — 10 ta `kk_*`

Konfig: `backend/src/config/db.js`. Cross-baza FK yo‘q (app darajasida bog‘lanadi).

| Baza | Env | Asosiy mazmun |
|------|-----|----------------|
| `kk_users` | `KK_USERS_DB` | Anonim actorlar, `app_users`, sessions, admin_accounts, api_clients |
| `kk_poets` | `KK_POETS_DB` | Yozuvchilar, aliaslar, book_writers |
| `kk_poetrys` | `KK_POETRYS_DB` | Kitoblar, sections, literature pieces, creative works, book_lessons |
| `kk_jumbaqlar` | `KK_JUMBAQLAR_DB` | Jumbaqlar, progress |
| `kk_tusindirme` | `KK_TUSINDIRME_DB` | Sozlik (titles, description, examples, idioms, relations, compounds, community, curated) |
| `kk_quiz` | `KK_QUIZ_DB` | Quizzes, questions, attempts, game_rooms |
| `kk_krasvord` | `KK_KRASVORD_DB` | Crosswords, stats, dict_game_rounds |
| `kk_statistika` | `KK_STATISTIKA_DB` | Events, ability, book/reading progress, **wallets**, **point_transactions** |
| `kk_ai_db` | `KK_AI_DB` | Tutor sessions, mistake_bank, immersion_assets |
| `kk_logs` | `KK_LOGS_DB` | `app_errors` |

Migratsiya: `node scripts/setup-kk-databases.js`.

### 4.6 Ball tizimi (qisqa)

- To‘g‘ri javob **+10**, tezlik bonusi **0–5**, xatosiz to‘liq test **+20**
- Takroriy urinish: 2-marta **50%**, keyin **20%**
- Daraja: L2=100, L3=300, L4=600 (`50·L·(L−1)`)
- Javob ochish pulli: savolga 5 ball (min 30) — unlock endpointlar
- Idempotensiya: `point_transactions (kind, ref_id)` UNIQUE

### 4.7 Realtime

Socket.IO (`backend/src/realtime/gameSocket.js`):
- Auth: handshake `anonymousId` / `X-Anonymous-Id`
- Events: `room:subscribe|ready|unsubscribe|leave`, `room:state`
- Frontend: `frontend/src/lib/gameSocket.js`

### 4.8 Morfologiya / Apertium

- Runtime: qoida asosidagi segmenter (`morphologyService` + `qqAffixes.js`) + sozlik verify
- API: `GET /api/morphology/analyze?word=&script=&verify=`
- Manba/ishlanma: `tmp/apertium-kaa/`, skriptlar `backend/scripts/apertium/`
- To‘liq apertium binary runtime majburiy emas

### 4.9 Muhim npm / skriptlar

```bash
npm run setup              # env + eski sxemalar
node scripts/setup-kk-databases.js
npm run setup-roles        # RBAC
npm run setup-points       # ball jadvallari
npm run setup-ecosystem.js # app_users, sessions, kvotalar (ixtiyoriy)
npm run backup / restore
npm test                   # 22 ta asosiy test fayli
npm run lint
```

Boshqa: `setup-crosswords`, `setup-quiz`, `import-literature`, `seed-curated-words`, ko‘p `audit-*` / `fix-*` skriptlar (~100+ `backend/scripts/`).

### 4.10 Testlar

**Backend `npm test`:** health, quiz, session, community, books, gameRooms, IRT, adaptive, tutor, qqScript, reading, literature, rbac, points, dict bridge, mistake bank, SRS va boshqalar.

**Frontend `npm test`:** readingPractice, crosswordMissLogic, immersionPractice, readingTapQueue, readingLessonSrs, dueRemediation, produceGrade.

**CI:** `.github/workflows/ci.yml` — frontend lint+build; backend MySQL bilan test.

---

## 5. Frontend arxitekturasi

### 5.1 Dev server

- Port: **3000**
- Proxy: `/api`, `/socket.io`, `/uploads` → `http://localhost:5000`

### 5.2 Marshrutlar (`frontend/src/App.jsx`)

| Path | Sahifa |
|------|--------|
| `/` | Home |
| `/quiz`, `/quiz/:id` | Quiz |
| `/quiz/adaptive` | AdaptiveQuiz |
| `/quiz/statistics`, `/statistics` | QuizStatistics |
| `/quiz/room`, `/quiz/room/:code` | QuizRoom |
| `/tutor` | Tutor |
| `/tutor/practice` | PracticeHub |
| `/settings` | Settings |
| `/profile` | Profile |
| `/faq`, `/about` | Faq, About |
| `/community` | CommunityFeed |
| `/login`, `/register` | AuthPage |
| `/forgot-password`, `/reset-password` | Parol tiklash |
| `/dictionary` | Dictionary |
| `/dictionary/all` | DictionaryAll |
| `/dictionary/favorites` | DictionaryFavorites |
| `/dictionary/stats` | DictionaryStats |
| `/dictionary/game` | DictionaryGame |
| `/dictionary/immersion` | ImmersionBrowse |
| `/dictionary/:id` | WordDetail |
| `/crossword`, `/crossword/:id` | CrosswordsList, CrosswordPage |
| `/crossword/room`, `/crossword/room/:code` | CrosswordRoom |
| `/literature` | LiteratureHub |
| `/games` | GamesHub |
| `/writers`, `/writers/:slug` | Writers, WriterDetail |
| `/jumbaqlar` | Jumbaqlar |
| `/books`, `/books/:id`, `/books/:id/read`, `/books/:id/learn` | Books, BookDetail, BookReader, ReadingLesson |
| `/dashboard` | Dashboard |
| `/admin` | AdminPanel |
| `/admin/crosswords` | CrosswordsAdmin |
| `/admin/immersion` | ImmersionAdmin |
| `/admin/users` | UsersAdmin |
| `/admin/quizzes` | QuizzesAdmin |
| `/admin/jumbaqlar` | JumbaqlarAdmin |
| `/admin/writers` | WritersAdmin |
| `/admin/books` | BooksAdmin |
| `/admin/lessons` | ReadingLessonsAdmin |
| `*` | NotFound |

Lazy-load + Suspense + AppErrorBoundary. Global: Header, Footer, OfflineBanner, TutorReminder, ActivityHeartbeat, ExitSurvey.

### 5.3 Contexts / hooks / API

**Contexts:** `AuthContext`, `UiScriptContext` (lotin/kirill), `AppSettingsContext` (tema: day|night|sepia|focus)

**Hooks:** `useDictionaryFavorites`, `useGoogleIdentity`, `useGuestQuota`, `usePageData`, `usePageMeta`, `useRecentWords`, `useResumeTick`

**API klientlar:** `frontend/src/api/*.js` — auth, tusindirme, quizzes, books, literature, tutor, points, …

---

## 6. `fordata/` — import manbasi

Runtime emas; lug‘at/adabiyot/jumbaq import uchun.

| Subpapka | Mazmun |
|----------|--------|
| `dict_pages_v2/` | Sahifa-bo‘yicha JSON kategoriyalar |
| `curated/` | Premium-50 meta (endi DB `curated_words` asosiy) |
| `books/` | Kitob matnlari |
| `jumbaqlar/` | Topishmoq manbalari |
| `newdata/`, `newdata-review/` | Yangi / review to‘plam |
| `compound_fixed/` | Qo‘shma so‘z tuzatishlari |
| `shayirlar latin/` | Shoirlar matnlari |
| `tools/` | Import pipeline (`validate`, `transform`, `import`, premium-50, …) |

Batafsil: `fordata/tools/README.md`.

---

## 7. Features holati

| Feature | Holat |
|---------|--------|
| Sozlik (qidiruv, harf, POS, themes) | Ha |
| Kun so‘zi + check-in + combo chest | Ha |
| Sevimlilar / so‘nggi so‘zlar | Ha (auth) |
| Community taklif + vote + moderatsiya | Ha |
| Dict quiz / Dictionary game | Ha |
| Immersion (audio) | Ha |
| Oddiy quiz (server-side grading) | Ha |
| Adaptiv quiz (IRT) | Ha |
| Multiplayer quiz/crossword rooms | Ha |
| Krossvord | Ha |
| Kitoblar + reader | Ha |
| Reading lessons + SRS | Ha |
| Adabiyot + shoirlar | Ha |
| Jumbaqlar | Ha |
| Tutor + mistake bank (lokal AI) | Ha (tashqi LLM yo‘q) |
| Ball / leaderboard / review unlock | Ha |
| Mehmon kvotalari | Ha |
| Morfologiya | Ha |
| Lotin/kirill UI | Ha |
| Google / TOTP / phone | Flag (ko‘pi default OFF) |
| Admin RBAC | Ha |
| Public API v1 | Ha |
| SEO sitemap/robots | Ha |

---

## 8. Auth modeli

### Oddiy foydalanuvchi

1. **Anonim actor:** `X-Anonymous-Id` (UUID) → `ACTOR_HMAC_SECRET` → `kk_users.anonymous_actors`
2. **Register / login:** `app_users` + `app_sessions`; Bearer token
3. **Google OAuth** (`GOOGLE_CLIENT_ID`) — ixtiyoriy
4. Flaglar (default 0): `AUTH_TOTP_2FA`, `AUTH_PHONE_LOGIN`, `AUTH_GOOGLE_PEOPLE`

Frontend: token `localStorage`; `AuthContext`.

### Admin

| Rol | Ruxsat (qisqa) |
|-----|----------------|
| **owner** | Hamma narsa |
| **editor** | Kontent (kitob, quiz, krossvord, dars, immersion, jumbaq, writers, community, stats) |
| **uploader** | Books + immersion |
| **moderator** | Community + view users/stats |

Legacy: `ADMIN_PASSWORD` → 8 soatlik token (owner). Prod: `ADMIN_DISABLE_LEGACY=1`.

Import / v1: `IMPORT_API_KEY`, `api_clients`.

---

## 9. Ishga tushirish (to‘g‘ri yo‘l)

Talablar: **Node.js 20+**, **MySQL 8+**.

```bash
# Backend
cd backend
cp .env.example .env   # yoki: npm run ensure-env
# To‘ldiring: DB_USER, DB_PASS, JWT_SECRET, ACTOR_HMAC_SECRET, ADMIN_*
# FRONTEND_ORIGIN=http://localhost:3000

npm install
npm run setup
node scripts/setup-kk-databases.js
npm run setup-roles
npm run setup-points
npm run dev            # http://localhost:5000

# Frontend (boshqa terminal)
cd frontend
npm install
npm run dev            # http://localhost:3000
```

Root:
```bash
npm run install:all
npm run dev:backend
npm run dev:frontend
npm run build:frontend
```

### Muhim env (`.env.example`)

```
DB_HOST / DB_PORT / DB_USER / DB_PASS
JWT_SECRET
ACTOR_HMAC_SECRET
ADMIN_PASSWORD / ADMIN_SESSION_SECRET
FRONTEND_ORIGIN=http://localhost:3000
SITE_ORIGIN=http://localhost:3000
PORT=5000
IMPORT_API_KEY=          # ixtiyoriy
GOOGLE_CLIENT_ID=        # ixtiyoriy
```

Legacy URL’lar (`DATABASE_URL`, `DATABASE_QUIZ`, `DATABASE_TUSINDIRME`) — setup/eski; runtime asosan `DB_*` + `kk_*`.

---

## 10. Root README / SETUP eskirgan farqlar

| Eski hujjatda | Haqiqat |
|---------------|---------|
| Prisma + `prisma migrate` | **Prisma yo‘q**; faqat mysql2 |
| Bitta DB `tilplatform` | **10 ta `kk_*`** |
| Frontend port **5173** | **3000** |
| `/api/dictionary`, `/api/users/me` | `/api/tusindirme`, `/api/auth/me` |
| Oddiy quiz submit | Server-side attempt oqimi |
| Faqat quiz/dict/crossword/books | Tutor, immersion, literature, jumbaq, points, community, morphology, adaptive, rooms, reading, admin, v1 |

**Ishonchli manbalar:** `backend/README.md`, `backend/.env.example`, `backend/src/server.js`, `backend/src/config/db.js`, `frontend/src/App.jsx`, `frontend/vite.config.js`, **shu `d.md`**.

---

## 11. Arxitektura sxemasi

```
Brauzer (React :3000)
    ├── REST /api/*  ──────────► Express (:5000)
    │                              ├── pools → 10× MySQL kk_*
    │                              ├── services / middleware / RBAC
    │                              └── morphology (qqAffixes + dict verify)
    └── Socket.IO ─────────────► gameSocket (quiz/crossword rooms)

fordata/ ──(import skriptlar)──► MySQL
tmp/apertium-kaa ──(build/analyze)──► affiks/morf ishlanma
```

---

## 12. Qo‘shimcha hujjatlar

| Fayl | Mazmun |
|------|--------|
| `backend/README.md` | Backend setup, ball, RBAC, skriptlar |
| `backend/docs/public-api.md` | Partner / v1 API |
| `backend/baza.md` | Baza tafsilotlari |
| `backend/reje.md` | Reja / eslatmalar |
| `frontend/README.md`, `SETUP.md`, `COMPONENTS.md` | Frontend (qisman eski) |
| `fordata/tools/README.md` | Import tool’lar |
| `CLEANUP_REPORT.md` | 2026-07 tozalash / fordata migratsiya |
| `animations/README.md` | CSSKit mapping |

---

**Xulosa:** Bu Qaraqalpaq til o‘rganish platformasi — Express + React + 10 ta MySQL baza, sozlikdan tortib tutor/SRS/multiplayergacha keng funksiyalar. Ishga tushirish uchun `backend/README.md` + `.env.example` + shu faylni kuzating; root `README.md`/`SETUP.md` ga tayanmang.
