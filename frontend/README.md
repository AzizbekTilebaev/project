# Frontend — Qaraqalpaq Til Platforması

React 18 + Vite 5 + Tailwind 3 SPA.

| | |
|--|--|
| Dev | `http://localhost:3000` |
| Proxy | `/api`, `/socket.io`, `/uploads` → `http://localhost:5000` |
| Root o‘rnatish | [SETUP.md](../SETUP.md) |
| To‘liq hujjat | [d.md](../d.md) §5 · [docs/INDEX.md](../docs/INDEX.md) |

## Tezkor start

```bash
# Backend ishlayotgan bo‘lsin (:5000)
cd frontend
npm install
npm run dev
```

```bash
npm run build    # → dist/ (backend prod shu papkani serve qiladi)
npm test
npm run lint
```

## Tuzilma

```
src/
├── App.jsx              # Marshrutlar + layout
├── main.jsx
├── index.css
├── api/                 # Backend klientlar
├── components/          # Header, Crossword, animatsiya, …
├── contexts/            # Auth, UiScript, AppSettings
├── hooks/
├── i18n/kaa.js          # Lotin ↔ kirill
├── lib/                 # mdToHtml, grammarContent, englishContent, …
├── pages/               # Sahifalar
└── utils/
```

## Asosiy marshrutlar

| Path | Mazmun |
|------|--------|
| `/` | Bosh sahifa |
| `/dictionary`, `/dictionary/:id` | Túsinirme sozlik |
| `/dictionary/uzb\|en\|ru` | Ikki tilli |
| `/dictionary/frazeologiya`, `/imla`, `/adam-atlari` | Maxsus lug‘atlar |
| `/quiz`, `/quiz/adaptive`, `/quiz/room` | Testlar |
| `/crossword` | Krossvord |
| `/literature`, `/books`, `/writers` | Ádebiyat |
| `/qoidalar` | QQ grammatika (fordata MD) |
| `/english` | Ingliz fraza/mashq (fordata MD) |
| `/tutor`, `/games`, `/jumbaqlar` | Mashq |
| `/admin/*` | Admin (RBAC) |
| `/login`, `/register`, `/profile` | Auth |

To‘liq jadval: `src/App.jsx` yoki [d.md](../d.md) §5.2.

## API (qisqa)

Backend prefixlar (proxy orqali bir origin):

- `/api/auth/*` — login, me, profile  
- `/api/tusindirme/*` — sozlik (**dictionary emas**)  
- `/api/quizzes/*` — testlar  
- `/api/crosswords/*`, `/api/books/*`, `/api/morphology/*`, …

Batafsil: [d.md](../d.md) §4 · [backend/README.md](../backend/README.md).

## Context / sozlamalar

- **AuthContext** — Bearer token (`localStorage`)
- **UiScriptContext** — lotin / kirill
- **AppSettingsContext** — tema: day | night | sepia | focus

## Kontent MD

- QQ qoidalar: `fordata/grammar/*.md` → `/qoidalar`
- Ingliz: `fordata/english/*.md` → `/english` (`src/lib/englishContent.js`)

Yangi MD qo‘shganda mapper’ni yangilang.

## Eslatma

Eski hujjatlardagi **port 5173** va `/api/dictionary` — bekor. Hozir: **3000** va `/api/tusindirme`.
