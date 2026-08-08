/**
 * Maxfiylik / foydalanish shartlari — qaraqalpaq UI matni (UiScript orqali KIR/LAT).
 */
export const LEGAL = {
  eyebrow: 'Huqıqıy',
  seeAlso: 'Sondey-aq:',

  privacyTitle: 'Maxfiylik siyasatı',
  privacyLead:
    'Bul bet saytta qanday maǵlıwmat jıynalatuǵının hám onı qalay basqarıw múmkinligin túsindiredi.',
  privacySections: [
    {
      heading: 'Ne jıynaladı',
      body:
        'Mehman rejiminde brauzerde anonim identifikator (UUID) saqlanadı — progress, check-in hám lokal sevimliler ushın. Dizimnen ótsańız, email hám (ixtıyarıy) at saqlanadı. Qurılma push tokenı (FCM/APNs) — tek ruxsat berilgende.',
    },
    {
      heading: 'Qayda saqlanadı',
      body:
        'Serverda MySQL bazalarında (foydalanıwshı, statistika, sevimliler). Parollar xeshlenedi. Mehman sevimlileri aldın localStorage’da, login’dan keyin serverge sync etiledi.',
    },
    {
      heading: 'Óshiriw huqıqı',
      body:
        'Statistika / profil bo‘liminen «maǵlıwmatımdı óshir» (DELETE /api/quizzes/privacy/me) arqalı actor baylanıslı oqıw tariyxı, device tokenlar hám uqsas jazıwlar tozalanadı. Dizim akkauntın óshiriw ushın qollap-quwatlawǵa murajat etińiz.',
    },
    {
      heading: 'Úshinshi tárep',
      body:
        'Kirish ushın Google OAuth ixtıyarıy. Analitika ushın shaxsiy reklama trekerleri qoýılmaydı. Health/monitor (mısalı UptimeRobot) tek server holatin tekseredi.',
    },
  ],

  termsTitle: 'Paydalanıw shártleri',
  termsLead: 'Sayttan paydalanıw — tómenǵi qáǵiydalarǵa kelisiwdi ańlatadı.',
  termsSections: [
    {
      heading: 'Maqset',
      body:
        'Platforma qaraqalpaq tilin úyreniw ushın: sózlik, oyınlar, ádebiyat, qoidalar. Kontent bilim beriw maqsetinde beriledi; rásmiy huqıqıy keńes emes.',
    },
    {
      heading: 'Juwapkershilik',
      body:
        'Paydalanıwshı óz akkauntı hám jibergen kontenti (usınıs, feedback) ushın juwapker. Spam, avtomatik urınıwlar hám xızmetti buzıw tıyıladı — rate-limit hám blok qollanılıwı múmkin.',
    },
    {
      heading: 'Kontent',
      body:
        'Sózlik hám ádebiyat materialları mualliflik huqıqı menen qorǵalıwı múmkin. Jeke paydalanıw / oqıw ruxsat; massiv kóshiriw yamasa qayta satıw ushın aldin razılıq kerek.',
    },
    {
      heading: 'Ózgeriwler',
      body:
        'Xızmet hám usı shártler jańalanıwı múmkin. Áhmiyetli ózgeriwler sayt arqalı bildiriliwi múmkin. Dawam etken paydalanıw jańa shártlerdi qabıl etiwdi ańlatadı.',
    },
  ],
};
