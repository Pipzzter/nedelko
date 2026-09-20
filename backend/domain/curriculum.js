import { pair, textPair, invalid, MATERIALS } from './settings.js';
import { occasionsForWeek } from './holidays.js';
import { defaultDayActivities } from './day-activities.js';

const lesson = (title, goal, inside, outside, habit) => ({ title: pair(...title), goal: pair(...goal), inside: pair(...inside), outside: pair(...outside), habit: pair(...habit) });
const ECO = [
  lesson(['Втор живот за хартијата', 'A second life for paper'],
    ['Откриваме како повторно да користиме еден предмет.', 'Discover how one object can be used again.'],
    ['Од чиста користена хартија правиме заеднички град. Секое дете предлага нова употреба.', 'Build a shared town from clean used paper. Each child suggests a new use.'],
    ['Во дворот правиме мала изложба на нашите градби и ги собираме сите материјали по играта.', 'Make a small display of our creations in the yard and collect every material afterwards.'],
    ['Пред да фрлиме, размислуваме за уште една употреба.', 'Before throwing something away, think of another use.']),
  lesson(['Мали чувари на водата', 'Little water keepers'],
    ['Вежбаме да користиме само онолку вода колку што ни треба.', 'Practise using only the water we need.'],
    ['Со цртежи го следиме патот на капката. Вежбаме затворање на чешмата при миење раце.', 'Draw a water droplet’s journey. Practise turning the tap off while soaping hands.'],
    ['Ги набљудуваме растенијата во дворот. Воспитувачот покажува како се полева само околу коренот.', 'Observe plants in the yard. The teacher demonstrates watering just around the roots.'],
    ['Ја затвораме чешмата додека ги сапуниме рацете.', 'Turn the tap off while soaping our hands.']),
  lesson(['Секој предмет има свое место', 'Everything has a place'],
    ['Разликуваме материјали и зборуваме за повторна употреба.', 'Recognise materials and talk about reuse.'],
    ['Сортираме чисти примероци од хартија и картон според материјал. Проверуваме што прифаќа локалното собирање.', 'Sort clean paper and cardboard samples by material. Check what local collections accept.'],
    ['Правиме игра со сортирање во дворот со чисти материјали што ги донел воспитувачот.', 'Play a sorting game in the yard with clean materials supplied by the teacher.'],
    ['Ѓубрето го ставаме на вистинското место.', 'Put rubbish in the right place.']),
  lesson(['Поправи, сподели, зачувај', 'Repair, share, keep'],
    ['Учиме дека грижата го продолжува животот на предметите.', 'Learn that care makes our belongings last longer.'],
    ['Отвораме мала работилница со играчки. Одлучуваме што да зачуваме, споделиме или да дадеме на возрасен за поправка.', 'Open a pretend toy workshop. Decide what to keep, share or give to an adult to repair.'],
    ['Со заедничките играчки правиме игра во дворот. На крај ги броиме и ги враќаме на нивното место.', 'Play together with shared yard toys. Count them and return each one afterwards.'],
    ['Прво бараме помош за поправка.', 'Ask for help repairing something first.']),
  lesson(['Нашата зелена приказна', 'Our green story'],
    ['Со приказна ги повторуваме навиките научени оваа недела.', 'Use a story to revisit this week’s new habits.'],
    ['Секое дете црта една добра навика. Цртежите ги поврзуваме во заедничка приказна.', 'Each child draws one helpful habit. Combine the drawings into a shared story.'],
    ['Во круг во дворот ја раскажуваме нашата приказна и покажуваме една навика со движење.', 'Tell our story in a circle outside and act out one habit each.'],
    ['Избираме една мала навика и ја повторуваме дома.', 'Choose one small habit to repeat at home.']),
];
const SEASONAL = {
  autumn: lesson(['Есенска потрага по бои', 'An autumn colour hunt'], ['Ги забележуваме промените во природата без да ги оштетуваме растенијата.', 'Notice changes in nature without harming plants.'],
    ['Разгледуваме чисти паднати лисја и ги групираме по боја и форма. Цртаме есенско дрво.', 'Explore clean fallen leaves, group them by colour and shape, and draw an autumn tree.'],
    ['Бараме есенски бои во дворот. Набљудуваме паднати лисја без да кинеме гранки.', 'Look for autumn colours in the yard. Observe fallen leaves without picking branches.'], ['Набљудуваме со грижа, не кинеме живи растенија.', 'Observe gently and leave living plants in place.']),
  winter: lesson(['Каде спие природата?', 'Where does nature rest?'], ['Откриваме како природата се менува во зима.', 'Explore how nature changes in winter.'],
    ['Цртаме зимски дрвја и разговараме како луѓето и животните се затоплуваат.', 'Draw winter trees and talk about how people and animals keep warm.'],
    ['Набљудуваме зимски гранки и траги во дворот. Ако има снег на земјата, споредуваме отпечатоци со воспитувачот.', 'Observe winter branches and tracks. If snow is on the ground, compare footprints with the teacher.'], ['Ја затвораме вратата за да ја зачуваме топлината.', 'Close the door to keep the warmth in.']),
  spring: lesson(['Се буди малата градина', 'Our little garden wakes up'], ['Ги препознаваме првите знаци на пролетта.', 'Recognise the first signs of spring.'],
    ['На користена хартија цртаме што му треба на растението: светлина, вода и грижа.', 'On used paper, draw what a plant needs: light, water and care.'],
    ['Бараме пупки и нови лисја во дворот. Цртаме што сме виделе без да го кинеме.', 'Look for buds and new leaves in the yard. Draw what we saw without picking it.'], ['Растенијата ги негуваме со малку вода и многу внимание.', 'Care for plants with a little water and plenty of attention.']),
  summer: lesson(['Сенка, сонце и вода', 'Shade, sunshine and water'], ['Учиме за летото преку споредување и набљудување.', 'Learn about summer through observation and comparison.'],
    ['Со цртежи правиме летна приказна. Споредуваме слики од сончево и засенчено место.', 'Create a summer story with drawings. Compare pictures of sunny and shaded places.'],
    ['Со воспитувачот набљудуваме како се поместува сенката во дворот. Правиме кратка игра во сенка.', 'Watch how shade moves in the yard with the teacher. Play a short game in the shade.'], ['Носиме свое шише за повеќекратна употреба.', 'Bring a reusable water bottle.']),
};
export const SNOW_LESSON = lesson(['Мали траги во снегот', 'Little tracks in the snow'],
  ['Набљудуваме како водата се менува со температурата.', 'Observe how water changes with temperature.'],
  ['Со цртежи истражуваме снегулки и траги. Воспитувачот покажува како малку снег се топи во затворен сад.', 'Explore snowflakes and tracks through drawings. The teacher shows a little snow melting in a closed container.'],
  ['Ако има снег на земјата, со воспитувачот споредуваме отпечатоци во дворот и цртаме форми. Не собираме и не јадеме снег.', 'If snow is on the ground, compare footprints and draw shapes in the yard with the teacher. We do not collect or eat snow.'],
  ['Ја затвораме вратата и ја чуваме топлината.', 'Close the door and keep the warmth inside.']);
export function holidayLesson(event, settings) {
  const variants = {
    independence: lesson(['8 Септември: ја чуваме нашата Македонија', '8 September: caring for our Macedonia'],
      ['Го запознаваме Денот на независноста и учиме како да се грижиме за местото во кое живееме.', 'Explore Independence Day and learn to care for the place where we live.'],
      ['Воспитувачот го претставува 8 Септември и македонското знаме. Со чистите материјали што веќе ги имаме редиме сонце и наше мало маало. Секое дете предлага една навика за почиста Македонија.', 'The teacher introduces 8 September and the Macedonian flag. Arrange a sun and a small neighbourhood using clean materials already available. Each child suggests one habit for a cleaner Macedonia.'],
      ['Во дворот правиме круг како сонце. Со движења покажуваме грижа за дрвјата, штедење вода и правилно оставање отпад. По играта ги собираме и ги чуваме сите материјали.', 'Make a sun-shaped circle in the yard. Act out caring for trees, saving water and putting waste in the right place. Collect and keep all materials after the game.'],
      ['Ја чуваме чиста нашата улица и повторно ги користиме украсите.', 'Keep our street clean and reuse our decorations.']),
    easter: lesson(['Велигден: украси со втор живот', 'Easter: decorations with a second life'],
      ['Запознаваме празнични обичаи и повторно користиме материјали.', 'Explore holiday traditions and reuse materials.'],
      ['Со воспитувачот редиме форми на јајца и пролетни украси од чистите материјали што веќе ги имаме. Ги зачувуваме за следната игра.', 'With the teacher, arrange egg shapes and spring decorations using the clean materials we already have. Keep them for another game.'],
      ['Во дворот бараме пролетни бои и редиме привремени форми со нашите материјали. На крај собираме сè за повторна употреба.', 'Look for spring colours in the yard and arrange temporary shapes with our materials. Collect everything to use again.'],
      ['Ги чуваме украсите за следниот празник.', 'Keep decorations for the next celebration.']),
    halloween: lesson(['Ноќ на вештерките: повторно употреби', 'Halloween: reuse and imagine'],
      ['Со имагинација правиме празнична игра со помалку отпад.', 'Use imagination for a celebration with less waste.'],
      ['Со воспитувачот составуваме смешни, пријателски ликови од достапните чисти материјали. Секое дете смислува име. Ги расклопуваме и ги чуваме материјалите.', 'With the teacher, arrange funny, friendly characters from available clean materials. Each child invents a name. Take them apart and keep the materials.'],
      ['Во дворот играме пријателска парада со движења и звуци. Секој лик кажува една навика за помалку отпад. Ги враќаме сите материјали внатре.', 'Play a friendly movement and sound parade in the yard. Each character shares one habit for less waste. Bring all materials back inside.'],
      ['Позајмуваме или повторно користиме украси.', 'Borrow or reuse decorations.']),
    books: lesson([event.name.mk, event.name.en],
      ['Учиме за празникот и како да ги чуваме и споделуваме приказните.', 'Learn about the occasion and how to care for and share stories.'],
      ['Воспитувачот раскажува кратка приказна за празникот. Со достапните материјали редиме букви и симболи. Секое дете додава идеја за грижа за книгите.', 'The teacher tells a short story about the occasion. Arrange letters and symbols using available materials. Each child suggests how to care for books.'],
      ['Во круг во дворот раскажуваме за учењето и споделувањето. Со движења прикажуваме букви и на крај ги собираме материјалите.', 'Tell a story about learning and sharing in a circle outside. Make letter shapes with movements and collect the materials afterwards.'],
      ['Споделуваме приказни и внимаваме на книгите.', 'Share stories and look after books.']),
  };
  const environmental = ['earth-day', 'environment-day'].includes(event.id) ? lesson(
    ['Мало маало со помалку отпад', 'A little neighbourhood with less waste'],
    ['За еко-денот откриваме што можеме повторно да употребиме.', 'For this environmental day, discover what we can reuse.'],
    ['Отвораме замислена работилница. Секое дете избира достапен материјал и му наоѓа нова употреба. Ја составуваме приказната на нашето маало.', 'Open a pretend workshop. Each child chooses an available material and finds a new use for it. Put together our neighbourhood story.'],
    ['Во дворот бараме три места за кои можеме да се грижиме. Со движења покажуваме како штедиме вода и ги чуваме предметите. Не собираме отпад од земја.', 'Find three places to care for in the yard. Act out saving water and looking after belongings. We do not collect litter from the ground.'],
    ['Денес зачувуваме еден предмет за повторна употреба.', 'Keep one item to use again today.']) : null;
  const selected = variants[event.id] || variants[event.family] || environmental;
  // A verified date is not a ready-made lesson. Never disguise a generic template as one.
  return selected ? { ...structuredClone(selected), materials: settings.materials.slice(0, 3) } : null;
}
export function seasonFor(date) {
  const month = Number(date.slice(5, 7)); return month >= 3 && month <= 5 ? 'spring' : month >= 6 && month <= 8 ? 'summer' : month >= 9 && month <= 11 ? 'autumn' : 'winter';
}

const normalized = value => typeof value === 'string' ? value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim() : '';
export function mentionsOccasion(pair, event) {
  return ['mk', 'en'].every(lang => normalized(event?.name?.[lang]) && normalized(pair?.[lang]).includes(normalized(event.name[lang])));
}
// Verify visible coverage in both alternatives, not the educational quality of the lesson.
export function lessonCoversOccasion(theme, event) {
  return mentionsOccasion(theme?.inside, event) && mentionsOccasion(theme?.outside, event);
}
export function localCurriculum(dates, settings, calendars = [], variant = 0) {
  const themes = structuredClone(ECO.map((_, i) => ECO[(i + variant) % ECO.length]));
  themes[0] = structuredClone(SEASONAL[seasonFor(dates[0])]);
  const occasions = occasionsForWeek(dates, calendars);
  for (let i = 0; i < dates.length; i++) {
    const event = occasions[i].find(event => event.kind !== 'community' && holidayLesson(event, settings));
    if (event) themes[i] = holidayLesson(event, settings);
  }
  return themes.map((theme, i) => ({ ...theme, dayActivities: defaultDayActivities((i + variant) % 5), materials: settings.materials.slice(0, 3) }));
}
export function validateCurriculum(value, settings, { count = 5 } = {}) {
  if (!Array.isArray(value) || value.length !== count) throw invalid('invalid_curriculum');
  return value.map(t => {
    if (!t || typeof t !== 'object' || Array.isArray(t)) throw invalid('invalid_curriculum');
    const result = {};
    for (const [key, length] of [['title', 100], ['goal', 220], ['inside', 400], ['outside', 400], ['habit', 180]]) {
      result[key] = textPair(t[key], length);
      if (Object.values(result[key]).some(v => /ignore.{0,20}instructions|system prompt|air is clean|safe to (?:go|play)|безбедно.{0,15}надвор|воздухот е чист|\bAQI\b|PM2[.,]5|\bhttps?:/iu.test(v))) throw invalid('invalid_curriculum');
    }
    if (!Array.isArray(t.materials) || !t.materials.length || t.materials.length > 6 || t.materials.some(id => !settings.materials.includes(id) || !MATERIALS.some(m => m.id === id))) throw invalid('invalid_materials');
    if (t.dayActivities !== undefined) {
      if (!t.dayActivities || typeof t.dayActivities !== 'object') throw invalid('invalid_curriculum');
      result.dayActivities = {};
      for (const role of ['circle', 'creative', 'movement', 'reflection']) {
        const value = textPair(t.dayActivities[role], 100);
        if (Object.values(value).some(v => /ignore.{0,20}instructions|system prompt|air is clean|safe to (?:go|play)|безбедно.{0,15}надвор|воздухот е чист|\bAQI\b|PM2[.,]5|\bhttps?:/iu.test(v))) throw invalid('invalid_curriculum');
        result.dayActivities[role] = value;
      }
    }
    result.materials = [...new Set(t.materials)]; return result;
  });
}
