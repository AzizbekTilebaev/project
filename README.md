# Qaraqalpaq Til Platforması

Qaraqalpaq tilini o‘rganish uchun **full-stack** web-platforma: túsinirme sozlik, testlar, krossvord, ádebiyat, jumbaqlar, tutor, immersion, grammatika/ingliz bo‘limlari va admin panel.

| | |
|--|--|
| **Repo** | https://github.com/AzizbekTilebaev/project |
| **Stack** | React 18 + Vite + Tailwind · Express + mysql2 + Socket.IO · MySQL (`kk_*`) |
| **Dev** | Frontend `:3000` · Backend `:5000` |
| **Qanday ishlaydi** | [`docs/QANDAY-ISHLAYDI.md`](docs/QANDAY-ISHLAYDI.md) |
| **Hujjatlar indeksi** | [`docs/INDEX.md`](docs/INDEX.md) |
| **To‘liq ma’lumotnoma** | [`d.md`](d.md) |
| **O‘rnatish** | [`SETUP.md`](SETUP.md) · [`backend/README.md`](backend/README.md) |

---

## Nimalar bor?

- **Sozlik** — qidiruv, harf, kun so‘zi, sevimlilar, community, morfologiya (túbir + qo‘shimta)
- **Ikki tilli / maxsus** — UZB / EN / RU, frazeologiya, adam atları, imla
- **Testlar** — oddiy, adaptiv (IRT), multiplayer xona, ball tizimi
- **Krossvord** — yakka + real-time xona
- **Ádebiyat** — shoirlar, kitoblar, o‘qish darslari (SRS)
- **Jumbaqlar**, **Tutor**, **Immersion** (audio)
- **Qoidalar** (`/qoidalar`) — Qaraqalpaq grammatika (MD)
- **Ingliz tili** (`/english`) — maktab seriyalari: fraza + mashq + QQ/EN grammatika
- **Admin** — RBAC (owner / editor / uploader / moderator)

UI asosan **qaraqalpaq**; lotin ↔ kirill (`frontend/src/i18n/kaa.js`).

---

## Tezkor start

```bash
# Talab: Node.js 18+, MySQL 8+
cp backend/.env.example backend/.env   # DB_USER, DB_PASS, JWT_SECRET, …
npm run install:all

# Birinchi marta DB:
cd backend
npm run setup
node scripts/setup-kk-databases.js
npm run setup-roles
npm run setup-points
cd ..

npm run dev:backend    # http://localhost:5000
npm run dev:frontend   # http://localhost:3000  (proxy → :5000)
```

Tekshirish: `curl http://localhost:5000/api/health`

Lokal production (SPA + API bir portda):

```bash
npm run start:prod   # frontend build + backend :5000
```

Batafsil: [`SETUP.md`](SETUP.md).

---

## Loyiha tuzilmasi

```
project/
├── backend/          # Express API, Socket.IO, skriptlar, testlar
├── frontend/         # React SPA (Vite port 3000)
├── fordata/          # grammar + english MD (sayt); tools/
├── docs/             # Hujjatlar indeksi
├── .github/workflows # CI
├── d.md · SETUP.md · README.md · CONTRIBUTING.md
└── package.json
```
# Ortiqcha manbalar: ~/proyekt2-trash-20260807/

### Ma’lumotlar bazasi (10 ta)

| Baza | Vazifa |
|------|--------|
| `kk_tusindirme` | Sozlik |
| `kk_quiz` | Testlar, o‘yin xonalari |
| `kk_krasvord` | Krossvord |
| `kk_poets` / `kk_poetrys` | Yozuvchilar, kitoblar |
| `kk_jumbaqlar` | Jumbaqlar |
| `kk_statistika` | Progress, ball hamyoni |
| `kk_users` | Actorlar, admin, sessions |
| `kk_ai_db` | Tutor, immersion |
| `kk_logs` | Xatolar |

Prisma **yo‘q** — faqat `mysql2` pool (`backend/src/config/db.js`).

---

## Asosiy URL lar (frontend)

| Path | Mazmun |
|------|--------|
| `/dictionary` | Túsinirme sozlik |
| `/quiz` | Testlar |
| `/crossword` | Krossvord |
| `/literature`, `/books`, `/writers` | Ádebiyat |
| `/qoidalar` | QQ grammatika |
| `/english` | Ingliz tili o‘rganish |
| `/tutor`, `/games`, `/jumbaqlar` | Mashq / o‘yin |
| `/admin` | Admin panel |

API prefikslar: `/api/tusindirme`, `/api/quizzes`, `/api/books`, `/api/auth`, `/api/morphology`, … — to‘liq ro‘yxat [`d.md`](d.md) da.

---

## Hujjatlar xaritasi

**Indeks:** [`docs/INDEX.md`](docs/INDEX.md) · **Asosiy:** [`docs/QANDAY-ISHLAYDI.md`](docs/QANDAY-ISHLAYDI.md)

| Fayl | Mazmun |
|------|--------|
| [`docs/QANDAY-ISHLAYDI.md`](docs/QANDAY-ISHLAYDI.md) | Qayer–nima–qanday (UI ↔ API ↔ DB) |
| [`docs/API-MOBILE.md`](docs/API-MOBILE.md) | Backend API (mobil ilova) |
| [`docs/FOYDALANISH.md`](docs/FOYDALANISH.md) | Oddiy foydalanuvchi |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Keyingi rivojlantirish |
| [`d.md`](d.md) | Kengaytirilgan API / features |
| [`SETUP.md`](SETUP.md) | Clone → env → MySQL → ishga tushirish |
| [`backend/README.md`](backend/README.md) | Backend, ball, RBAC, skriptlar |
| [`frontend/README.md`](frontend/README.md) | SPA marshrutlar, proxy, MD kontent |
| [`fordata/README.md`](fordata/README.md) | Import + grammar/english |
| [`fordata/english/ENGLISH.md`](fordata/english/ENGLISH.md) | Ingliz sabaqlıqlar registry |
| [`fordata/grammar/README.md`](fordata/grammar/README.md) | QQ qoidalar MD |
| [`fordata/ANIMATSIYA-REJA.md`](fordata/ANIMATSIYA-REJA.md) | Motion reja |
| Trash | `/home/azizbek/proyekt2-trash-20260807/` — ortiqcha manbalar |

---

## Muhit o‘zgaruvchilari (qisqa)

`backend/.env` — namuna: `backend/.env.example`.

Majburiy (dev): `DB_HOST`, `DB_USER`, `DB_PASS`, `JWT_SECRET`, `ACTOR_HMAC_SECRET`, `FRONTEND_ORIGIN=http://localhost:3000`.

Productionda kuchli (≥32): `JWT_SECRET`, `ACTOR_HMAC_SECRET`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`. `.env` **commit qilinmasin**.

---

## CI / test

```bash
cd frontend && npm test && npm run lint && npm run build
cd backend  && npm test && npm run lint
```

GitHub Actions: `.github/workflows/ci.yml`.

---

## Litsenziya

MIT (root `package.json`).
