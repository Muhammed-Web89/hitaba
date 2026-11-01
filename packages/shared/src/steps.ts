import type { ProfileStepKey } from './schemas';

/** Sihirbaz sırası. Kadında ek olarak `wali` adımı vardır (ayrı endpoint). */
export const PROFILE_STEP_ORDER: ProfileStepKey[] = [
  'basics',
  'location',
  'body',
  'family',
  'about',
  'spouse',
  'beliefs',
  'screening',
  'rules',
];
