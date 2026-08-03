# React Components Guide

## Header Component

**File:** `src/components/Header.jsx`

Navigation bar barcha sahifalarning yuqori qismida.

### Features
- Mobile responsive menu
- Auth links (Login, Register, Profile)
- Navigation links to all pages

### Props
None - uses React Router Link component

## Page Components

### Home (`src/pages/Home.jsx`)
Bosh sahifa.

**State:**
- `quizzes` - Mavjud testlar
- `dictionary` - Lug'at entry's
- `ebooks` - E-kitoblar
- `loading` - Loading state

**API Calls:**
- GET `/api/quizzes`
- GET `/api/dictionary`
- GET `/api/ebooks`

### Login (`src/pages/Login.jsx`)
Kirish sahifasi.

**State:**
- `email` - Email input
- `password` - Password input
- `error` - Error message
- `loading` - Processing state

**API Call:**
- POST `/api/auth/login` - Credentials bilan

**Result:**
- localStorage da token saqlar
- user ma'lumotlarini saqlar
- Profile page ga yo'naltirishadi

### Register (`src/pages/Register.jsx`)
Ro'yxatdan o'tish sahifasi.

**State:**
- `username` - Username input
- `email` - Email input
- `password` - Password input
- `error` - Error message
- `loading` - Processing state

**API Call:**
- POST `/api/auth/register`

**Result:**
- Yangi akkaunt yaratadi
- Login page ga yo'naltirishadi

### Profile (`src/pages/Profile.jsx`)
Foydalanuvchi profili.

**State:**
- `user` - User data
- `editMode` - Edit mode toggle
- `formData` - Form data
- `loading` - Loading state

**API Calls:**
- GET `/api/users/me` - Profile loaded shayida
- POST `/api/users/profile` - Update profil (avatar bilan)

**Features:**
- Avatar upload (multer)
- Bio editing
- Logout button

### Quiz (`src/pages/Quiz.jsx`)
Testlar sahifasi.

**State:**
- `quizzes` - Available quizzes
- `selectedQuiz` - Currently taking quiz
- `answers` - User answers
- `loading` - Loading state

**API Calls:**
- GET `/api/quizzes`
- POST `/api/quizzes/submit` - Answers submit

### Dictionary (`src/pages/Dictionary.jsx`)
Lug'at.

**State:**
- `entries` - Dictionary entries
- `searchTerm` - Search input
- `loading` - Loading state

**API Calls:**
- GET `/api/dictionary`
- GET `/api/dictionary/search?q=...`

### Crossword Pages

#### CrosswordsList (`src/pages/CrosswordsList.jsx`)
Barcha krossvordlar ro'yxati.

**State:**
- `crosswords` - Krossvordlar ro'yxati
- `loading` - Loading state

**API Call:**
- GET `/api/crosswords`

#### CrosswordPage (`src/pages/CrosswordPage.jsx`)
Individual krossvord.

**Props:**
- `id` - Krossvord ID (URL parametrdan)

**State:**
- `crossword` - Current crossword data

**API Call:**
- GET `/api/crosswords/:id`

#### Crossword (`src/pages/Crossword.jsx`)
Krossvord game logic.

**Props:**
- `crosswordData` - O'yin ma'lumotlari

**State:**
- `grid` - O'yin gridi
- `userAnswers` - Foydalanuvchi javobları
- `hints` - Clue'lar

### Books (`src/pages/Books.jsx`)
E-kitoblar ro'yxati.

**State:**
- `books` - Kitoblar ro'yxati
- `selectedBook` - Tanlangan kitob
- `loading` - Loading state

**API Calls:**
- GET `/api/books`
- GET `/api/books/:id`

## Routing

App.jsx da barcha routes aniqlanadi:

```jsx
<Routes>
  <Route path="/" element={<Home />} />
  <Route path="/login" element={<Login />} />
  <Route path="/register" element={<Register />} />
  <Route path="/profile" element={<Profile />} />
  <Route path="/quiz" element={<Quiz />} />
  <Route path="/dictionary" element={<Dictionary />} />
  <Route path="/crossword" element={<CrosswordsList />} />
  <Route path="/crossword/:id" element={<CrosswordPage />} />
  <Route path="/books" element={<Books />} />
</Routes>
```

## State Management

Hozirda component-level state (useState) foydalanilmoqda. Redux yoki Context API qo'shish kerak bo'lsa, bu fayl yangilanilib boriladi.

## Data Fetching

Barcha API calls useEffect orqali amalga oshiriladi.

### Pattern:

```jsx
useEffect(() => {
  const fetchData = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/endpoint')
      const data = await res.json()
      setState(data)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }
  fetchData()
}, [])
```

## Authentication

Protected routes uchun token check qilinadi:

```jsx
const token = localStorage.getItem('token')
if (!token) {
  navigate('/login')
}
```

User data localStorage da JSON sifatida saqlanadi.
