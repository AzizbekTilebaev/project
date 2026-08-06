# Qaraqalpaq Til Platforması

Qaraqalpaq tilini o‘rganish uchun **full-stack** web-platforma: túsinirme sozlik, testlar, krossvord, ádebiyat, jumbaqlar, tutor, immersion, grammatika/ingliz bo‘limlari va admin panel.

| | |
|--|--|
| **Repo** | https://github.com/AzizbekTilebaev/project |
| **Stack** | React 18 + Vite + Tailwind · Express + mysql2 + Socket.IO · MySQL (`kk_*`) |
| **Dev** | Frontend `:3000` · Backend `:5000` |
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
├── fordata/          # Import manbasi (sozlik, kitob, grammar, english MD)
├── grammar-site/     # Alohida grammar Vite prototipi (ixtiyoriy)
├── animations/       # CSSKit / motion aktivlar
├── .github/workflows # CI
├── d.md              # To‘liq arxitektura va API ma’lumotnomasi
├── SETUP.md          # O‘rnatish qo‘llanmasi
├── README.md         # Shu fayl
└── package.json      # Root helper skriptlar
```

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

| Fayl | Mazmun |
|------|--------|
| [`d.md`](d.md) | Arxitektura, API, DB, realtime, xavfsizlik, features |
| [`SETUP.md`](SETUP.md) | Clone → env → MySQL → ishga tushirish |
| [`backend/README.md`](backend/README.md) | Backend, ball, RBAC, skriptlar |
| [`fordata/english/ENGLISH.md`](fordata/english/ENGLISH.md) | Ingliz sabaqlıqlar registry |
| [`fordata/ANIMATSIYA-REJA.md`](fordata/ANIMATSIYA-REJA.md) | Motion reja |
| [`CLEANUP_REPORT.md`](CLEANUP_REPORT.md) | Tozalash hisoboti (tarixiy) |

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
