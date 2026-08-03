# Qaraqalpaq Til Platformasi - Frontend

React + Vite + Tailwind CSS orqali yaratilgan frontend.

## Tezkor Boshlash

```bash
npm install
npm run dev
```

Server `http://localhost:5173` da ishlaidi.

## Loyiha Tuzilishi

```
src/
├── App.jsx              # Routing va layout
├── main.jsx             # Entry point
├── index.css            # Global styles
├── components/
│   └── Header.jsx       # Navigation
└── pages/
    ├── Home.jsx         # Bosh sahifa
    ├── Login.jsx        # Kirish
    ├── Register.jsx     # Ro'yxatdan o'tish
    ├── Profile.jsx      # Profil
    ├── Quiz.jsx         # Testlar
    ├── Dictionary.jsx   # Lug'at
    ├── Books.jsx        # Kitoblar
    ├── Crossword.jsx    # Krossvord
    ├── CrosswordsList.jsx
    ├── CrosswordPage.jsx
    └── new.jsx          # Yangi krossvord
```

## Sahifalar

| URL | Tavsif |
|-----|--------|
| `/` | Bosh sahifa |
| `/login` | Kirish |
| `/register` | Ro'yxatdan o'tish |
| `/profile` | Foydalanuvchi profili |
| `/quiz` | Testlar |
| `/dictionary` | Lug'at |
| `/books` | Kitoblar |
| `/crossword` | Krossvordlar |
| `/crossword/:id` | Krossvord o'ynash |

## Texnologiyalar

- React 18
- React Router v6
- Vite
- Tailwind CSS
- Fetch API

## API

Backend: `http://localhost:5000`

Muhim endpoints:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/users/me`
- `PUT /api/users/profile`
- `GET /api/quizzes`
- `GET /api/dictionary`
- `GET /api/books`
- `GET /api/crosswords`

## Ishlab Chiqish

```bash
npm run dev      # Development
npm run build    # Production build
npm run preview  # Preview build
```

## Authentication

Token va foydalanuvchi ma'lumotlari `localStorage` da saqlanadi:
- `token` - JWT token
- `user` - User data (JSON)

## Konfiguratsiya

- `vite.config.js` - Vite sozlamalari
- `tailwind.config.js` - Tailwind CSS
- `postcss.config.js` - PostCSS
- `index.html` - HTML shabloni



