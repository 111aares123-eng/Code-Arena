import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPracticePass, normalizeProgress, calculateStreak, getAchievements } from '../apps/web/src/lib/game-rules.ts';

test('first completion awards XP once; repeat practice on a new day maintains streak', () => {
  const first = applyPracticePass(normalizeProgress(null), 'two-sum', '2026-10-15');
  assert.equal(first.xp, 25);
  assert.equal(applyPracticePass(first, 'two-sum', '2026-10-15'), first);
  const next = applyPracticePass(first, 'two-sum', '2026-10-16');
  assert.equal(next.xp, 25);
  assert.equal(calculateStreak(next.practiceDays, '2026-10-16'), 2);
  assert.equal(calculateStreak(next.practiceDays, '2026-10-17'), 2);
  assert.equal(calculateStreak(next.practiceDays, '2026-10-18'), 0);
});
test('legacy saves are deduplicated and malformed values cannot inflate XP', () => {
  const result = normalizeProgress({ xp: Infinity, solvedProblemSlugs: ['two-sum', 'two-sum', 42, ''], practiceDays: ['2026-02-30', 'bad', '2026-10-16', '2026-10-16'] });
  assert.deepEqual(result, { xp: 25, solvedProblemSlugs: ['two-sum'], practiceDays: ['2026-10-16'] });
  assert.deepEqual(normalizeProgress(null), { xp: 0, solvedProblemSlugs: [], practiceDays: [] });
});
test('streak achievement stays earned after streak breaks, including month boundaries', () => {
  const progress = normalizeProgress({ solvedProblemSlugs: ['one', 'two', 'three'], practiceDays: ['2026-09-27','2026-09-28','2026-09-29','2026-09-30','2026-10-01','2026-10-02','2026-10-03'] });
  assert.equal(calculateStreak(progress.practiceDays, '2026-10-16'), 0);
  assert.ok(getAchievements(progress).every(item => item.current === item.target));
});
