# Deploy (Aiven MySQL + Node)

Ma’lumotlar bazasi: **Aiven**. App (API + SPA): Node hosting yoki VPS.

## Ortiqcha / lokal (deployga kirmaydi)

| Yo‘l | Izoh |
|------|------|
| `backend/backups/` | Lokal dump (gitignore) |
| `backend/.env`, `.env.aiven` | Sirlar — faqat host env |
| `fordata/tools/` | Import skriptlari (runtime emas) |
| `node_modules/`, `frontend/dist/` | Build vaqtida |

## Variant A — Docker (Railway / Render / Fly)

```bash
docker build -t qp-app .
docker run --rm -p 5000:5000 --env-file backend/.env qp-app
curl -s http://127.0.0.1:5000/api/health
```

Host env (majburiy):

```env
NODE_ENV=production
PORT=5000
DB_HOST=...
DB_PORT=16342
DB_USER=avnadmin
DB_PASS=...
DB_SSL=REQUIRED
JWT_SECRET=...
ACTOR_HMAC_SECRET=...
ADMIN_PASSWORD=...
ADMIN_SESSION_SECRET=...
FRONTEND_ORIGIN=https://sizning-domen.com
SITE_ORIGIN=https://sizning-domen.com
TRUST_PROXY=1
```

## Variant B — VPS (Nginx + systemd)

1. Clone repo, `npm run install:all`, `npm run build:frontend`
2. `backend/.env` — Aiven + secrets
3. [qp-api.service](qp-api.service) + [nginx.example.conf](nginx.example.conf) + certbot  
Batafsil: [OPS.md](OPS.md), [PRODUCTION-TODO.md](../PRODUCTION-TODO.md)

## Tekshiruv

```bash
curl -s https://domen/api/health   # "status":"ok"
```
