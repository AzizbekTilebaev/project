import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter as Router, Navigate, Route, useLocation } from 'react-router-dom'
import Header from './components/Header'
import TutorReminderBanner from './components/TutorReminderBanner'
import ExitSurveyModal from './components/ExitSurveyModal'
import ActivityHeartbeat from './components/ActivityHeartbeat'
import PageGate from './components/PageGate'
import SiteFooter from './components/SiteFooter'
import OfflineBanner from './components/OfflineBanner'
import CookieConsentBanner from './components/CookieConsentBanner'
import AppErrorBoundary from './components/AppErrorBoundary'
import ContentProtection from './components/ContentProtection'
import AnimatedRoutes from './components/PageTransition'
import Home from './pages/Home'
import { UiScriptProvider } from './contexts/UiScriptContext'
import { AppSettingsProvider } from './contexts/AppSettingsContext'
import { AuthProvider } from './contexts/AuthContext'
import { recordRecentPage } from './lib/recentPages'

const Quiz = lazy(() => import('./pages/Quiz'))
const Dictionary = lazy(() => import('./pages/Dictionary'))
const DictionaryAll = lazy(() => import('./pages/DictionaryAll'))
const DictionaryRecent = lazy(() => import('./pages/DictionaryRecent'))
const DictionaryFavorites = lazy(() => import('./pages/DictionaryFavorites'))
const DictionaryStats = lazy(() => import('./pages/DictionaryStats'))
const DictionaryGame = lazy(() => import('./pages/DictionaryGame'))
const ImmersionBrowse = lazy(() => import('./pages/ImmersionBrowse'))
const WordDetail = lazy(() => import('./pages/WordDetail'))
const BilingualDictPage = lazy(() => import('./pages/BilingualDictPage'))
const BilingualDictDetail = lazy(() =>
  import('./pages/BilingualDictPage').then((m) => ({ default: m.BilingualDictDetail }))
)
const FrazeologiyaPage = lazy(() => import('./pages/FrazeologiyaPage'))
const FrazeologiyaDetail = lazy(() =>
  import('./pages/FrazeologiyaPage').then((m) => ({ default: m.FrazeologiyaDetail }))
)
const AdamAtlariPage = lazy(() => import('./pages/AdamAtlariPage'))
const AdamAtlariDetail = lazy(() =>
  import('./pages/AdamAtlariPage').then((m) => ({ default: m.AdamAtlariDetail }))
)
const ImlaDetail = lazy(() =>
  import('./pages/ImlaPage').then((m) => ({ default: m.ImlaDetail }))
)
const CrosswordsList = lazy(() => import('./pages/CrosswordsList'))
const CrosswordPage = lazy(() => import('./pages/CrosswordPage'))
const QuizRoom = lazy(() => import('./pages/QuizRoom'))
const CrosswordRoom = lazy(() => import('./pages/CrosswordRoom'))
const CrosswordsAdmin = lazy(() => import('./pages/CrosswordsAdmin'))
const Books = lazy(() => import('./pages/Books'))
const BooksAdmin = lazy(() => import('./pages/BooksAdmin'))
const ReadingLessonsAdmin = lazy(() => import('./pages/ReadingLessonsAdmin'))
const LiteratureHub = lazy(() => import('./pages/LiteratureHub'))
const Naqillar = lazy(() => import('./pages/Naqillar'))
const Ertekler = lazy(() => import('./pages/Ertekler'))
const GamesHub = lazy(() => import('./pages/GamesHub'))
const Writers = lazy(() => import('./pages/Writers'))
const WriterDetail = lazy(() => import('./pages/WriterDetail'))
const BookDetail = lazy(() => import('./pages/BookDetail'))
const BookReader = lazy(() => import('./pages/BookReader'))
const ReadingLesson = lazy(() => import('./pages/ReadingLesson'))
const Jumbaqlar = lazy(() => import('./pages/Jumbaqlar'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const AdaptiveQuiz = lazy(() => import('./pages/AdaptiveQuiz'))
const QuizStatistics = lazy(() => import('./pages/QuizStatistics'))
const Tutor = lazy(() => import('./pages/Tutor'))
const PracticeHub = lazy(() => import('./pages/PracticeHub'))
const ImmersionAdmin = lazy(() => import('./pages/ImmersionAdmin'))
const UsersAdmin = lazy(() => import('./pages/UsersAdmin'))
const DictionaryAdmin = lazy(() => import('./pages/DictionaryAdmin'))
const AdminPanel = lazy(() => import('./pages/AdminPanel'))
const QuizzesAdmin = lazy(() => import('./pages/QuizzesAdmin'))
const JumbaqlarAdmin = lazy(() => import('./pages/JumbaqlarAdmin'))
const WritersAdmin = lazy(() => import('./pages/WritersAdmin'))
const Settings = lazy(() => import('./pages/Settings'))
const Profile = lazy(() => import('./pages/Profile'))
const AuthPage = lazy(() => import('./pages/AuthPage'))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const NotFound = lazy(() => import('./pages/NotFound'))
const Faq = lazy(() => import('./pages/Faq'))
const About = lazy(() => import('./pages/About'))
const Privacy = lazy(() => import('./pages/Privacy'))
const Terms = lazy(() => import('./pages/Terms'))
const Qoidalar = lazy(() => import('./pages/Qoidalar'))
const QaraqalpaqTiliHub = lazy(() => import('./pages/QaraqalpaqTiliHub'))
const English = lazy(() => import('./pages/English'))
const CultureFacts = lazy(() => import('./pages/CultureFacts'))
const CommunityFeed = lazy(() => import('./pages/CommunityFeed'))

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);
  useEffect(() => {
    recordRecentPage(pathname);
  }, [pathname]);
  return null;
}

function RouteFallback() {
  return <PageGate status="loading" className="pt-28" />;
}

/** Og‘ir sahifa qulasa — faqat shu route qayta urinadi, butun shell emas */
function Bound({ children }) {
  return <AppErrorBoundary>{children}</AppErrorBoundary>;
}

function AppShell() {
  useEffect(() => {
    document.body.classList.add('kk-no-select');
    return () => document.body.classList.remove('kk-no-select');
  }, []);

  return (
    <>
      <ScrollToTop />
      <ContentProtection />
      <div className="min-h-screen qp-app-bg text-ink">
        <OfflineBanner />
        <CookieConsentBanner />
        <Header />
        <TutorReminderBanner />
        <ActivityHeartbeat />
        <ExitSurveyModal />
        <AppErrorBoundary>
          <Suspense fallback={<RouteFallback />}>
            <AnimatedRoutes>
              <Route path="/" element={<Home />} />
              <Route path="/quiz" element={<Bound><Quiz /></Bound>} />
              <Route path="/quiz/adaptive" element={<Bound><AdaptiveQuiz /></Bound>} />
              <Route path="/quiz/statistics" element={<QuizStatistics />} />
              <Route path="/statistics" element={<QuizStatistics />} />
              <Route path="/quiz/room" element={<Bound><QuizRoom /></Bound>} />
              <Route path="/quiz/room/:code" element={<Bound><QuizRoom /></Bound>} />
              <Route path="/quiz/:id" element={<Bound><Quiz /></Bound>} />
              <Route path="/tutor" element={<Bound><Tutor /></Bound>} />
              <Route path="/tutor/practice" element={<PracticeHub />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/faq" element={<Faq />} />
              <Route path="/about" element={<About />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/qoidalar" element={<Navigate to="/literature/qagiydalar" replace />} />
              <Route path="/english" element={<English />} />
              <Route path="/facts" element={<CultureFacts />} />
              <Route path="/community" element={<CommunityFeed />} />
              <Route path="/login" element={<AuthPage mode="login" />} />
              <Route path="/register" element={<AuthPage mode="register" />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/dictionary" element={<Dictionary />} />
              <Route path="/dictionary/all" element={<DictionaryAll />} />
              <Route path="/dictionary/recent" element={<DictionaryRecent />} />
              <Route path="/dictionary/favorites" element={<DictionaryFavorites />} />
              <Route path="/dictionary/stats" element={<DictionaryStats />} />
              <Route path="/dictionary/game" element={<Bound><DictionaryGame /></Bound>} />
              <Route path="/dictionary/immersion" element={<ImmersionBrowse />} />
              <Route path="/dictionary/uzb" element={<BilingualDictPage kind="uzb" />} />
              <Route path="/dictionary/uzb/:id" element={<BilingualDictDetail kind="uzb" />} />
              <Route path="/dictionary/en" element={<BilingualDictPage kind="en" />} />
              <Route path="/dictionary/en/:id" element={<BilingualDictDetail kind="en" />} />
              <Route path="/dictionary/ru" element={<BilingualDictPage kind="ru" />} />
              <Route path="/dictionary/ru/:id" element={<BilingualDictDetail kind="ru" />} />
              <Route path="/dictionary/frazeologiya" element={<FrazeologiyaPage />} />
              <Route path="/dictionary/frazeologiya/:id" element={<FrazeologiyaDetail />} />
              <Route path="/dictionary/adam-atlari" element={<AdamAtlariPage />} />
              <Route path="/dictionary/adam-atlari/:id" element={<AdamAtlariDetail />} />
              {/* Imla alohida roʻyxat emas — faqat túsindirme sózlikke bogʻlangan */}
              <Route path="/dictionary/imla" element={<Navigate to="/dictionary" replace />} />
              <Route path="/dictionary/imla/:id" element={<ImlaDetail />} />
              <Route path="/dictionary/:id" element={<Bound><WordDetail /></Bound>} />
              <Route path="/crossword" element={<CrosswordsList />} />
              <Route path="/crossword/room" element={<Bound><CrosswordRoom /></Bound>} />
              <Route path="/crossword/room/:code" element={<Bound><CrosswordRoom /></Bound>} />
              <Route path="/crossword/:id" element={<Bound><CrosswordPage /></Bound>} />
              <Route path="/admin/crosswords" element={<CrosswordsAdmin />} />
              <Route path="/admin/immersion" element={<ImmersionAdmin />} />
              <Route path="/admin/users" element={<UsersAdmin />} />
              <Route path="/admin/dictionary" element={<DictionaryAdmin />} />
              <Route path="/admin/quizzes" element={<QuizzesAdmin />} />
              <Route path="/admin/jumbaqlar" element={<JumbaqlarAdmin />} />
              <Route path="/admin/writers" element={<WritersAdmin />} />
              <Route path="/admin" element={<AdminPanel />} />
              <Route path="/literature" element={<LiteratureHub />} />
              <Route path="/kitapxana" element={<Navigate to="/literature" replace />} />
              <Route path="/literature/qaraqalpaq-tili" element={<QaraqalpaqTiliHub />} />
              <Route path="/literature/qagiydalar" element={<Qoidalar />} />
              <Route path="/literature/naqillar" element={<Bound><Naqillar /></Bound>} />
              <Route path="/literature/ertekler" element={<Bound><Ertekler /></Bound>} />
              <Route path="/games" element={<GamesHub />} />
              <Route path="/writers" element={<Writers />} />
              <Route path="/writers/:slug" element={<WriterDetail />} />
              <Route path="/jumbaqlar" element={<Jumbaqlar />} />
              <Route path="/books" element={<Books />} />
              <Route path="/books/:id" element={<BookDetail />} />
              <Route path="/books/:id/read" element={<Bound><BookReader /></Bound>} />
              <Route path="/books/:id/learn" element={<Bound><ReadingLesson /></Bound>} />
              <Route path="/admin/books" element={<BooksAdmin />} />
              <Route path="/admin/lessons" element={<ReadingLessonsAdmin />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="*" element={<NotFound />} />
            </AnimatedRoutes>
          </Suspense>
        </AppErrorBoundary>
        <SiteFooter />
      </div>
    </>
  );
}

function App() {
  return (
    <UiScriptProvider>
      <AppSettingsProvider>
        <AuthProvider>
          <Router>
            <AppShell />
          </Router>
        </AuthProvider>
      </AppSettingsProvider>
    </UiScriptProvider>
  )
}

export default App
