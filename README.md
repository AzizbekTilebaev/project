# Qaraqalpaq Til Platformasi

> **Ishonchli hujjat:** [d.md](d.md) · Backend: [backend/README.md](backend/README.md)  
> Bu README qisqa yo‘l-yo‘riq. Eski Prisma/5173 tavsiflari olib tashlangan.

## Tezkor start (development)

```bash
# MySQL ishlashi kerak; backend/.env da DB_USER / DB_PASS
cd backend && npm install && npm run dev   # :5000
cd frontend && npm install && npm run dev  # :3000 (proxy → :5000)
```

Yoki: `npm run install:all` keyin `npm run dev:backend` / `npm run dev:frontend`.

## Lokal production

```bash
# frontend/dist yaratadi va backend NODE_ENV=production da SPA+API ni :5000 da beradi
npm run start:prod
```

Talablar: kuchli `JWT_SECRET`, `ACTOR_HMAC_SECRET`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` (≥32).

## Stack

- **Frontend:** React 18 + Vite + Tailwind (port **3000**)
- **Backend:** Express + mysql2 + Socket.IO (port **5000**)
- **DB:** 10 ta `kk_*` MySQL baza (Prisma yo‘q)

## Asosiy API

`/api/tusindirme`, `/api/quizzes`, `/api/books`, `/api/literature`, `/api/auth`, `/api/health`, …

Batafsil: `d.md`.
