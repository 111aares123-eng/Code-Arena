import { applyPracticePass, normalizeProgress, type PracticeProgress } from './game-rules';
export type { PracticeProgress } from './game-rules';
const STORAGE_KEY = 'codearena.practice-progress.v1';
const PROGRESS_EVENT = 'codearena:practice-progress';

export const EMPTY_PRACTICE_PROGRESS: PracticeProgress = {
  xp: 0,
  solvedProblemSlugs: [],
  practiceDays: [],
};

export const SERVER_DAY_SNAPSHOT = 'server-render';
let cachedDaySnapshot = '';

export function getDaySnapshot(): string {
  const current = new Date();
  const day = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
  if (day !== cachedDaySnapshot) cachedDaySnapshot = day;
  return cachedDaySnapshot;
}

export function subscribeToDaySnapshot(onChange: () => void): () => void {
  const scheduleNextDay = () => {
    const current = new Date();
    const nextDay = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1);
    return window.setTimeout(() => {
      cachedDaySnapshot = '';
      onChange();
      timer = scheduleNextDay();
    }, Math.max(1_000, nextDay.getTime() - current.getTime() + 50));
  };

  let timer = scheduleNextDay();
  return () => window.clearTimeout(timer);
}

let cachedStorageValue: string | null | undefined;
let cachedProgress = EMPTY_PRACTICE_PROGRESS;

export function readPracticeProgress(): PracticeProgress {
  if (typeof window === 'undefined') return EMPTY_PRACTICE_PROGRESS;

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === cachedStorageValue) return cachedProgress;
    cachedStorageValue = stored;
    if (!stored) {
      cachedProgress = EMPTY_PRACTICE_PROGRESS;
      return cachedProgress;
    }

    cachedProgress = normalizeProgress(JSON.parse(stored));
    return cachedProgress;
  } catch {
    cachedStorageValue = undefined;
    cachedProgress = EMPTY_PRACTICE_PROGRESS;
    return cachedProgress;
  }
}

export function recordPracticeSamplePassed(problemSlug: string): PracticeProgress {
  const progress = readPracticeProgress();
  const nextProgress = applyPracticePass(progress, problemSlug, getDaySnapshot());
  if (nextProgress === progress) return progress;

  try {
    const serialized = JSON.stringify(nextProgress);
    window.localStorage.setItem(STORAGE_KEY, serialized);
    cachedStorageValue = serialized;
    cachedProgress = nextProgress;
    window.dispatchEvent(new CustomEvent(PROGRESS_EVENT));
  } catch {
    // Practice still works when browser storage is unavailable.
  }

  return nextProgress;
}

export function subscribeToPracticeProgress(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) onChange();
  };
  const onPracticeProgress = () => onChange();

  window.addEventListener('storage', onStorage);
  window.addEventListener(PROGRESS_EVENT, onPracticeProgress);

  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(PROGRESS_EVENT, onPracticeProgress);
  };
}
