# Qayerda nima qanday ishlaydi?

> Loyihaning **ishlash xaritasi**. O‘rnatish: [SETUP.md](../SETUP.md). API tafsilot: [d.md](../d.md). Indeks: [INDEX.md](INDEX.md).

---

## 1. Umumiy sxema

```
Brauzer                    Vite :3000                         Express :5000
─────────                  ──────────                         ─────────────
UI (React) ──fetch/WS──►  /api, /socket.io, /uploads ──proxy──► routes
                              │                                    │
                              │                              services + models
                              │                                    │
                         MD kontent                          10× MySQL kk_*
                    (fordata → ?raw import)                   Socket.IO xonalar
```

| Qatlam | Papka | Port | Vazifa |
|--------|-------|-----:|--------|
| UI | `frontend/` | 3000 | Sahifalar, kontekst, API klient |
| API | `backend/` | 5000 | REST, auth, ball, Socket.IO |
| Ma’lumot | MySQL `kk_*` | 3306 | Sozlik, test, kitob, … |
| Statik MD | `fordata/grammar`, `english` | — | `/qoidalar`, `/english` (build vaqtida Vite `?raw`) |

**Muhim:** sozlik/kitob/jumbaq **fayldan emas** — MySQL’dan. Eski import fayllar trashda (`~/proyekt2-trash-20260807/`).

---

## 2. So‘rov qanday o‘tadi?

### Oddiy REST (masalan so‘z qidiruv)

1. Brauzer: `GET /api/tusindirme/search?q=…` (`frontend/src/api/tusindirme.js`)
2. Vite proxy → `http://localhost:5000/api/tusindirme/search`
3. `server.js` → `tusindirmeRoutes` → `tusindirmeService` → model → `kk_tusindirme`
4. JSON javob → React sahifa (`Dictionary.jsx` / `WordDetail.jsx`)

### Realtime (quiz / krossvord xona)

1. `socket.io-client` (`frontend/src/lib/gameSocket.js`)
2. Proxy `/socket.io` → backend
3. `realtime/gameSocket.js` — `room:subscribe`, `room:state`, …
4. Holat `kk_quiz` / `kk_krasvord` + xotira

### Production

```bash
npm run start:prod
```

Frontend `dist/` build qilinadi; Express **bir portda** (`:5000`) API + SPA beradi. Proxy kerak emas.

---

## 3. Backend — qayer nima?

```
backend/src/
├── server.js           # Kirish: middleware, route mount, SPA, Socket.IO
├── config/db.js        # 10 ta mysql2 pool (kk_*)
├── routes/             # URL → controller/service
├── services/           # Biznes mantiq
├── models/             # SQL
├── middleware/         # auth, actor, rbac, upload, rate-limit
├── realtime/           # Socket.IO
├── data/qqAffixes.js   # Morfologiya affikslari
└── utils/              # qqScript, errorLogger, …
```

### API prefix → nima uchun

| Prefix | Ishlatiladi | Asosiy baza |
|--------|-------------|-------------|
| `/api/auth` | Login, register, profil, session | `kk_users` |
| `/api/tusindirme` | Túsinirme sozlik, kun so‘zi, community, dict quiz | `kk_tusindirme` |
| `/api/dicts` | UZB/EN/RU, frazeologiya, imla, adam atları | `kk_tusindirme` (+ jadvallar) |
| `/api/morphology` | So‘zni túbir + qo‘shimta | kod + sozlik verify |
| `/api/quizzes` | Testlar, attempt, adaptive | `kk_quiz` |
| `/api/rooms` | Multiplayer xona | `kk_quiz` |
| `/api/crosswords` | Krossvord | `kk_krasvord` |
| `/api/books` | E-kitoblar | `kk_poetrys` |
| `/api/literature` | Shoirlar, asarlar | `kk_poets` / `kk_poetrys` |
| `/api/reading` | O‘qish darsi + SRS | `kk_poetrys` + `kk_statistika` |
| `/api/jumbaqlar` | Topishmoqlar | `kk_jumbaqlar` |
| `/api/tutor` | Tutor, xato banki | `kk_ai_db` |
| `/api/immersion` | Audio mashq | `kk_ai_db` |
| `/api/points` | Ball, leaderboard | `kk_statistika` |
| `/api/favorites`, `/recent-words` | Sevimli / so‘nggi | `kk_users` / statistika |
| `/api/quotas` | Mehmon limitti | `kk_users` |
| `/api/stats`, `/api/feedback` | Statistika, fikr | `kk_statistika` / logs |
| `/api/admin` | Admin akkauntlar, dashboard | `kk_users` + boshqalar |
| `/api/v1` | Tashqi/partner API | api_clients |
| `/sitemap.xml`, `/robots.txt` | SEO | — |
| `/api/health` | Barcha pool ping | hammasi |

Route fayllar: `backend/src/routes/*Routes.js`.

### Middleware zanjiri

| Middleware | Vazifa |
|------------|--------|
| `helmet`, `cors`, `compression` | Xavfsizlik / CORS / gzip |
| `apiLimiter` | Rate limit `/api` |
| `actor.js` | `X-Anonymous-Id` → HMAC → `anonymous_actors` |
| `auth.js` | Bearer token (`optionalAuth` / `requireAuth`) |
| `rbac.js` | Admin rollar: owner / editor / uploader / moderator |
| Upload middleware | Kitob PDF, avatar, immersion audio |

### 10 ta baza — kim nima saqlaydi

| Baza | Env | Nima |
|------|-----|------|
| `kk_tusindirme` | `KK_TUSINDIRME_DB` | So‘zlar, ta’rif, misol, community, curated |
| `kk_quiz` | `KK_QUIZ_DB` | Test, savol, urinish, game room |
| `kk_krasvord` | `KK_KRASVORD_DB` | Krossvord, dict game |
| `kk_poets` | `KK_POETS_DB` | Yozuvchilar |
| `kk_poetrys` | `KK_POETRYS_DB` | Kitoblar, adabiyot, darslar |
| `kk_jumbaqlar` | `KK_JUMBAQLAR_DB` | Jumbaqlar |
| `kk_statistika` | `KK_STATISTIKA_DB` | Event, progress, **ball hamyoni** |
| `kk_users` | `KK_USERS_DB` | Actor, user, session, admin |
| `kk_ai_db` | `KK_AI_DB` | Tutor, immersion |
| `kk_logs` | `KK_LOGS_DB` | Server xatolari |

Konfig: `backend/src/config/db.js`. Cross-baza bog‘lanish **app darajasida** (FK yo‘q).

---

## 4. Frontend — qayer nima?

```
frontend/src/
├── App.jsx              # Barcha Route lar
├── main.jsx             # React root + animatsiya CSS
├── api/*.js             # Har modul uchun fetch wrapper
├── pages/*.jsx          # Sahifalar (55 ta)
├── components/          # Header, Crossword, …
├── contexts/            # Auth, UiScript (lotin/kirill), AppSettings (tema)
├── hooks/
├── lib/                 # grammarContent, englishContent, mdToHtml, gameSocket
├── i18n/kaa.js          # Lotin ↔ kirill
└── animations/          # UI motion komponentlar
```

### Sahifa → API → baza (asosiy)

| Brauzer URL | Sahifa | API | Baza |
|-------------|--------|-----|------|
| `/` | Home | tusindirme (WoD) + soft | — |
| `/dictionary` | Dictionary | `/api/tusindirme` | `kk_tusindirme` |
| `/dictionary/:id` | WordDetail | tusindirme + morphology | tusindirme |
| `/dictionary/uzb\|en\|ru` | BilingualDict* | `/api/dicts` | tusindirme |
| `/dictionary/imla` | ImlaPage | `/api/dicts` | tusindirme |
| `/dictionary/immersion` | ImmersionBrowse | `/api/immersion` | ai_db |
| `/games` | GamesHub | **API yo‘q** — faqat navigatsiya | — |
| `/literature` | LiteratureHub | **API yo‘q** — faqat navigatsiya | — |
| `/quiz` | Quiz | `/api/quizzes` | `kk_quiz` |
| `/quiz/adaptive` | AdaptiveQuiz | quizzes adaptive + IRT | quiz + statistika |
| `/quiz/room/:code` | QuizRoom | rooms + Socket.IO | quiz |
| `/crossword` | Crosswords* | `/api/crosswords` | `kk_krasvord` |
| `/books`, `/books/:id/read` | Books, BookReader | `/api/books` | poetrys |
| `/books/:id/learn` | ReadingLesson | `/api/reading` | poetrys + statistika |
| `/writers` | Writers | `/api/literature` | poets |
| `/jumbaqlar` | Jumbaqlar | `/api/jumbaqlar` | jumbaqlar |
| `/tutor` | Tutor | `/api/tutor` | ai_db |
| `/tutor/practice` | PracticeHub | **API yo‘q** — mashq navigatsiya | — |
| `/community` | CommunityFeed | `/api/tusindirme` (suggestions) | tusindirme |
| `/facts` | CultureFacts | **API yo‘q** — lokal/MD kontent | — |
| `/qoidalar` | Qoidalar | **API yo‘q** — MD | `fordata/grammar` |
| `/english` | English | **API yo‘q** — MD | `fordata/english` |
| `/login`, `/register`, … | Auth* | `/api/auth` | users |
| `/profile`, `/settings` | Profile, Settings | `/api/auth` | users |
| `/faq`, `/about`, `/dashboard` | yordam / dashboard | aralash | — |
| `/admin/*` | *Admin | admin + mos CRUD | RBAC |

To‘liq foydalanuvchi xaritasi: [FOYDALANUVCHI-SAYTI.md](FOYDALANUVCHI-SAYTI.md) §12.  
Route sinxroni: `npm run check:docs-routes` (CI).

**App.jsx oila qoplami** (batafsil jadval yuqorida; qolganlari shu belgi bilan):

```
/dictionary[/*]   all, favorites, stats, game, uzb|en|ru, frazeologiya, adam-atlari, imla, …
/quiz[/*]         adaptive, statistics, room, :id  (+ /statistics alias)
/crossword[/*]    room, :id
/literature[/*]   naqillar, ertekler
/books[/*], /writers[/*]
/login, /register, /forgot-password, /reset-password
/faq, /about, /privacy, /terms, /dashboard, /profile, /settings
/admin/*
```

### Kontekstlar

| Context | Nima qiladi |
|---------|-------------|
| `AuthContext` | Token `localStorage`, `/api/auth/me` |
| `UiScriptContext` | Lotin / kirill ko‘rinish |
| `AppSettingsContext` | Tema: day / night / sepia / focus |

---

## 5. Modul bo‘yicha — qanday ishlaydi?

### 5.1 Sozlik (túsinirme)

- **UI:** `/dictionary` → qidiruv, harf, sevimlilar, kun so‘zi  
- **API:** `/api/tusindirme/search`, `/soz/:id`, `/letter/:letter`, curated, community  
- **DB:** `kk_tusindirme.titles` + description/examples/…  
- **Curated (premium-50):** jadval `curated_words` — `npm run seed-curated-db` yoki systemd `ExecStartPre` (fayl trashda; bo‘sh bo‘lsa titles dan)  
- **Morfologiya:** so‘z ochilganda `/api/morphology/analyze` — `morphologyService` + `qqAffixes.js`, ixtiyoriy sozlik verify  

### 5.2 Testlar

- Start → savollar (**javobsiz**) → `answer` → `finalize` — baholash **serverda**  
- Ball: `pointsService` → `kk_statistika` wallets  
- Adaptive: IRT (`irtService` + `adaptiveQuizService`)  
- Multiplayer: Socket.IO room  

### 5.3 Krossvord

- Grid ma’lumot DB’da; UI `Crossword.jsx`  
- Xona: `/crossword/room/:code` + Socket.IO  

### 5.4 Ádebiyat / kitob / o‘qish

- Shoirlar: `kk_poets`  
- Kitob matni / section: `kk_poetrys`  
- Reading lesson + SRS: `readingService` — progress `kk_statistika`  

### 5.5 Tutor / Immersion

- **Tutor:** lokal tip’lar (`localTutorAiService`) — tashqi LLM yo‘q; xatolar `mistake_bank`  
- **Immersion:** audio asset + mashq; upload admin orqali  

### 5.6 Ball

- To‘g‘ri javob +10, tezlik 0–5, to‘liq toza test +20  
- Review ochish — ball evaziga  
- Leaderboard: `/api/points/leaderboard`  

### 5.7 Auth

1. Mehmon: `X-Anonymous-Id` → actor (kvota, progress)  
2. Register/login → `app_users` + Bearer session  
3. Admin: alohida `admin_accounts` + RBAC permission  

### 5.8 Qoidalar (`/qoidalar`)

```
fordata/grammar/*.md
    → frontend/src/lib/grammarContent.js  (?raw import)
    → mdToHtml → Qoidalar sahifasi
```

MySQL **ishlatilmaydi**. Yangi qoida: MD qo‘shing + `grammarContent.js` ga import.

### 5.9 Ingliz (`/english`)

```
fordata/english/english-*.md + *-grammatika.md
    → frontend/src/lib/englishContent.js
    → English.jsx tablar
```

Maqsad: **fraza / mashq / grammatika** (unit atlari emas).

---

## 6. Fayl tuzilmasi (hozirgi)

```
proyekt2/
├── backend/          # API + skriptlar + test
├── frontend/         # SPA
├── fordata/
│   ├── grammar/      # QQ MD → /qoidalar
│   ├── english/      # EN MD → /english
│   └── tools/        # Import CLI (ixtiyoriy kelajak)
├── docs/
│   ├── INDEX.md
│   └── QANDAY-ISHLAYDI.md   ← shu fayl
├── README.md · SETUP.md · CONTRIBUTING.md · d.md
└── .github/workflows/ci.yml
```

Trash (loyihadan tashqari): `/home/azizbek/proyekt2-trash-20260807/`

---

## 7. Muhit o‘zgaruvchilari (qisqa)

| Env | Qayer ishlaydi |
|-----|----------------|
| `DB_*`, `KK_*_DB` | Barcha pool’lar |
| `JWT_SECRET` | User session |
| `ACTOR_HMAC_SECRET` | Anonim actor ID |
| `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` | Admin |
| `FRONTEND_ORIGIN` | CORS (dev: `http://localhost:3000`) |
| `SITE_ORIGIN` | Sitemap absolyut URL |
| `IMPORT_API_KEY` | HTTP import himoya |
| `GOOGLE_CLIENT_ID` | Google login (ixtiyoriy) |

Namuna: `backend/.env.example`.

---

## 8. Ishga tushirish oqimi

```bash
# 1) MySQL + backend/.env
cd backend && npm install
npm run setup && node scripts/setup-kk-databases.js
npm run setup-roles && npm run setup-points
npm run dev          # :5000

# 2) Frontend
cd frontend && npm install && npm run dev   # :3000
```

Tekshiruv: `curl localhost:5000/api/health` · brauzer `localhost:3000`.

---

## 9. Tezkor «qayerga qarayman?»

| Savol | Javob |
|-------|--------|
| Yangi API endpoint? | `backend/src/routes/` + `services/` |
| Yangi sahifa? | `frontend/src/pages/` + `App.jsx` Route |
| Sozlik buzilgan? | `tusindirmeService` + `kk_tusindirme` |
| Ball noto‘g‘ri? | `pointsService` + `kk_statistika` |
| Admin ruxsat? | `middleware/rbac.js` |
| Lotin/kirill? | `i18n/kaa.js` + `UiScriptContext` |
| QQ qoida matni? | `fordata/grammar/` + `grammarContent.js` |
| Ingliz matni? | `fordata/english/` + `englishContent.js` |
| Multiplayer? | `realtime/gameSocket.js` + `gameSocket.js` (FE) |

---

## 10. Bog‘liq hujjatlar

| Fayl | Mazmun |
|------|--------|
| [SETUP.md](../SETUP.md) | O‘rnatish |
| [d.md](../d.md) | To‘liq API / features / auth |
| [backend/README.md](../backend/README.md) | Ball, RBAC, skriptlar |
| [frontend/README.md](../frontend/README.md) | SPA |
| [backend/docs/public-api.md](../backend/docs/public-api.md) | Partner API |
| [fordata/README.md](../fordata/README.md) | Kontent + trash |
