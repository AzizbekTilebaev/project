# Frontend Setup Guide

## O'rnatish

### Kerakli Packagelar

```bash
npm install
```

### Environment Konfiguratsiyasi (ixtiyoriy)

Agar backend boshqa portda bo'lsa, `.env.local` yarating:

```
VITE_API_URL=http://localhost:5000
```

Default: `http://localhost:5000`

## Ishga Tushirish

### Development Mode

```bash
npm run dev
```

- Hot reload faol
- `http://localhost:5173` da ishlaidi

### Production Build

```bash
npm run build
npm run preview
```

## Texnologiyalar Setup

### Vite
- Code splitting
- Fast HMR (Hot Module Replacement)
- Optimized build

### React Router v6
- Client-side routing
- Dynamic route matching
- Lazy loading support

### Tailwind CSS
- Utility-first CSS
- Customizable theme
- PurgeCSS for optimization

## Backend Ulanmasi

Frontend backend API ga `fetch` yoki `axios` orqali muloqot qiladi.

Server port: `5000`

Muhim: Backend ishlaydigan bo'lishi kerak `/api` routes uchun:

```
http://localhost:5000/api/*
```

## Debugging

### Browser DevTools
- React DevTools extension o'rnatish tafsiya qilinadi
- Network tab - API calls
- Console - JavaScript errors

## Features

### Authentication
- Token-based (JWT)
- localStorage storage
- Protected routes

### Pages
- Ho'l loading states
- Error handling
- Responsive design

## Tuzatmalar

Har bir page component o'zining state management (useState) va data fetching (useEffect) logikasiga ega.

Profile avatari backend tomonida `multer` orqali saqlanadi.

## Deployment

Vite build output to `dist/` folder. Backend server tomonidan serve qilish kerak.
