import { pair, minutes } from './settings.js';
import { titleKey } from './session-plan.js';

// Learning choices only. Outdoor permissions are owned by week.js, never this library.
const labels = values => values.map(value => pair(...value));
const BANK = {
  welcome: labels([['Избери катче за игра', 'Choose a play corner'], ['Градиме заедно', 'Build together'], ['Малата продавница за размена', 'Our little swap shop'], ['Сложувалки со другарче', 'Puzzles with a friend'], ['Нашите омилени игри', 'Our favourite games']]),
  circle: labels([['Приказна за едно зачувано дрво', 'The story of a tree we saved'], ['Каде патува капката?', 'Where does a water drop travel?'], ['Што има во нашата кошница?', 'What is in our basket?'], ['Играчката што доби втора шанса', 'The toy that got a second chance'], ['Покажи ни едно мало откритие', 'Show us a little discovery']]),
  creative: labels([['Нашето маало од повторно употребени материјали', 'Our neighbourhood from reused materials'], ['Редиме големи и мали форми', 'Arrange big and small shapes'], ['Музеј на предмети со втор живот', 'A museum of objects with a second life'], ['Заедничка слика без нови купувања', 'A shared picture with no new purchases'], ['Ја составуваме приказната на неделата', 'Put together the story of our week']]),
  movement: labels([['Движи се како дрво, птица и облак', 'Move like a tree, bird and cloud'], ['Патот на капката со движења', 'Act out a water drop’s journey'], ['Сортирај со движење', 'A movement sorting game'], ['Огледало со другарче', 'Mirror a friend’s movements'], ['Танц на малите чувари', 'Little keepers’ dance']]),
  calm: labels([['Тивка приказна за шумата', 'A quiet forest story'], ['Слушаме звуци и се смируваме', 'Listen to sounds and settle down'], ['Книга со другарче', 'Share a book with a friend'], ['Тивка игра со форми', 'Quiet shape play'], ['Приказната што ја избра групата', 'The story our group chose']]),
  together: labels([['Отвораме работилница за поправки', 'Open a pretend repair workshop'], ['Играме продавница со чаши за повторна употреба', 'Play a pretend reuse shop'], ['Измислуваме игра со она што го имаме', 'Invent a game with what we have'], ['Подготвуваме мала изложба', 'Prepare a little exhibition'], ['Ги споделуваме омилените игри', 'Share our favourite games']]),
  reflection: labels([['Едно нешто што ќе го зачувам', 'One thing I will keep'], ['Мојата мала навика за вода', 'My little water-saving habit'], ['Покажи што научи со движење', 'Act out something you learned'], ['На кого му помогнав денес?', 'Who did I help today?'], ['Нашите пет мали победи', 'Our five little wins']]),
  departure: labels([['Средуваме и ги пречекуваме родителите', 'Tidy up and welcome our parents']]),
};
const WEATHER = {
  rain: labels([['Оркестар на дождот', 'A rain orchestra'], ['Патот на капката', 'Follow a raindrop'], ['Редиме дождовни облаци', 'Arrange rain clouds'], ['Приказна за жедната градина', 'The thirsty garden story'], ['Кој ја чува водата?', 'Who looks after our water?']]),
  snow: labels([['Зимски траги од форми', 'Winter tracks made from shapes'], ['Снегулки со движење', 'Move like snowflakes'], ['Големи и мали зимски отпечатоци', 'Big and small winter footprints'], ['Градиме замислено снежно маало', 'Build a pretend snowy neighbourhood'], ['Зимска приказна во пет слики', 'A winter story in five pictures']]),
  wind: labels([['Дрвја што се нишаат', 'Sway like trees'], ['Што може да помести ветерот?', 'What can the wind move?'], ['Тивко и силно: игра со звуци', 'Soft and loud: a sound game'], ['Ја раскажуваме приказната на ветерот', 'Tell the wind’s story'], ['Мирни и раздвижени облаци', 'Still clouds and moving clouds']]),
  hot: labels([['Градиме сенка за нашето мало маало', 'Build shade for our little neighbourhood'], ['Игра со светлина и сенка', 'Light and shadow play'], ['Кому му треба вода?', 'Who needs water?'], ['Замислена градина под сенка', 'An imaginary shaded garden'], ['Летна приказна со мирни движења', 'A summer story with gentle movements']]),
  cold: labels([['Го облекуваме зимското мече', 'Dress our winter bear'], ['Како ја чуваме топлината?', 'How do we keep the warmth in?'], ['Домови за замислени животни', 'Homes for imaginary animals'], ['Патот на топлата јакна', 'The warm coat’s journey'], ['Зимско огледало со движења', 'A winter movement mirror']]),
};

const DESCRIPTIONS = {
  welcome: pair('Децата избираат катче, ја развиваат играта со другарчињата и заедно ги враќаат материјалите на место.', 'Children choose a play corner, develop their play with friends and put the materials away together.'),
  circle: pair('Во круг, воспитувачот ја отвора темата со приказна или прашање. Децата споделуваат идеи и го слушаат другарчето.', 'In a circle, the teacher introduces the topic with a story or question. Children share ideas and listen to one another.'),
  creative: pair('Со достапните материјали децата ја истражуваат темата преку правење, редење или сортирање. Ги споредуваат идеите и ги зачувуваат материјалите за повторна употреба.', 'Using the available materials, children explore the topic by making, arranging or sorting. They compare ideas and keep the materials for reuse.'),
  movement: pair('Воспитувачот ја води играта во училницата. Децата ја прикажуваат темата со движења и звуци, се менуваат во водењето и завршуваат со смирување.', 'The teacher leads the classroom game. Children explore the topic through movements and sounds, take turns leading and finish by settling down.'),
  calm: pair('Децата избираат тивка приказна или мирна игра. Со воспитувачот разговараат за забележаното и се подготвуваат за одмор.', 'Children choose a quiet story or calm game. They discuss what they noticed with the teacher and prepare to rest.'),
  together: pair('Во мали групи, децата договараат улоги и заедно ја развиваат играта. Ги споделуваат материјалите и на крај го средуваат просторот.', 'In small groups, children agree on roles and develop the game together. They share materials and tidy the space at the end.'),
  reflection: pair('Секое дете може да покаже или раскаже едно откритие од денот. Групата избира мала навика што може да ја повтори дома.', 'Each child can show or describe one discovery from the day. The group chooses a small habit to repeat at home.'),
  departure: pair('Децата ги средуваат катчињата и ги подготвуваат своите работи. До доаѓањето на родителите избираат мирна игра со воспитувачот.', 'Children tidy their play corners and gather their belongings. They choose a calm activity with the teacher while waiting for their parents.'),
};

export function weatherContext(summary) {
  if (!summary || summary.kind === 'unknown' || !Number.isFinite(summary.max)) return 'unknown';
  if (summary.kind === 'snow') return 'snow';
  if (summary.kind === 'storm' || summary.kind === 'rain' || summary.rain >= 55) return 'rain';
  if (summary.wind >= 22) return 'wind';
  if (summary.max >= 28) return 'hot';
  if (summary.max < 13) return 'cold';
  return 'mild';
}

export function activityRole(start) {
  const n = minutes(start);
  return n < 510 ? 'welcome' : n < 570 ? 'circle' : n < 615 ? 'movement' : n < 720 ? 'creative' : n < 840 ? 'calm' : n < 900 ? 'together' : n < 945 ? 'reflection' : 'departure';
}

export function defaultDayActivities(index) {
  return Object.fromEntries(['circle', 'creative', 'movement', 'reflection'].map(role => [role, BANK[role][index % 5]]));
}

export function activityText(role, index, summary, theme) {
  const context = weatherContext(summary);
  // This is an indoor weather-learning block. It never creates another outdoor slot.
  const weatherLabel = ['movement', 'creative'].includes(role) && WEATHER[context]?.[index % 5];
  const label = weatherLabel || theme.dayActivities?.[role] || BANK[role]?.[index % BANK[role].length] || BANK.creative[index % 5];
  const note = DESCRIPTIONS[role];
  return { label: structuredClone(label), ...(note ? { note: structuredClone(note) } : {}) };
}

export function adaptActivities(day, index, today, clockMinutes) {
  day.learningWeather = weatherContext(day.summary);
  day.timeline = day.timeline.map(row => {
    if (!row.activityRole || row.customized || row.plannedSession || day.date < today || day.date === today && minutes(row.start) < clockMinutes) return row;
    const { note: _oldNote, ...rest } = row;
    return { ...rest, ...activityText(row.activityRole, index, day.summary, day.theme) };
  });
}

// Older and library plans have no per-slot AI content. Give repeated generated
// blocks a different complete activity rather than numbering the same title.
export function diversifyActivities(day, index, today, clockMinutes) {
  const seen = { mk: new Set(), en: new Set() };
  const remember = row => { for (const lang of ['mk', 'en']) seen[lang].add(titleKey(row.label[lang])); };
  const canChange = row => row.kind === 'activity' && !row.customized && !row.plannedSession && !row.occasionIds?.length &&
    day.date >= today && (day.date !== today || minutes(row.start) >= clockMinutes);
  day.timeline.filter(row => !canChange(row)).forEach(remember);
  for (const row of day.timeline.filter(canChange)) {
    if (['mk', 'en'].some(lang => seen[lang].has(titleKey(row.label[lang])))) {
      const choices = [...(BANK[row.activityRole] || []), ...Object.values(BANK).flat()];
      const selected = Array.from({ length: choices.length }, (_, i) => choices[(i + index) % choices.length])
        .find(label => ['mk', 'en'].every(lang => !seen[lang].has(titleKey(label[lang]))));
      if (selected) { row.label = structuredClone(selected); row.note = structuredClone(DESCRIPTIONS[row.activityRole] || DESCRIPTIONS.creative); }
    }
    remember(row);
  }
}
