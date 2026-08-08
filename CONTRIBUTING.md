# Hissa qo‘shish

## Ish jarayoni

1. [SETUP.md](SETUP.md) bo‘yicha lokal muhit.  
2. O‘zgarishni kichik qiling — bir PR = bir maqsad.  
3. `backend` va/yoki `frontend` da `npm test` / `npm run lint`.  
4. Hujjat kerak bo‘lsa: [docs/INDEX.md](docs/INDEX.md) orqali tegishli README / `d.md` ni yangilang.

## Kod

- Backend: ESM, `mysql2`, Prisma yo‘q.  
- Frontend: React Router marshrutlari `App.jsx` da.  
- Secret / `.env` / PDF-OCR / `node_modules` — commit qilinmasin (`.gitignore`).

## Kontent

- Sozlik import: `fordata/tools/`  
- QQ qoidalar: `fordata/grammar/` → `/qoidalar`  
- Ingliz: `fordata/english/` → `/english` (fraza/mashq; unit atlari emas)

## Commit xabar

Qisqa, nima uchun: `docs: …`, `fix: …`, `feat: …`.
