export const PREFERENCE_BOUNDS = Object.freeze({
  minApparentC: Object.freeze({ min: -10, max: 20 }),
  maxApparentC: Object.freeze({ min: 20, max: 38 }),
  maxPrecipProbability: Object.freeze({ min: 0, max: 90 }),
  maxPrecipitationMm: Object.freeze({ min: 0, max: 5 }),
  maxWindKmh: Object.freeze({ min: 0, max: 50 })
});

const invalidPreferences = () => Object.assign(new Error('invalid_preferences'), { status: 400, code: 'invalid_preferences' });

export function validatePreferences(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalidPreferences();
  const preferences = {};
  for (const [key, { min, max }] of Object.entries(PREFERENCE_BOUNDS)) {
    const n = value[key];
    if (!Number.isFinite(n) || n < min || n > max) throw invalidPreferences();
    preferences[key] = n;
  }
  if (preferences.minApparentC >= preferences.maxApparentC) throw invalidPreferences();
  return preferences;
}
