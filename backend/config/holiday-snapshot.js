// Verified transcription of the Ministry's 2026 programme, not invented dates.
// Refreshing announcements is handled by services/holidays.js. Do not roll these into another year.
export const MINISTRY = 'https://www.economy.gov.mk';
export const ANNOUNCEMENTS = `${MINISTRY}/mk-MK/odnosi-so-javnost/soopstenija`;
export const PROGRAMME_2026 = `${MINISTRY}/build/assets/programa-nerabotni-denovi-2026-MHaAbYyO.pdf`;
export const VERIFIED_ON = '2026-09-20';
// The annual PDF's Republic Day substitute contains a typo. This later official
// announcement explicitly confirms Sunday 2 August and Monday 3 August 2026.
export const VERIFIED_CORRECTIONS = {
  republic: { date: '2026-08-03', holidayDate: '2026-08-02', sourceUrl: `${ANNOUNCEMENTS}/soopstenie-za-neraboten-den753` },
};
// id, month-day, scope, Macedonian, English, lesson family.
export const SNAPSHOT_2026 = [
  ['new-year', '01-01', 'all', 'Нова година', 'New Year', 'reuse'],
  ['orthodox-christmas', '01-07', 'all', 'Божик', 'Orthodox Christmas', 'reuse'],
  ['eid-fitr', '03-20', 'all', 'Рамазан Бајрам', 'Eid al-Fitr', 'sharing'],
  ['orthodox-easter', '04-13', 'all', 'Велигден, втор ден', 'Orthodox Easter Monday', 'easter'],
  ['labour', '05-01', 'all', 'Ден на трудот', 'Labour Day', 'community'],
  ['cyril-methodius', '05-25', 'all', 'Св. Кирил и Методиј, неработен ден', 'Saints Cyril and Methodius, observed', 'books'],
  ['republic', '08-02', 'all', 'Ден на Републиката', 'Republic Day', 'community'],
  ['independence', '09-08', 'all', 'Ден на независноста', 'Independence Day', 'community'],
  ['uprising', '10-12', 'all', 'Ден на народното востание, неработен ден', 'Uprising Day, observed', 'community'],
  ['revolution', '10-23', 'all', 'Ден на македонската револуционерна борба', 'Macedonian Revolutionary Struggle Day', 'community'],
  ['clement', '12-08', 'all', 'Св. Климент Охридски', 'Saint Clement of Ohrid', 'books'],
  ['christmas-eve', '01-06', 'orthodox', 'Бадник', 'Orthodox Christmas Eve', 'reuse'],
  ['epiphany', '01-19', 'orthodox', 'Богојавление', 'Epiphany', 'water'],
  ['good-friday', '04-10', 'orthodox', 'Велики Петок', 'Orthodox Good Friday', 'easter'],
  ['pentecost', '05-29', 'orthodox', 'Духовден', 'Friday before Pentecost', 'sharing'],
  ['dormition', '08-28', 'orthodox', 'Успение на Пресвета Богородица', 'Dormition', 'sharing'],
  ['catholic-easter', '04-06', 'catholic', 'Католички Велигден, втор ден', 'Catholic Easter Monday', 'easter'],
  ['all-saints', '11-01', 'catholic', 'Празник на сите светци', 'All Saints’ Day', 'community'],
  ['catholic-christmas', '12-25', 'catholic', 'Католички Божик', 'Catholic Christmas', 'reuse'],
  ['eid-adha', '05-27', 'muslim', 'Курбан Бајрам', 'Eid al-Adha', 'sharing'],
  ['albanian-alphabet', '11-22', 'albanian', 'Ден на албанската азбука', 'Albanian Alphabet Day', 'books'],
  ['saint-sava', '01-27', 'serbian', 'Свети Сава', 'Saint Sava', 'books'],
  ['roma', '04-08', 'roma', 'Меѓународен ден на Ромите', 'International Roma Day', 'community'],
  ['vlach', '05-23', 'vlach', 'Национален ден на Власите', 'Vlach National Day', 'community'],
  ['yom-kippur', '09-21', 'jewish', 'Јом Кипур', 'Yom Kippur', 'sharing'],
  ['bosniak', '09-28', 'bosniak', 'Меѓународен ден на Бошњаците', 'International Bosniak Day', 'community'],
  ['turkish-language', '12-21', 'turkish', 'Ден на наставата на турски јазик', 'Turkish Language Education Day', 'books'],
];
export const KNOWN_ANNOUNCEMENTS = ['soopstenie-za-neraboten-den52', 'soopstenie-za-neraboten-den14', 'soopstenie-za-neraboten-den69', 'soopstenie-za-neraboten-den753'].map(slug => `${ANNOUNCEMENTS}/${slug}`);
