# O‘rnatish qo‘llanmasi

> Haqiqiy stack: **Express + mysql2** (Prisma yo‘q), frontend Vite **port 3000**.  
> Eski `prisma migrate` / `5173` yo‘riqnomalari bekor.

## Talablar

- **Node.js** 18+ (tavsiya)
- **MySQL** 8.0+
- **npm**
- **Git**

```bash
node --version
npm --version
mysql --version
```

## 1. Clone

```bash
git clone https://github.com/AzizbekTilebaev/project.git
cd project
```

## 2. MySQL

```bash
# Linux misol
sudo systemctl start mysql
```

MySQL foydalanuvchisida 10 ta `kk_*` baza yaratish huquqi bo‘lsin (yoki root).

## 3. Backend env

```bash
cd backend
cp .env.example .env
```

`.env` da kamida to‘ldiring:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=your_user
DB_PASS=your_password
DB_NAME=kk_tusindirme

JWT_SECRET=   # openssl rand -base64 48
ACTOR_HMAC_SECRET=   # openssl rand -base64 48

FRONTEND_ORIGIN=http://localhost:3000
SITE_ORIGIN=http://localhost:3000
PORT=5000
NODE_ENV=development

KK_USERS_DB=kk_users
KK_POETS_DB=kk_poets
KK_POETRYS_DB=kk_poetrys
KK_JUMBAQLAR_DB=kk_jumbaqlar
KK_TUSINDIRME_DB=kk_tusindirme
KK_QUIZ_DB=kk_quiz
KK_KRASVORD_DB=kk_krasvord
KK_STATISTIKA_DB=kk_statistika
KK_AI_DB=kk_ai_db
KK_LOGS_DB=kk_logs
```

Admin / production kalitlari: `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` (prod ≥32).

## 4. Paketlar

Rootdan:

```bash
npm run install:all
# yoki:
cd backend && npm install
cd ../frontend && npm install
```

## 5. Bazalar va sxema (birinchi marta)

```bash
cd backend
npm run setup
node scripts/setup-kk-databases.js
npm run setup-roles
npm run setup-points
```

Sozlik ma’lumoti odatda **seed emas** — backup/import orqali:

```bash
npm run backup
# npm run restore -- path/to/dump.sql
```

Import manbasi: `fordata/` (qarang `fordata/tools/`).

## 6. Ishga tushirish (development)

Ikki terminal:

```bash
# Terminal 1
npm run dev:backend
# → http://localhost:5000

# Terminal 2
npm run dev:frontend
# → http://localhost:3000  (/api proxy → :5000)
```

### Tekshirish

```bash
curl http://localhost:5000/api/health
# Brauzer: http://localhost:3000
```

## 7. Lokal production

```bash
# Rootdan — frontend/dist + API bir portda
npm run start:prod
# → http://localhost:5000
```

Talablar: kuchli secretlar, `frontend/dist` mavjudligi.

## 8. Test / lint

```bash
cd backend && npm test && npm run lint
cd frontend && npm test && npm run lint && npm run build
```

## Muammolar

| Muammo | Yechim |
|--------|--------|
| DB ulanmaydi | `DB_USER`/`DB_PASS`, MySQL ishlayotganini tekshiring |
| CORS | `FRONTEND_ORIGIN` = brauzer origin (`http://localhost:3000`) |
| Bo‘sh sozlik | Import yoki `npm run restore` |
| Port band | `PORT` yoki Vite `server.port` |

## Keyingi o‘qish

- Arxitektura / API: [`d.md`](d.md)
- Backend batafsil: [`backend/README.md`](backend/README.md)
- Ingliz kontent: [`fordata/english/ENGLISH.md`](fordata/english/ENGLISH.md)
