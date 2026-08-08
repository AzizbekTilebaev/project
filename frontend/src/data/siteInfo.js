/**
 * Sayt haqqında hám FAQ — latın qaraqalpaqsha.
 * UI `text()` arqalı kórsetiledi.
 */

export const ABOUT = {
  eyebrow: 'Platforma',
  title: 'Qaraqalpaq til platforması',
  lead:
    'Sózlik, ádebiyat, test, immersiya hám kúndelikli mashq — bir orında. Maqset: qaraqalpaq tilin oqıw, seziw hám qayta úyreniw.',
  missionTitle: 'Maqset',
  mission:
    'Túsindirme sózlik tiykarında ámeliy oqıw jolın jaratıw: sózdi tabıń, tıńlań, mashq etiń, qátelerdi qayta isleń — hár kúni bir qádem.',
  sectionsTitle: 'Neler bar?',
  sections: [
    {
      title: 'Sózlik',
      body: 'Latın hám kirill izlew, anıqlama, mısal, omonimler, kún sózi hám unatqanlar.',
      to: '/dictionary',
    },
    {
      title: 'Immersiya',
      body: 'Dawıslı sózler — tıńlań, keyin mashq orayına ótiń.',
      to: '/dictionary/immersion',
    },
    {
      title: 'Úyretiwshi hám mashq',
      body: 'Qáte bankı, aralas sessíya, kún sózi mashqı.',
      to: '/tutor/practice',
    },
    {
      title: 'Testler',
      body: 'Klassikalıq hám adaptiv (IRT) testler, statistika.',
      to: '/quiz',
    },
    {
      title: 'Ádebiyat',
      body: 'Kitaplar, jazıwshılar, oqıw darsi.',
      to: '/literature',
    },
    {
      title: 'Til qoidaları',
      body: '1–11 klass grammatika qoidaları — klass toparları boyınsha.',
      to: '/qoidalar',
    },
    {
      title: 'Inglis tili',
      body: 'Kids’ / Fly High / Teens’ English — unitlar hám grammatika (QQ).',
      to: '/english',
    },
    {
      title: 'Oyınlar',
      body: 'Sóz oyını hám krossvordlar.',
      to: '/dictionary/game',
    },
  ],
  principlesTitle: 'Qádeler',
  principles: [
    {
      text: 'Sózlik, test, krossvord hám mashq — mehman ushın sheksiz.',
      to: '/tutor/practice',
      icon: 'bolt',
    },
    {
      text: 'Latın / kirill — bir basıwda almasıw.',
      to: '/settings',
      icon: 'layers',
    },
    {
      text: 'Qáteler bankı — úyreniw ushın, jazalaw ushın emes.',
      to: '/tutor',
      icon: 'tutor',
    },
    {
      text: 'Jámiyet — sinonim/antonim usınıslarına dawıs.',
      to: '/community',
      icon: 'users',
    },
    {
      text: 'Dizim ixtıyarıy — soft profil / statistika sync ushın.',
      to: '/profile',
      icon: 'chart',
    },
  ],
  freePlayEyebrow: 'Házir baslań — dizimsiz',
  privacyTitle: 'Qupıya hám maǵlıwmat',
  privacy:
    'Mehman rejiminde brauzer identifikatorı menen progress saqlanadı. Dizimnen ótsańız, tariyx akkauntqa baylanıstıraladı. Parol hám jeke maglıwmatlar qáwipsiz saqlanadı.',
};

export const FAQ_ITEMS = [
  {
    id: 'what',
    q: 'Bul sayt ne?',
    a: 'Qaraqalpaq tilin úyreniw platforması: túsindirme sózlik, dawıslı immersiya, testler, krossvord, kitaplar hám kúndelikli mashq bir ekosistemada.',
  },
  {
    id: 'script',
    q: 'Latın yamasa kirill — qalay ózgertemen?',
    a: 'Joqarı menyudegi «Lat / Кир» (yamasa uqsas) túyme arqalı interfeys jazıwın almastırasız. Sózlik izlewinde eki jazıw da qabıl etiledi.',
  },
  {
    id: 'guest',
    q: 'Dizimsiz paydalansam boladı ma?',
    a: 'Awa. Bas betten bir jol saylań: sózlik, test, krossvord yamasa mashq/ádebiyat — mehman ushın sheksiz. Dizim — progress, ball hám statistikani qurılmalar arasında saqlaw ushın ixtıyarıy.',
  },
  {
    id: 'search',
    q: 'Sóz tabılmasa ne qılam?',
    a: 'Izlew imlo/typoǵa da qaraydı hám uqsas sózlerdi usınıs etedi. Taʼrif boyınsha da tabılıwı múmkin. Anıq sáykes joq bolsa — «Bálkim bular?» diziminan saylań.',
  },
  {
    id: 'wod',
    q: 'Kún sózi hám «Búgin · 2/2» ne?',
    a: 'Hár kúni bir sóz kórsetiledi. Onı belgileseńiz streak (kún qatarı) hám ball alasıńız. Keyin «Kún sózin mashq etiń» — búginniń ekinshi qádemi. Chip 0/2 → 2/2 bolǵanda maqset tamam.',
  },
  {
    id: 'practice',
    q: 'Mashq orayı qalay isleydi?',
    a: 'Qáteler, unatqanlar, sońǵı sózler, oqıw darsi hám tıńlaǵan immersiya sózlerin bir sessiyada oyın formasında qayta úyretedi. Mashq orayınan baslań.',
  },
  {
    id: 'tutor',
    q: 'Úyretiwshi (Tutor) AI ma?',
    a: 'Joq — qáide tiykarındaǵı murabbiy. Qáte bankıńızǵa qarap mini-dars hám esletpeler beredi. «AI» emes, ámeliy mashq.',
  },
  {
    id: 'adaptive',
    q: 'Adaptiv test neni ańlatadı?',
    a: 'IRT tiykarında hár juwapdan keyin keyingi soraw ańsatlaw yamasa qıyınlaw boladı. Durıs variant kórsetilmeydi — bank jasırın qaladı; θ (qábilet) kórsetkish ózgeredi.',
  },
  {
    id: 'points',
    q: 'Ball hám juwap analizı',
    a: 'Test hám oyınlar ushın ball jıynaladı. Tolıq juwap analizın ashıw ball menen tólenedi (qátelerdi bepul «ashıw» emes). Balans soft Profil yamasa Statistikada kórinedi — dizim ixtıyarıy.',
  },
  {
    id: 'immersion',
    q: 'Dawıslı sózler qayda?',
    a: 'Sózlik → Dawıslı sózler yamasa sóz betindegi Immersiya blokı. Tıńlaǵannan keyin mashq navbatına qosıw múmkin.',
  },
  {
    id: 'favorites',
    q: 'Unatqanlar qalay saqlanadı?',
    a: 'Sóz betinde júrek belgisi. Unatqanlar boyınsha ayırım oyın hám mashq orayı bar.',
  },
  {
    id: 'books',
    q: 'Kitaplar hám oqıw darsi',
    a: 'Ádebiyat bóliminde kitaplar hám jazıwshılar. Ayırım kitaplarda «úyreniw» (oqıw darsi) bar — qáteler mashq navbatına ótedi.',
  },
  {
    id: 'contribute',
    q: 'Qáte kórdim / usınıs beriw',
    a: 'Jámiyet betinde sinonim, antonim hám qurma usınıslarına dawıs beriń. Sóz betinen jańa usınıs jiberiw múmkin — admin moderaciyası menen qabıl etiledi.',
  },
];
