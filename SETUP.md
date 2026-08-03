# Project Setup Guide

Butun loyiham to'liq setup qilish qo'llanmasi.

## 📋 Requirements

- **Node.js** 16+ (https://nodejs.org/)
- **MySQL 8.0+** (https://dev.mysql.com/downloads/mysql/)
- **npm** yoki **yarn** (Node.js bilan birga)
- **Git** (optional)

Versions check:
```bash
node --version
npm --version
mysql --version
```

## 🚀 Quick Start

### 1. Clone/Download Project

```bash
cd /path/to/project
```

### 2. MySQL Server Boshlash

**Windows:**
```bash
net start MySQL80
```

**Mac:**
```bash
/usr/local/mysql/support-files/mysql.server start
```

**Linux:**
```bash
sudo systemctl start mysql
```

### 3. Backend Setup

```bash
cd backend

# Environment variables
# .env fayl yaratish:
DATABASE_URL=mysql://root@localhost:3306/tilplatform
JWT_SECRET=your_secret_key_here
PORT=5000

# Install dependencies
npm install

# Database setup
npx prisma migrate dev

# Start server
npm run dev
```

Server: `http://localhost:5000`

### 4. Frontend Setup

Yangi terminal'da:

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Server: `http://localhost:5173`

## ✅ Verification

### Backend

```bash
# Check if running
curl http://localhost:5000/api/quizzes

# Should return JSON response
```

### Frontend

- Browser'da `http://localhost:5173` ochish
- Home page ko'rinishi kerak

## 📁 Directory Structure

```
project-root/
├── backend/
│   ├── src/
│   ├── scripts/
│   ├── public/
│   ├── .env
│   ├── package.json
│   ├── README.md
│   └── SETUP.md
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── .env (optional)
│   ├── package.json
│   ├── vite.config.js
│   ├── README.md
│   ├── SETUP.md
│   └── COMPONENTS.md
│
├── package.json
├── README.md
└── START_ALL.ps1
```

## 🔧 Configuration Files

### backend/.env

```env
# Database
DATABASE_URL=mysql://root:password@localhost:3306/tilplatform

# JWT
JWT_SECRET=change_to_something_secure

# Server
PORT=5000
NODE_ENV=development
```

### frontend/.env (optional)

```env
VITE_API_URL=http://localhost:5000
```

If not set, default is `http://localhost:5000`

## 📊 Database

### Create Database

```sql
-- MySQL CLI
mysql -u root -p

-- Run:
CREATE DATABASE tilplatform CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### Auto Schema

Prisma automatically creates tables from schema.

View database:
```bash
cd backend
npx prisma studio
```

Opens: `http://localhost:5555`

## 🚦 Start All

Windows PowerShell:
```bash
.\START_ALL.ps1
```

Or manually:
```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev
```

## 🧪 Test APIs

### Using Postman/Thunder Client

Register:
```
POST http://localhost:5000/api/auth/register
Content-Type: application/json

{
  "username": "testuser",
  "email": "test@example.com",
  "password": "password123"
}
```

Login:
```
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "password123"
}
```

Get Quizzes:
```
GET http://localhost:5000/api/quizzes
```

## 🔍 Folder Descriptions

### Backend (Express + MySQL + Prisma)

**Key Files:**
- `src/server.js` - Main server
- `src/controllers/` - Business logic
- `src/routes/` - API endpoints
- `src/middleware/auth.js` - JWT verification
- `.env` - Configuration
- `prisma/schema.prisma` - Database schema

**Main Folders:**
- `src/` - Source code
- `scripts/` - Setup/seed scripts
- `public/avatars/` - User avatars
- `node_modules/` - Dependencies

### Frontend (React + Vite)

**Key Files:**
- `src/App.jsx` - Main component
- `src/main.jsx` - Entry point
- `src/pages/*.jsx` - Page components
- `vite.config.js` - Build config
- `tailwind.config.js` - Styling

**Main Folders:**
- `src/` - React code
- `src/pages/` - Page components
- `src/components/` - Reusable components
- `node_modules/` - Dependencies

## 🔐 Security Notes

- Change JWT_SECRET in production
- Use strong database password
- Don't commit `.env` files
- Use HTTPS in production
- Keep dependencies updated

## 🐛 Troubleshooting

### Port Already in Use

```bash
# Windows - Find process using port 5000
netstat -ano | findstr :5000

# Kill process
taskkill /PID <PID> /F

# Or use different port
PORT=5001 npm run dev
```

### MySQL Connection Error

```bash
# Check MySQL is running
mysql -u root -p

# If error, start MySQL:
# Windows: net start MySQL80
# Mac: /usr/local/mysql/support-files/mysql.server start
```

### Database Already Exists

```bash
# Drop database (careful!)
npx prisma migrate reset

# Or manually:
mysql -u root -p
DROP DATABASE tilplatform;
CREATE DATABASE tilplatform CHARACTER SET utf8mb4;
```

### Module Not Found

```bash
# Clear and reinstall
rm -rf node_modules package-lock.json
npm install
```

### CORS Error in Frontend

Make sure backend is running and `.env` has correct API_URL

## 📝 Important Notes

1. **Keep 2 terminals open** - One for backend, one for frontend
2. **Database must be running** - Before starting backend
3. **Port conflicts** - Change port in `.env` if needed
4. **Hot reload** - Both servers have hot reload enabled

## 🎯 Next Steps

1. ✅ Backend setup - See [backend/SETUP.md](backend/SETUP.md)
2. ✅ Frontend setup - See [frontend/SETUP.md](frontend/SETUP.md)
3. ✅ Components - See [frontend/COMPONENTS.md](frontend/COMPONENTS.md)
4. ✅ API docs - See [backend/README.md](backend/README.md)

## 💡 Tips

- Use VS Code for development
- Install extensions:
  - Prisma (for database schema)
  - REST Client (for API testing)
  - React snippets (for frontend)
- Use browser DevTools for debugging

## 📞 Support

Check logs if something fails:
- Backend: Console output
- Frontend: Terminal + Browser console
- Database: MySQL logs

---

**Status**: ✅ Ready to Develop  
**Date**: February 2026
