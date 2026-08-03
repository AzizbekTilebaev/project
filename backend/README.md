# Sozlik + Testler Backend

Express + `mysql2` API. Prisma ishlatilmaydi.

## Ma’lumotlar bazalari (10 ta, `kk_*`)

| Baza | Env | Vazifa |
|------|-----|--------|
| `kk_users` | `KK_USERS_DB` | Anonim foydalanuvchilar, admin akkauntlar, API kalitlar |
| `kk_poets` | `KK_POETS_DB` | Yozuvchilar, biografiyalar, ijodiy ishlar |
| `kk_poetrys` | `KK_POETRYS_DB` | Kitoblar, adabiyot bo‘laklari (she’rlar) |
| `kk_jumbaqlar` | `KK_JUMBAQLAR_DB` | Jumbaqlar |
| `kk_tusindirme` | `KK_TUSINDIRME_DB` | Sozlik, community takliflar |
| `kk_quiz` | `KK_QUIZ_DB` | Testlar, urinishlar, o‘yin xonalari |
| `kk_krasvord` | `KK_KRASVORD_DB` | Krossvordlar, so‘z o‘yinlari |
| `kk_statistika` | `KK_STATISTIKA_DB` | Eventlar, progress, **ball hamyoni** |
| `kk_ai_db` | `KK_AI_DB` | Tutor sessiyalari, xatolar banki |
| `kk_logs` | `KK_LOGS_DB` | Server xatolari (`app_errors`) |

Ulanish konfiguratsiyasi: `src/config/db.js` (`pools`, `DB`). Cross-baza so‘rovlar
to‘liq nom bilan yoziladi (`kk_users.anonymous_actors` kabi).

## Tez start

```bash
cd backend
cp .env.example .env   # yoki: npm run ensure-env
npm install
npm run setup              # eski sxemalar (birinchi o‘rnatishda)
node scripts/setup-kk-databases.js   # 10 ta kk_* baza + migratsiya
npm run setup-roles        # admin rollar (owner/editor/uploader/moderator)
npm run setup-points       # ball tizimi jadvallari
npm run dev                # http://localhost:5000
```

Asosiy marshrutlar:

- `GET /api/health` — barcha `kk_*` pool ping
- `GET /api/tusindirme/...` — sozlik
- `GET /api/quizzes` — testlar ro‘yxati
- `GET /api/quizzes/:id` — savollar (**javobsiz**)
- `POST /api/quizzes/:id/start` → `/attempts/:id/answer` → `/attempts/:id/finalize` — server tomonda baholanadigan urinish oqimi
- `GET /api/points/me`, `/me/history`, `/leaderboard` — ball hamyoni
- `GET /sitemap.xml`, `GET /robots.txt`

## Lokal production

```bash
# Rootdan:
npm run start:prod
# yoki:
cd frontend && npm run build
cd ../backend && npm run start:prod   # NODE_ENV=production, SPA+API :5000
```

Production boot: `JWT_SECRET`, `ACTOR_HMAC_SECRET`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` (≥32) majburiy; `frontend/dist` majburiy. `/uploads/books` va `/uploads/immersion` static ochiq emas.

## Ball tizimi

- To‘g‘ri javob **+10**, tezlik bonusi **0–5** (≤3s/≤6s/≤10s), xatosiz to‘liq test **+20**.
- Takroriy urinish (shu testda): 2-marta **50%**, keyingilari **20%**.
- Daraja: L2 = 100 ball, L3 = 300, L4 = 600 (formula: `50·L·(L−1)`).
- **Javob ochish pulli** (ball evaziga): har savolga 5 ball, minimum 30.
  - `GET /api/quizzes/attempts/:id/review-status` — narx/balans
  - `POST /api/quizzes/attempts/:id/unlock-review` — ochish (yetmasa 402)
  - `GET /api/quizzes/attempts/:id/review` — to‘liq tahlil
- Admin: `GET /api/admin/quiz-attempts/:id/review` (`view_users` ruxsati) — ball sarfisiz.
- Idempotensiya: `point_transactions (kind, ref_id)` UNIQUE — bir urinish uchun ball
  ikki marta yozilmaydi; sarflash `SELECT ... FOR UPDATE` bilan himoyalangan.
- Kelajak: real pul manbalari uchun yangi tranzaksiya `kind` (masalan, `coin_purchase`)
  qo‘shish kifoya — sxema o‘zgarmaydi.

## Rollar (RBAC)

`owner` → hamma narsa; `editor` → kontent; `uploader` → kitob/immersion;
`moderator` → community moderatsiya + foydalanuvchilarni ko‘rish.
Middleware: `src/middleware/rbac.js` (`requirePermission`). Admin UI: `/admin/users`.

## Scriptlar

| Script | Tavsif |
|--------|--------|
| `npm run setup` | Env + eski quiz/dictionary sxemalar |
| `node scripts/setup-kk-databases.js` | 10 ta `kk_*` baza + ma’lumot migratsiyasi |
| `npm run setup-roles` | Admin rollar sxemasi |
| `npm run setup-points` | Ball hamyoni jadvallari |
| `npm run backup` | `mysqldump` → `backups/` |
| `npm run restore -- path.sql` | Dumpni tiklash |
| `npm test` | node:test (123 test) |
| `npm run lint` | ESLint |

Dictionary ma’lumoti seed emas — `npm run backup` / import orqali saqlanadi.

## Xavfsizlik eslatmalari

- Productionda `TRUST_PROXY=1` yoki `NODE_ENV=production` (trust proxy yoqiladi).
- `IMPORT_API_KEY` — HTTP import uchun.
- `.env` commit qilinmasin.
- Test javoblari hech qachon ochiq API orqali chiqmaydi — faqat unlock/adminda.
