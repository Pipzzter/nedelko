import { createCurriculum } from '../services/curriculum.js';

// Synthetic provider success for API/ownership tests. No live model is called.
export async function simulatedCurriculum(dates, settings, options = {}) {
  const example = await createCurriculum(dates, settings, { ...options, useAI: false });
  return { ...example, source: options.useAI === false ? 'library' : 'ai' };
}
