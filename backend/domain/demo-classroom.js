import { pair, cleanText, invalid } from './settings.js';
import { skopjeParts } from '../config/index.js';

// Entirely fictional, in-memory classroom. Never attached to a real account or sent to AI.
const NAMES = [
  ['Мила Петровска','Mila Petrovska'], ['Лука Петровски','Luka Petrovski'],
  ['Софија Николовска','Sofija Nikolovska'], ['Матеј Јовановски','Matej Jovanovski'],
  ['Ема Трајковска','Ema Trajkovska'], ['Давид Стојановски','David Stojanovski'],
  ['Ива Митревска','Iva Mitrevska'], ['Ноа Костовски','Noa Kostovski'],
  ['Леа Ристевска','Lea Ristevska'], ['Алекс Марковски','Aleks Markovski'],
  ['Јана Димовска','Jana Dimovska'], ['Виктор Савевски','Viktor Savevski'],
  ['Ана Илиевска','Ana Ilievska'], ['Огнен Тодоровски','Ognen Todorovski'],
  ['Ела Здравковска','Ela Zdravkovska'], ['Адем Реџепи','Adem Redzepi'],
  ['Лина Селими','Lina Selimi'], ['Ардијан Алиу','Ardijan Aliu'],
  ['Сара Османи','Sara Osmani'], ['Леон Велковски','Leon Velkovski'],
  ['Нина Ангеловска','Nina Angelovska'], ['Филип Милевски','Filip Milevski'],
  ['Миа Ѓоргиевска','Mia Gjorgievska'], ['Андреј Пановски','Andrej Panovski'],
  ['Ина Спасовска','Ina Spasovska'], ['Максим Младеновски','Maksim Mladenovski'],
  ['Теа Поповска','Tea Popovska'], ['Бојан Даневски','Bojan Danevski'],
  ['Ајла Исмаили','Ajla Ismaili'], ['Стефан Крстевски','Stefan Krstevski'],
];
const INTERESTS = [pair('Музика и танц','Music and dance'), pair('Градење и природа','Building and nature'), pair('Приказни и цртање','Stories and drawing'), pair('Сложувалки и движење','Puzzles and movement'), pair('Бои и игра со улоги','Colours and pretend play')];
const GOALS = [pair('Да сподели идеја во мала група.','Share an idea in a small group.'), pair('Да создаде нешто заедно со другар.','Make something together with a friend.'), pair('Да спореди форми и да објасни што забележува.','Compare shapes and explain what they notice.')];
const DISCOVERIES = [
  pair('Мила направи цвет од хартиени парчиња и измисли краток ритам за другарчињата.', 'Mila made a flower from paper scraps and invented a little rhythm for her friends.'),
  pair('Лука и Матеј изградија картонски мост. Лука предложи поширока основа кога мостот се навали.', 'Luka and Matej built a cardboard bridge. Luka suggested a wider base when it began to lean.'),
  pair('Нацрта градина и раскажа како ќе се грижи за цветовите. Другарчињата додадоа свои идеи.', 'Drew a garden and explained how to care for its flowers. Friends added their own ideas.'),
  pair('Испроба три начини да ги нареди картонските форми и побара другар да помогне.', 'Tried three ways to arrange cardboard shapes and invited a friend to help.'),
  pair('Организираше мала продавница за повторно употребени материјали и ги делеше улогите со другарчињата.', 'Organised a pretend shop for reusable materials and shared the roles with friends.'),
];
export const BAG_ITEMS = [
  { id: 'bottle', label: pair('Шише за повеќекратна употреба','Reusable water bottle') },
  { id: 'layers', label: pair('Лесна јакна и резервна облека','Light jacket and spare clothes') },
  { id: 'paper', label: pair('Еден чист картон, ако имате дома','One clean piece of cardboard, if available at home') },
];
const timeAt = minutes => `${String(Math.floor(minutes / 60)).padStart(2,'0')}:${String(minutes % 60).padStart(2,'0')}`;
const shortTime = clock => { const p = skopjeParts(new Date(clock)); return timeAt(p.minutes); };
export function ageMonths(birthday, date) {
  const b = birthday.split('-').map(Number); const d = date.split('-').map(Number);
  return (d[0] - b[0]) * 12 + d[1] - b[1] - (d[2] < b[2] ? 1 : 0);
}
export function createDemoClassroom(week) {
  const afternoon = skopjeParts(new Date(week.clock)).minutes >= 14 * 60;
  return {
    revision: 1,
    teacher: { name: pair('Елена Стојановска','Elena Stojanovska'), role: pair('Воспитувачка','Lead teacher'), experienceYears: 8, initials: 'ES', hours: '07:30–15:30' },
    assistant: { name: pair('Марко Илиевски','Marko Ilievski'), role: pair('Неговател','Classroom assistant') },
    room: pair('Занимална 2 · Приземје','Room 2 · Ground floor'), group: pair('Сончогледи','Sunflowers'), kindergarten: pair('Сончева градина','Sun Garden'),
    family: { name: pair('Ана Петровска','Ana Petrovska'), label: pair('Семејство Петровски','Petrovski family'), initials: 'AP', childIds: ['child-01','child-02'], pickup: pair('Ана или Петар Петровски','Ana or Petar Petrovski') },
    children: NAMES.map(([mk,en], i) => {
      const status = afternoon ? i === 27 || i === 28 ? 'absent' : 'present' : i === 1 || i === 26 ? 'expected' : i === 27 || i === 28 ? 'absent' : 'present';
      return { id: `child-${String(i+1).padStart(2,'0')}`, name: pair(mk,en), initials: en.split(' ').map(x=>x[0]).join(''), color: i % 5,
        birthday: i < 2 ? '2021-05-14' : `2021-${String(i % 12 + 1).padStart(2,'0')}-${String(i % 23 + 2).padStart(2,'0')}`,
        interests: INTERESTS[i % INTERESTS.length], goal: GOALS[i % GOALS.length],
        guardian: i < 2 ? pair('Ана Петровска','Ana Petrovska') : pair(`Семејството на ${mk.split(' ')[0]}`, `${en.split(' ')[0]}’s family`),
        pickupAt: i < 2 ? '15:30' : ['15:00','15:15','15:30','16:00'][i % 4],
        care: i === 0 ? pair('Семејна желба: вегетаријански оброци.','Family preference: vegetarian meals.') : i === 1 ? pair('Помага мирно добредојде и избор на другар за игра.','A calm welcome and a choice of play partner help.') : pair('Нема дополнителни семејни насоки во примерот.','No additional family instructions in this example.'),
        attendance: status, arrival: status === 'present' ? i === 1 ? '08:55' : timeAt(462 + i * 2) : null, departure: null, absence: null,
        log: { breakfast: status === 'present' ? i % 4 === 0 ? 'some' : 'all' : 'pending', lunch: afternoon && status === 'present' ? 'all' : 'pending', rest: afternoon && status === 'present' ? i % 3 === 0 ? 'quiet' : 'slept' : 'pending',
          note: afternoon && status === 'present' ? DISCOVERIES[i < 2 ? i : 2 + i % 3] : pair('Ќе додадеме мало откритие по активноста.','We’ll add a little discovery after the activity.') },
      };
    }),
    messages: [
      { id:'welcome', sender:'teacher', time:'07:30', content:pair('Добро утро, Ана! Оваа недела создаваме со материјали што веќе ги имаме. Мила и Лука нека донесат шишиња со вода.','Good morning, Ana! This week we’re creating with materials we already have. Please pack Mila and Luka’s water bottles.') },
      { id:'arrival', sender:'parent', time:'08:10', content:pair('Ви благодарам! Мила пристигна, а Лука ќе дојде со Петар малку подоцна.','Thank you! Mila has arrived; Luka will come with Petar a little later.') },
      { id:'reply', sender:'teacher', time:'08:15', content:pair('Секако, ќе го пречекаме со мирна игра за градење.','Of course. We’ll welcome him with a quiet building game.') },
      ...(afternoon ? [{ id:'settled', sender:'teacher', time:'09:00', content:pair('Лука пристигна во 08:55 и сега појадува. Мила го чека со материјалите за градење.','Luka arrived at 08:55 and is finishing breakfast. Mila is waiting with the building materials.') }, { id:'afternoon', sender:'teacher', time:'14:10', content:pair('По одморот сме подготвени за ново откритие. Во картичките на Мила и Лука ги додадов денешните мали успеси.','After rest, we’re ready for another discovery. I’ve added today’s little achievements to Mila and Luka’s cards.') }] : []),
    ],
    bag: { bottle:true, layers:false, paper:false }, acknowledgedKey:null,
  };
}
export function attendanceCounts(classroom) {
  return Object.fromEntries(['present','expected','absent','collected'].map(status => [status,classroom.children.filter(c=>c.attendance===status).length]));
}
export function classroomView(classroom, week) {
  const minutes = skopjeParts(new Date(week.clock)).minutes;
  return { ...structuredClone(classroom), children: classroom.children.map(c => ({...structuredClone(c), ageMonths: ageMonths(c.birthday, week.today)})), counts: attendanceCounts(classroom),
    logAvailability: { breakfast: minutes >= 510, lunch: minutes >= 690, rest: minutes >= 840 } };
}
export const demoNoticeKey = week => { const day=week.days.find(d=>d.date===week.today); return `${week.today}:${day?.mode}:${day?.reason}`; };
export function familyView(classroom, week) {
  const view = classroomView(classroom, week);
  return { revision:view.revision, teacher:view.teacher, assistant:view.assistant, room:view.room, group:view.group, kindergarten:view.kindergarten,
    family:view.family, children:view.children.filter(child=>view.family.childIds.includes(child.id)), messages:view.messages,
    bag:BAG_ITEMS.map(item=>({...item, packed:!!view.bag[item.id]})), noticeKey:demoNoticeKey(week), acknowledged:view.acknowledgedKey===demoNoticeKey(week),
    totalChildren:30,
  };
}
export function editDemoClassroom(current, input, {role, week}) {
  if (input.classroomRevision !== current.revision) throw invalid('demo_changed',409);
  const next=structuredClone(current); const child=next.children.find(c=>c.id===input.childId);
  if (role === 'parent' && input.childId && !next.family.childIds.includes(input.childId)) throw invalid('not_found',404);
  const allowed = role === 'teacher' ? ['attendance','check-in-expected','daily-log','message'] : ['absence','bag','acknowledge','message'];
  if (!allowed.includes(input.action)) throw invalid('invalid_demo_action');
  if (input.action === 'attendance') {
    if (!child || !['present','expected','absent','collected'].includes(input.value)) throw invalid('invalid_demo_action');
    if (input.value==='collected' && child.attendance!=='present') throw invalid('invalid_demo_action');
    child.attendance=input.value;
    child.arrival=input.value==='present' ? child.arrival || shortTime(week.clock) : input.value==='collected' ? child.arrival : null;
    child.departure=input.value==='collected' ? shortTime(week.clock) : null;
    if (input.value==='present') child.absence=null;
  } else if (input.action==='check-in-expected') {
    for (const row of next.children.filter(c=>c.attendance==='expected')) { row.attendance='present'; row.arrival=shortTime(week.clock); row.absence=null; }
  } else if (input.action==='daily-log') {
    if (!child || !['present','collected'].includes(child.attendance)) throw invalid('invalid_demo_action');
    const values={breakfast:['pending','all','some','declined'],lunch:['pending','all','some','declined'],rest:['pending','slept','quiet']};
    if (input.field !== 'note' && !classroomView(current, week).logAvailability[input.field]) throw invalid('demo_log_not_started');
    if (input.field==='note') child.log.note=cleanText(input.value,500);
    else if (values[input.field]?.includes(input.value)) child.log[input.field]=input.value;
    else throw invalid('invalid_demo_action');
  } else if (input.action==='absence') {
    if (!child || !['expected','absent'].includes(child.attendance) || !['appointment','family-day','cancel'].includes(input.value)) throw invalid('invalid_demo_action');
    child.absence=input.value==='cancel' ? null : {date:week.today,reason:input.value};
    child.attendance=input.value==='cancel' ? 'expected' : 'absent';
  } else if (input.action==='bag') {
    if (!BAG_ITEMS.some(i=>i.id===input.itemId) || typeof input.packed!=='boolean') throw invalid('invalid_demo_action');
    next.bag[input.itemId]=input.packed;
  } else if (input.action==='acknowledge') {
    if (input.noticeKey!==demoNoticeKey(week)) throw invalid('demo_changed',409);
    next.acknowledgedKey=input.noticeKey;
  } else if (input.action==='message') {
    if (next.messages.length>=100) throw invalid('rate_limited',429);
    next.messages.push({id:`message-${next.revision}`,sender:role,time:shortTime(week.clock),content:cleanText(input.content,1000)});
  }
  next.revision++; return next;
}
