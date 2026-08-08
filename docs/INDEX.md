# Hujjatlar indeksi

## Birinchi o‘qing

| Tartib | Fayl | Mazmun |
|-------:|------|--------|
| 1 | **[QANDAY-ISHLAYDI.md](QANDAY-ISHLAYDI.md)** | Qayerda nima qanday ishlaydi |
| 2 | **[API-MOBILE.md](API-MOBILE.md)** | Backend API — mobil ilova uchun |
| 3 | **[FOYDALANUVCHI-SAYTI.md](FOYDALANUVCHI-SAYTI.md)** | Saytda user nima qila oladi (AI tasvir) |
| 3a | [FOYDALANISH.md](FOYDALANISH.md) | Qisqa foydalanuvchi qo‘llanma |
| 4 | [ROADMAP.md](ROADMAP.md) | Rivojlantirish fazalari |
| 4a | **[PRODUCTION-TODO.md](PRODUCTION-TODO.md)** | VPS / ops / push — DoD bilan ishga tushirish |
| 4b | [ANIMATION-ADMIN-PLAN.md](ANIMATION-ADMIN-PLAN.md) | Animatsiya + admin kengaytma holati |
| 5 | [SETUP.md](../SETUP.md) | O‘rnatish |
| 6 | [README.md](../README.md) | Qisqa kirish |
| 7 | [d.md](../d.md) | Kengaytirilgan arxitektura |
| 8 | [deploy/OPS.md](deploy/OPS.md) | Systemd, UptimeRobot, backup/restore, push token |

## Deploy

| Fayl | Mazmun |
|------|--------|
| [deploy/OPS.md](deploy/OPS.md) | Ops checklist |
| [deploy/AIVEN-MYSQL.md](deploy/AIVEN-MYSQL.md) | Aiven free MySQL — `kk_*` migratsiya |
| [deploy/qp-api.service](deploy/qp-api.service) | systemd (`ensure-search-indexes` + seed) |
| [deploy/nginx.example.conf](deploy/nginx.example.conf) | Nginx namuna |

## Backend

| Fayl | Mazmun |
|------|--------|
| [backend/README.md](../backend/README.md) | 10× `kk_*`, ball, RBAC, skriptlar |
| [backend/.env.example](../backend/.env.example) | Env namuna |
| [API-MOBILE.md](API-MOBILE.md) | Mobil uchun to‘liq REST + Socket |
| [backend/docs/public-api.md](../backend/docs/public-api.md) | Partner `/api/v1` |
| `backend/src/server.js` | HTTP kirish |
| `backend/src/config/db.js` | Pool’lar |
| `backend/src/routes/` | `/api/*` |

## Frontend

| Fayl | Mazmun |
|------|--------|
| [frontend/README.md](../frontend/README.md) | SPA, proxy, MD |
| `frontend/src/App.jsx` | Route jadvali |
| `frontend/src/api/` | API klientlar |

## Kontent

| Fayl | Mazmun |
|------|--------|
| [fordata/README.md](../fordata/README.md) | grammar / english / tools + trash |
| [fordata/grammar/README.md](../fordata/grammar/README.md) | `/qoidalar` |
| [fordata/english/ENGLISH.md](../fordata/english/ENGLISH.md) | `/english` |
| [fordata/ANIMATSIYA-REJA.md](../fordata/ANIMATSIYA-REJA.md) | Motion reja |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Hissa |

## Trash

`/home/azizbek/proyekt2-trash-20260807/` — bazaga o‘tgan ortiqcha manbalar (`TRASH_MANIFEST.txt`).
