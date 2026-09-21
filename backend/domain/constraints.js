import { DEFAULT_COMFORT } from '../config/index.js';

export const DEFAULT_TEXT =
  'Појадуваме од 10:00 до 10:30. Спиеме од 12:00 до 14:00. Сакаме 30 минути игра надвор, без делење на групата.';
export const DEFAULT_SCHEDULE = Object.freeze({
  dayStart: '08:00',
  dayEnd: '16:00',
  duration: 30,
  split: false,
  blocks: [
    { label: 'Појадок', start: '10:00', end: '10:30' },
    { label: 'Пладневен одмор', start: '12:00', end: '14:00' }
  ],
  preferences: DEFAULT_COMFORT
});
export const MATERIAL_CATALOG = Object.freeze([
  'Чист картон',
  'Хартија искористена од една страна',
  'Стари весници и списанија',
  'Парчиња ткаенина',
  'Чисти садови за повеќекратна употреба',
  'Кутии и хартиени ролни',
  'Природни материјали од дворот',
  'Играчки и книги за поправка'
]);
export const AGE_GROUPS = Object.freeze(['3–4 години', '4–5 години', '5–6 години', 'Мешана група 3–6']);
export const DEFAULT_WEEKLY_SCHEDULE = Object.freeze({
  dayStart: '08:00',
  dayEnd: '16:00',
  duration: 45,
  split: false,
  blocks: [
    { label: 'Појадок', start: '09:00', end: '09:30' },
    { label: 'Ручек', start: '11:30', end: '12:00' },
    { label: 'Пладневен одмор', start: '12:00', end: '14:00' }
  ],
  preferences: DEFAULT_COMFORT,
  ageGroup: '4–5 години',
  materials: [
    'Чист картон',
    'Хартија искористена од една страна',
    'Парчиња ткаенина',
    'Чисти садови за повеќекратна употреба'
  ],
  themes: [
    {
      title: 'Втора шанса за картон',
      goal: 'Препознаваме дека употребен предмет може повторно да послужи.',
      outdoor: 'Градиме патека од картонски форми во дворот',
      indoor: 'Градиме мала населба од картонски форми',
      materials: ['Чист картон'],
      habit: 'Пред да фрлиме нешто, прашуваме: може ли повторно да послужи?'
    },
    {
      title: 'Хартијата има две страни',
      goal: 'Вежбаме да ја искористиме хартијата пред да земеме нова.',
      outdoor: 'Цртаме мапа на дворот на задната страна од хартијата',
      indoor: 'Правиме двострана сликовница од веќе користена хартија',
      materials: ['Хартија искористена од една страна'],
      habit: 'Цртаме и на чистата страна од веќе користен лист.'
    },
    {
      title: 'Секоја капка е важна',
      goal: 'Забележуваме дека за задачата ни треба само одредена количина вода.',
      outdoor: 'Полевање со една измерена чашка по растение',
      indoor: 'Споредуваме колку вода собираат садовите без да ја истураме',
      materials: ['Чисти садови за повеќекратна употреба'],
      habit: 'Ја затвораме чешмата додека ги сапуниме рацете.'
    },
    {
      title: 'Мала работилница за поправка',
      goal: 'Учиме дека грижата и поправката го продолжуваат животот на предметите.',
      outdoor: 'Правиме изложба на поправени картонски знаци',
      indoor: 'Поправаме картонска играчка со парчиња ткаенина',
      materials: ['Чист картон', 'Парчиња ткаенина'],
      habit: 'Прво се обидуваме да поправиме, па дури потоа заменуваме.'
    },
    {
      title: 'Подарок без нов отпад',
      goal: 'Создаваме нешто лично од материјали што веќе ги имаме.',
      outdoor: 'Правиме знамиња за дворот од картон и ткаенина',
      indoor: 'Изработуваме картичка од картон и остатоци од ткаенина',
      materials: ['Чист картон', 'Парчиња ткаенина'],
      habit: 'За подарок прво избираме нешто што веќе го имаме.'
    }
  ]
});
export function minutes(value) {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [h, m] = value.split(':').map(Number);
  return h <= 23 && m <= 59 ? h * 60 + m : null;
}
export function timeLabel(value) {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}
export function validatePreferences(value = DEFAULT_COMFORT) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Object.assign(new Error('Недостасуваат условите за игра надвор.'), { status: 400 });
  const result = {
    minApparentC: Number(value.minApparentC),
    maxApparentC: Number(value.maxApparentC),
    maxPrecipProbability: Number(value.maxPrecipProbability),
    maxPrecipitationMm: Number(value.maxPrecipitationMm),
    maxWindKmh: Number(value.maxWindKmh)
  };
  if (
    !Object.values(result).every(Number.isFinite) ||
    result.minApparentC < -15 ||
    result.minApparentC > 20 ||
    result.maxApparentC < 15 ||
    result.maxApparentC > 45 ||
    result.minApparentC >= result.maxApparentC ||
    result.maxPrecipProbability < 0 ||
    result.maxPrecipProbability > 100 ||
    result.maxPrecipitationMm < 0 ||
    result.maxPrecipitationMm > 20 ||
    result.maxWindKmh < 5 ||
    result.maxWindKmh > 80
  ) {
    throw Object.assign(new Error('Проверете ги границите за температура, дожд и ветер.'), { status: 400 });
  }
  return result;
}
export function validateSchedule(input) {
  if (!input || typeof input !== 'object') throw Object.assign(new Error('Недостасува распоред.'), { status: 400 });
  const start = minutes(input.dayStart);
  const end = minutes(input.dayEnd);
  if (start === null || end === null || start < 360 || end > 1200 || end <= start)
    throw Object.assign(new Error('Денот мора да биде меѓу 06:00 и 20:00, со крај по почетокот.'), { status: 400 });
  if (!Number.isInteger(input.duration) || input.duration < 10 || input.duration > 90 || input.duration > end - start)
    throw Object.assign(new Error('Изберете 10–90 минути игра во рамките на денот.'), { status: 400 });
  if (!Array.isArray(input.blocks) || input.blocks.length > 8)
    throw Object.assign(new Error('Дозволени се најмногу 8 зафатени периоди.'), { status: 400 });
  const blocks = input.blocks.map((b) => {
    if (!b || typeof b !== 'object') throw Object.assign(new Error('Неисправен зафатен период.'), { status: 400 });
    const s = minutes(b.start);
    const e = minutes(b.end);
    if (
      s === null ||
      e === null ||
      s < start ||
      e > end ||
      e <= s ||
      typeof b.label !== 'string' ||
      b.label.length > 60
    )
      throw Object.assign(new Error('Проверете ги имињата и времињата на зафатените периоди.'), { status: 400 });
    return { label: b.label.trim() || 'Зафатено', start: b.start, end: b.end };
  });
  return {
    dayStart: input.dayStart,
    dayEnd: input.dayEnd,
    duration: input.duration,
    split: false,
    blocks,
    preferences: validatePreferences(input.preferences)
  };
}
export function validateWeeklySchedule(input) {
  const schedule = validateSchedule(input);
  const materials = validateMaterials(input.materials);
  const ageGroup = validateAgeGroup(input.ageGroup);
  return { ...schedule, ageGroup, materials, themes: validateThemes(input.themes, materials) };
}
const INSTRUCTION_PATTERNS = [
  /ignore\s+(?:all\s+)?instructions|system\s+prompt|developer\s+message/iu,
  /претходн(?:ите|и)\s+инструкции|игнорирај\s+(?:ги\s+)?инструкци/iu
];
const CLAIM_PATTERN = /[<>\r\n]|воздух|загад|безбед|ризик|AQI|PM2/iu;
export function validateAgeGroup(value) {
  if (!AGE_GROUPS.includes(value))
    throw Object.assign(new Error('Изберете една од понудените возрасни групи.'), { status: 400 });
  return value;
}
export function validateMaterials(input, { max = 12 } = {}) {
  if (!Array.isArray(input) || input.length < 1 || input.length > max)
    throw Object.assign(new Error(`Изберете од 1 до ${max} материјали што веќе ги имате.`), { status: 400 });
  const clean = input.map((value) => (typeof value === 'string' ? value.trim() : ''));
  if (
    clean.some(
      (value) =>
        !value ||
        value.length > 60 ||
        value.includes(',') ||
        CLAIM_PATTERN.test(value) ||
        INSTRUCTION_PATTERNS.some((pattern) => pattern.test(value))
    )
  ) {
    throw Object.assign(new Error('Материјалите мора да бидат кратки имиња, без инструкции или тврдења за условите.'), {
      status: 400
    });
  }
  return [...new Set(clean)];
}
export function validateThemes(input, availableMaterials = null) {
  if (!Array.isArray(input) || input.length !== 5)
    throw Object.assign(new Error('Додајте план за секој од петте работни дена.'), { status: 400 });
  return input.map((theme) => {
    if (!theme || typeof theme !== 'object')
      throw Object.assign(new Error('Проверете ги дневните активности.'), { status: 400 });
    const limits = { title: 80, goal: 180, outdoor: 180, indoor: 180, habit: 140 };
    const clean = Object.fromEntries(
      Object.keys(limits).map((key) => [key, typeof theme[key] === 'string' ? theme[key].trim() : ''])
    );
    if (
      Object.entries(clean).some(
        ([key, value]) =>
          !value ||
          value.length > limits[key] ||
          CLAIM_PATTERN.test(value) ||
          INSTRUCTION_PATTERNS.some((pattern) => pattern.test(value))
      )
    ) {
      throw Object.assign(
        new Error(
          'Секоја еко-активност мора да има кратка цел, две варијанти и навика, без тврдења за воздух или безбедност.'
        ),
        { status: 400 }
      );
    }
    const materials = validateMaterials(theme.materials, { max: 4 });
    if (availableMaterials && materials.some((material) => !availableMaterials.includes(material))) {
      throw Object.assign(new Error('Материјалите по ден мора да бидат избрани од листата „веќе ги имаме“.'), {
        status: 400
      });
    }
    return { ...clean, materials };
  });
}
export function localExtract(text) {
  const schedule = structuredClone(DEFAULT_SCHEDULE);
  const duration = text.match(/\b(\d{1,2})\s*(?:минути|минута|min)/iu);
  if (duration) schedule.duration = Math.max(10, Math.min(90, Number(duration[1])));
  const blocks = [];
  for (const sentence of text.split(/[.!?\n]/u)) {
    const range = sentence.match(/(?:од\s*)?(\d{1,2})(?::(\d{2}))?\s*(?:до|[-–])\s*(\d{1,2})(?::(\d{2}))?/iu);
    let label;
    if (/појад|јад|руч|оброк/iu.test(sentence)) {
      label = 'Оброк';
    } else if (/спие|спием|спиј|одмор|дрем/iu.test(sentence)) {
        label = 'Одмор';
      } else {
        label = null;
      }
    if (range && label)
      blocks.push({
        label,
        start: `${range[1].padStart(2, '0')}:${range[2] ?? '00'}`,
        end: `${range[3].padStart(2, '0')}:${range[4] ?? '00'}`
      });
  }
  if (blocks.length) schedule.blocks = blocks;
  try {
    return validateSchedule(schedule);
  } catch {
    return structuredClone(DEFAULT_SCHEDULE);
  }
}
export const CONSTRAINT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    dayStart: { type: 'string' },
    dayEnd: { type: 'string' },
    duration: { type: 'integer' },
    split: { type: 'boolean' },
    blocks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { label: { type: 'string' }, start: { type: 'string' }, end: { type: 'string' } },
        required: ['label', 'start', 'end']
      }
    }
  },
  required: ['dayStart', 'dayEnd', 'duration', 'split', 'blocks']
};
