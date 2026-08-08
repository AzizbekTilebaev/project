# Deploy (Aiven MySQL + Node)

Ma’lumotlar bazasi: **Aiven**. App (API + SPA): Node hosting yoki VPS.

## Tavsiya: bepul — Render Free

| | |
|--|--|
| Narx | $0 (karta shart emas) |
| URL | `https://qaraqalpaq-til.onrender.com` (Name ni o‘zingiz tanlaysiz) |
| HTTPS | Avtomatik |
| Cheklov | ~15 daq inactivity → uxlaydi; birinchi so‘rov ~30–60s |

### Qadamlar

1. [dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint**
2. GitHub `AzizbekTilebaev/project` ulash → `render.yaml` topiladi
3. Env (Dashboard → Environment):

```env
DB_HOST=mysql-….aivencloud.com
DB_PORT=16342
DB_USER=avnadmin
DB_PASS=...
DB_SSL=REQUIRED
ADMIN_PASSWORD=<kuchli-parol>
FRONTEND_ORIGIN=https://qaraqalpaq-til.onrender.com
SITE_ORIGIN=https://qaraqalpaq-til.onrender.com
TRUST_PROXY=1
```

(`JWT_*` / `ACTOR_HMAC_*` — Blueprint `generateValue` bersa avto.)

4. Deploy → `https://qaraqalpaq-til.onrender.com/api/health` → `"status":"ok"`

### Chiroyliroq domen (bepul)

| Variant | Misollar |
|---------|----------|
| **Render Name** (eng oson) | `qaraqalpaq-til`, `qq-til`, `tilimiz`, `karaqalpaq` → `*.onrender.com` |
| **FreeDNS / DuckDNS** | `qaraqalpaq.duckdns.org` → CNAME → `qaraqalpaq-til.onrender.com` |
| **Keyin pullik** | `til.uz` / `qaraqalpaq.uz` — Namecheap/Reg.uz (~arzon) + Render Custom Domain |

Render Settings → **Custom Domains** → CNAME qo‘shasiz; TLS bepul.

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
