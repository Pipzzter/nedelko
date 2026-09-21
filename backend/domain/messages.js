const dayNames = { mk: ['понеделник', 'вторник', 'среда', 'четврток', 'петок'], en: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] };
export const shortDate = date => `${Number(date.slice(8))}.${Number(date.slice(5, 7))}`;
function clothes(summary) {
  if (!summary || summary.min === null || summary.max === null) return ['unknown'];
  const items = [summary.max < 13 ? 'cold' : summary.max >= 28 ? 'hot' : 'layers'];
  if (summary.kind === 'snow') items.push('snow');
  else if (summary.rain >= 55) items.push('rain');
  if (summary.wind >= 22) items.push('wind');
  return items;
}
const wardrobe = {
  mk: { cold: 'топла јакна и облека во слоеви', hot: 'лесна облека, капа и шише вода', layers: 'облека во слоеви и лесна јакна', rain: 'кабаница и обувки за дожд', snow: 'топли ракавици и водоотпорни чизми', wind: 'јакна што штити од ветер', unknown: 'проверете ја прогнозата пред поаѓање' },
  en: { cold: 'a warm coat and layers', hot: 'light clothing, a sunhat and a water bottle', layers: 'layers and a light jacket', rain: 'a raincoat and waterproof shoes', snow: 'warm gloves and waterproof boots', wind: 'a windproof jacket', unknown: 'check the forecast before leaving home' },
};
function clothingWeek(days, lang) {
  const usable = days.filter(d => d.theme && !d.closed && d.date >= days[0].date);
  if (!usable.length) return '';
  const signatures = usable.map(d => clothes(d.summary).join('|'));
  const common = [...new Set(signatures)].sort((a, b) => signatures.filter(x => x === b).length - signatures.filter(x => x === a).length)[0];
  const base = common.split('|').map(k => wardrobe[lang][k]).join(', ');
  const exceptions = usable.filter(d => clothes(d.summary).join('|') !== common).map(d => {
    const label = dayNames[lang][new Date(`${d.date}T12:00Z`).getUTCDay() - 1];
    return `${label}: ${clothes(d.summary).map(k => wardrobe[lang][k]).join(', ')}`;
  });
  const weather = { mk: { cold: 'Неделата се очекува да биде студена.', hot: 'Неделата се очекува да биде топла.', layers: 'Неделата се очекува да има умерени температури.', unknown: 'Недостасува временска прогноза.' }, en: { cold: 'A cold week is forecast.', hot: 'A hot week is forecast.', layers: 'Mostly mild temperatures are forecast this week.', unknown: 'The weather forecast is unavailable.' } };
  return `${weather[lang][common.split('|')[0]]} ${lang === 'mk' ? 'Подгответе' : 'Please bring'} ${base}.${exceptions.length ? '\n' + exceptions.join('; ') + '.' : ''}`;
}
export function parentMessages(week) {
  const messages = { weekly: {}, daily: {} };
  for (const lang of ['mk', 'en']) {
    const active = week.days.filter(d => d.theme && !d.closed && d.date >= week.today);
    const label = (mk, en) => lang === 'mk' ? mk : en;
    const titles = active.map(d => d.theme.title[lang]);
    const homework = [...new Set(active.map(d => d.theme.habit[lang]))].join(' ');
    const demo = week.mode === 'demo' ? label('ДЕМО ПРИМЕР\n', 'DEMO EXAMPLE\n') : '';
    const count = active.filter(d => d.mode === 'outside').length;
    const planning = lang === 'mk' ? `Приближно ${count} ден${count === 1 ? '' : 'а'} со активност надвор. Местото го проверуваме секое утро според воздухот и времето.` : `About ${count} outdoor activity day${count === 1 ? '' : 's'}. We check the air and weather each morning before deciding.`;
    const closed = week.days.filter(d => d.closed && d.date >= week.today).map(d => shortDate(d.date));
    const range = `${shortDate(week.days[0].date)} - ${shortDate(week.days.at(-1).date)}`;
    messages.weekly[lang] = [
      `${demo}${label('Почитувани родители,', 'Dear parents,')}`,
      `${label('Денови', 'Days')}: ${range}.`,
      clothingWeek(active, lang),
      active.length ? `${label('Активности во неделата', 'Week activities')}: ${titles.join(', ')}. ${planning}` : label('Нема планирани активности за преостанатите денови.', 'No activities are planned for the remaining days.'),
      active.length && homework ? `${label('Домашно', 'Homework')}: ${homework}` : '',
      closed.length ? `${label('Нема настава', 'No kindergarten')}: ${closed.join(', ')}.` : '',
    ].filter(Boolean).join('\n\n').replace(/\u2014/g, ',');
    for (const day of week.days) {
      if (!day.theme) continue;
      messages.daily[day.date] ??= {};
      if (day.closed) { messages.daily[day.date][lang] = `${demo}${lang === 'mk' ? 'Почитувани родители, на' : 'Dear parents, on'} ${shortDate(day.date)} ${lang === 'mk' ? 'нема планиран престој во градинка.' : 'there is no kindergarten session planned.'}`; continue; }
      const outdoors = day.mode === 'outside';
      const place = lang === 'mk' ? outdoors ? 'надвор' : 'внатре' : outdoors ? 'outside' : 'indoors';
      const reasons = { pollution: ['Поради загаден воздух (покачена PM2.5 процена), денешните активности остануваат внатре.', 'Because of air pollution (elevated PM2.5 readings), today’s activities stay inside.'], unknown_air: ['Нема доволно свежи локални мерења за да потврдиме излегување.', 'There are not enough fresh local readings to confirm outdoor play.'], weather: ['Планот е приспособен на временските услови.', 'The plan has been adjusted for the weather.'], air_forecast: ['Прогнозата за воздухот го насочува планот внатре.', 'The air forecast points to an indoor plan.'], unknown_weather: ['Временската прогноза е недостапна, па подготвуваме активност внатре.', 'The weather forecast is unavailable, so an indoor activity is prepared.'] };
      let reason = reasons[day.reason]?.[lang === 'mk' ? 0 : 1] ?? '';
      const change = week.changes?.find(item => item.from === day.date);
      if (change) {
        reason += change.to ? lang === 'mk'
          ? ` Друг привремен ден за активност надвор: ${shortDate(change.to)}. Потребна е проверка тоа утро.`
          : ` Another provisional outdoor day: ${shortDate(change.to)}. A check that morning is still required.`
          : lang === 'mk' ? ' Моментално нема друг соодветен ден за активност надвор.' : ' No replacement outdoor day currently meets the planning checks.';
      }
      const hasEco = day.timeline.some(row => row.kind === 'eco');
      const title = hasEco ? day.theme.title[lang] : lang === 'mk' ? 'Дневни активности' : 'Day activities';
      const what = hasEco ? day.activity?.[lang] ?? day.theme.inside[lang] : day.timeline.filter(row => row.kind === 'activity').slice(0, 2).map(row => row.label[lang]).join('. ') + '.';
      const wear = clothes(day.summary).map(k => wardrobe[lang][k]).join(', ');
      const draft = day.date > week.today || outdoors;
      messages.daily[day.date][lang] = `${demo}${lang === 'mk' ? 'Почитувани родители,' : 'Dear parents,'}\n\n${shortDate(day.date)}: ${title} (${place}). ${what}\n\n${lang === 'mk' ? 'Облека' : 'Clothing'}: ${wear}. ${reason}${draft ? ' ' + (lang === 'mk' ? 'Излегувањето зависи од проверката пред активноста.' : 'Outdoor play depends on the check before the activity.') : ''}${hasEco ? '\n' + (lang === 'mk' ? 'Мала навика за дома' : 'A little habit for home') + ': ' + day.theme.habit[lang] : ''}`.replace(/\u2014/g, ',').trim();
    }
  }
  return messages;
}
