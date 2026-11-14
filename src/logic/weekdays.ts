// Weekly plans: which weekday each training day gets. Pure logic, easy to test.
import type { DayLike } from './rotation';

// Weekdays spread over the week for 1–7 workouts (e.g. 3 → Mon, Wed, Fri)
const SPREAD: Record<number, number[]> = {
  1: [1], 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6], 7: [1, 2, 3, 4, 5, 6, 7],
};

/**
 * Gives free weekdays to training days without one, in cycle order (by position).
 * Days that already have a weekday keep it, rest days never get one.
 * Returns only the days that change.
 */
export function assignWeekdays(days: DayLike[]): { id: string; day_of_week: number }[] {
  const training = days.filter((d) => !d.is_rest).sort((a, b) => a.position - b.position);
  const taken = new Set(training.map((d) => d.day_of_week).filter((d): d is number => d !== null));
  const preferred = [...(SPREAD[Math.min(training.length, 7)] ?? []), 1, 2, 3, 4, 5, 6, 7];
  const changes: { id: string; day_of_week: number }[] = [];
  for (const day of training) {
    if (day.day_of_week !== null) continue;
    const free = preferred.find((d) => !taken.has(d));
    if (free === undefined) break; // more than 7 training days – the rest stay without a weekday
    taken.add(free);
    changes.push({ id: day.id, day_of_week: free });
  }
  return changes;
}
