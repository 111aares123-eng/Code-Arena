/** Browser-local practice rewards, never a competitive rating. */
export const XP_PER_SOLVE = 25;
export const XP_PER_LEVEL = 100;
export interface PracticeProgress {
  xp: number;
  solvedProblemSlugs: string[];
  practiceDays: string[];
}
export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function validDay(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    dateKey(new Date(`${value}T12:00:00`)) === value;
}
export function normalizeProgress(value: unknown): PracticeProgress {
  const data = value && typeof value === 'object' ? value as Partial<PracticeProgress> : {};
  const solvedProblemSlugs = [...new Set(Array.isArray(data.solvedProblemSlugs)
    ? data.solvedProblemSlugs.filter((s): s is string => typeof s === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)) : [])];
  return {
    // Reconstruct rewards from unique completions, including existing v1 saves.
    xp: solvedProblemSlugs.length * XP_PER_SOLVE,
    solvedProblemSlugs,
    practiceDays: [...new Set(Array.isArray(data.practiceDays) ? data.practiceDays.filter(validDay) : [])].sort(),
  };
}
export function applyPracticePass(progress: PracticeProgress, slug: string, today: string): PracticeProgress {
  if (!validDay(today) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return progress;
  const solved = progress.solvedProblemSlugs.includes(slug);
  const practiced = progress.practiceDays.includes(today);
  if (solved && practiced) return progress;
  return {
    xp: progress.xp + (solved ? 0 : XP_PER_SOLVE),
    solvedProblemSlugs: solved ? progress.solvedProblemSlugs : [...progress.solvedProblemSlugs, slug],
    practiceDays: practiced ? progress.practiceDays : [...progress.practiceDays, today].sort(),
  };
}
export function calculateStreak(practiceDays: string[], today: string): number {
  if (!validDay(today)) return 0;
  const days = new Set(practiceDays);
  const cursor = new Date(`${today}T12:00:00`);
  if (!days.has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(dateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
export function longestStreak(practiceDays: string[]): number {
  const days = [...new Set(practiceDays.filter(validDay))].sort();
  let best = 0, current = 0, previous = '';
  for (const day of days) {
    const yesterday = new Date(`${day}T12:00:00`);
    yesterday.setDate(yesterday.getDate() - 1);
    current = dateKey(yesterday) === previous ? current + 1 : 1;
    best = Math.max(best, current);
    previous = day;
  }
  return best;
}
export function getAchievements(progress: PracticeProgress) {
  const best = longestStreak(progress.practiceDays);
  return [
    { id: 'first-light', name: 'First light', description: 'First sample pass', current: Math.min(1, progress.solvedProblemSlugs.length), target: 1 },
    { id: 'on-a-roll', name: 'On a roll', description: '7-day streak', current: Math.min(7, best), target: 7 },
    { id: 'three-peat', name: 'Three-peat', description: '3 unique problems', current: Math.min(3, progress.solvedProblemSlugs.length), target: 3 },
  ];
}
