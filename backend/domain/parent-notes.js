import { invalid, teacherInstruction, textPair, pair } from './settings.js';

export function validateParentNote(body, week) {
  const text = teacherInstruction(body.text);
  if (text.length < 3 || text.length > 1200 || typeof body.nonce !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(body.nonce)) throw invalid('invalid_parent_note');
  const date = body.date || null;
  if (date !== null && !week.days.some(day => day.date === date)) throw invalid('invalid_parent_note');
  return { text, date, nonce: body.nonce };
}
export function informationalNote(text) {
  const personal = /\b(?:my|our) (?:kid|child|son|daughter)\b|моето дете|син ми|ќерка ми|тој|таа|\bhe\b|\bshe\b/iu.test(text);
  if (/allerg|medicat|medical|does(?:n't| not) eat|does not eat|dietary|алерг|лекови|медицин|не јаде/iu.test(text) ||
      personal && /outside|outdoors?|go out|надвор|absen|attend|отсуств|нема да дојде/iu.test(text)) return {
    kind: 'informational', explanation: pair('Ова е информација за индивидуална грижа. Разгледајте ја со семејството; споделениот план не може да менува исхрана, присуство или дозволи за поединечно дете.', 'This concerns individual care. Review it with the family; the shared plan cannot change a child’s diet, attendance or individual permissions.'),
  };
  return null;
}
export function validateNoteAdvice(value, week) {
  if (!value || !['informational', 'actionable'].includes(value.kind)) throw invalid('invalid_note_advice');
  const explanation = textPair(value.explanation, 600);
  if (value.kind === 'informational' || value.audience !== 'group') return { kind: 'informational', explanation };
  if (!week.days.some(day => day.date === value.date) || !['activity', 'schedule', 'inside', 'outside'].includes(value.scope)) throw invalid('invalid_note_advice');
  if (value.scope === 'activity' && !week.days.find(day => day.date === value.date).timeline.some(row => row.id === value.rowId)) throw invalid('invalid_note_advice');
  const instruction = teacherInstruction(value.instruction);
  if (!instruction) throw invalid('invalid_note_advice');
  return { kind: 'actionable', explanation, date: value.date, scope: value.scope, rowId: value.scope === 'activity' ? value.rowId : null, instruction };
}
