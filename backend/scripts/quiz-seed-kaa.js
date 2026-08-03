/**
 * Quiz seed kontenti — to‘liq qaraqalpaq latin.
 * setup-quiz-db.js hám localize-quiz-kaa.js usı fayldan paydalanadı.
 */
export const SEED_QUIZZES_KAA = [
  {
    id: '1',
    title: 'Qaraqalpaq tiliniń tariyxın bilesiz be?',
    description: 'Qaraqalpaq tiliniń tariyxıy rawajlanıwı haqqında test.',
    level: 'beginner',
    category: 'history',
    timeMode: 'untimed',
    questions: [
      {
        question: 'Qaraqalpaq tili qaysı tiller shańaraǵına tiyisli?',
        options: ['Túrkiy', 'Indo-german', 'Semit', 'Altay'],
        correctAnswer: 'Túrkiy',
      },
      {
        question: 'Qaraqalpaq xalqı qaysı aymaqta jasaydı?',
        options: ['Mawaraunnahr', 'Aral boyı', 'Qoqan', 'Buxara'],
        correctAnswer: 'Aral boyı',
      },
      {
        question: 'Qaraqalpaq ádebiyatınıń eń belgili shayırlarınıń biri kim?',
        options: ['Nawayı', 'Yunus Rajabiy', 'Berdaq', 'Mashrab'],
        correctAnswer: 'Berdaq',
      },
      {
        question: 'Qaraqalpaqstan qaysı mámleket quramında?',
        options: ['Qazaqstan', 'Ózbekstan', 'Túrkmenstan', 'Qırǵızstan'],
        correctAnswer: 'Ózbekstan',
      },
      {
        question: 'Aral teńizi boyındaǵı tiykarǵı qala qaysı?',
        options: ['Nókis', 'Tashkent', 'Almatı', 'Ashgabat'],
        correctAnswer: 'Nókis',
      },
    ],
  },
  {
    id: '2',
    title: 'Qaraqalpaq grammatikasın bilesiz be?',
    description: 'Qaraqalpaq tiliniń grammatikalıq qaǵıydaları haqqında test.',
    level: 'intermediate',
    category: 'grammar',
    timeMode: 'timed',
    timeLimitSeconds: 240,
    questions: [
      {
        question: '«Men» sózi qaysı sóz túrkumine mısal?',
        options: ['Atlıq', 'Fel', 'Almastırma', 'Sıpat'],
        correctAnswer: 'Almastırma',
        timeLimitSeconds: 60,
      },
      {
        question: 'Qaraqalpaq tilinde neshe dawıslı bar?',
        options: ['6', '8', '9', '10'],
        correctAnswer: '9',
        timeLimitSeconds: 60,
      },
      {
        question: 'Tómendegi sózlerdiń kóplik forması qaysı?',
        options: ['kitap', 'kitaplar', 'kitap-lar', 'kitapları'],
        correctAnswer: 'kitaplar',
        timeLimitSeconds: 60,
      },
      {
        question: '«Jaqsı» sózi qaysı sóz túrkumine tiyisli?',
        options: ['Atlıq', 'Fel', 'Sıpat', 'San'],
        correctAnswer: 'Sıpat',
        timeLimitSeconds: 60,
      },
      {
        question: '«Barıw» sózi qaysı sóz túrkumine mısal?',
        options: ['Fel', 'Atlıq', 'Almastırma', 'Úndeş'],
        correctAnswer: 'Fel',
        timeLimitSeconds: 60,
      },
    ],
  },
  {
    id: '3',
    title: 'Qaraqalpaq sózligi',
    description: 'Qaraqalpaq sózleriniń mánisi hám qollanıwı haqqında test.',
    level: 'beginner',
    category: 'vocabulary',
    timeMode: 'untimed',
    questions: [
      {
        question: '«Qas» sóziniń mánisi ne?',
        options: ['Kóz', 'Qas', 'Awız', 'Murın'],
        correctAnswer: 'Qas',
      },
      {
        question: '«Ana» sózi kimdi bildiredi?',
        options: ['Qız', 'Ana', 'Áke', 'Aǵa'],
        correctAnswer: 'Ana',
      },
      {
        question: '«Asp» sózi qaysı haywandı bildiredi?',
        options: ['Eshek', 'At', 'Túye', 'Qoy'],
        correctAnswer: 'At',
      },
      {
        question: '«Suw» sóziniń mánisi ne?',
        options: ['Ot', 'Jer', 'Suw', 'Hawa'],
        correctAnswer: 'Suw',
      },
      {
        question: '«Úy» sózi neni bildiredi?',
        options: ['Jol', 'Úy', 'Baǵ', 'Bazar'],
        correctAnswer: 'Úy',
      },
    ],
  },
  {
    id: '4',
    title: 'Ádebiyat hám mádeniyat',
    description: 'Qaraqalpaq ádebiyatı, shayırlar hám mádeniyat haqqında test.',
    level: 'advanced',
    category: 'history',
    timeMode: 'untimed',
    questions: [
      {
        question: 'Berdaq qaysı janrda kóp shıǵarma jazǵan?',
        options: ['Roman', 'Poeziya', 'Dramma', 'Esse'],
        correctAnswer: 'Poeziya',
      },
      {
        question: 'Qaraqalpaq tilinde jazıw túri qaysılar?',
        options: ['Tek kirill', 'Tek latın', 'Kirill hám latın', 'Tek arab'],
        correctAnswer: 'Kirill hám latın',
      },
      {
        question: '«Ádebiyat» sóziniń qısqasha mánisi?',
        options: ['Sanaw', 'Kórkem sóz óneri', 'Sport', 'Sawda'],
        correctAnswer: 'Kórkem sóz óneri',
      },
      {
        question: 'Jumbaq ne?',
        options: ['Muzıka túri', 'Sheshiwge arnalǵan qupıya sóz oyını', 'As túri', 'Kiyim'],
        correctAnswer: 'Sheshiwge arnalǵan qupıya sóz oyını',
      },
      {
        question: 'Sózlik ne ushın kerek?',
        options: [
          'Tek oyın ushın',
          'Sóz mánisin bilip, til úyreniw ushın',
          'Tek sanaw ushın',
          'Tek jazıw ushın',
        ],
        correctAnswer: 'Sóz mánisin bilip, til úyreniw ushın',
      },
    ],
  },
];
