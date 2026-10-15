import { randomUUID } from 'node:crypto';

export type ActivityEvent = {
  id: string;
  type: 'practice_sample_passed';
  problemSlug: string;
  problemTitle: string;
  createdAt: string;
};

const MAX_EVENTS = 40;
const events: ActivityEvent[] = [];
const listeners = new Set<(event: ActivityEvent) => void>();

export function publishPracticeSamplePassed(problem: {
  slug: string;
  title: string;
}): ActivityEvent {
  const event: ActivityEvent = {
    id: randomUUID(),
    type: 'practice_sample_passed',
    problemSlug: problem.slug,
    problemTitle: problem.title,
    createdAt: new Date().toISOString(),
  };

  events.unshift(event);
  events.length = Math.min(events.length, MAX_EVENTS);
  listeners.forEach((listener) => listener(event));
  return event;
}

export function getRecentActivity(): ActivityEvent[] {
  return [...events];
}

export function subscribeToActivity(listener: (event: ActivityEvent) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

