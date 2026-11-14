// Pure logic, no React and no database: easy to test.

export type DayLike = {
  id: string;
  position: number;
  day_of_week: number | null; // 1 = Mon … 7 = Sun
  is_rest: boolean;
};

export type ScheduleType = 'weekly' | 'rotation';
export type AdvanceMode = 'completion' | 'calendar';

/** Day of the week in the database format: 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: Date): number {
  const d = date.getDay(); // JS: 0 = Sunday, 1 = Monday …
  return d === 0 ? 7 : d;
}

/** Number of whole days between a 'YYYY-MM-DD' date and the given day (local time). */
export function daysSince(startISO: string, today: Date): number {
  const [y, m, d] = startISO.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((end.getTime() - start.getTime()) / 86_400_000); // round: DST days have 23 or 25 hours
}

/** Remainder that is always positive (in JS -1 % 3 gives -1). */
function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

type Params<T extends DayLike> = {
  scheduleType: ScheduleType;
  days: T[];
  advanceMode: AdvanceMode;
  startedOn: string;              // date the plan was set as active
  lastDayPosition: number | null; // day position of the last logged workout
  today: Date;
};

/**
 * Returns the plan day that falls on "today", or null when there is nothing today
 * (a weekly plan with no workout on this weekday, or a plan with no days).
 */
export function getCurrentDay<T extends DayLike>(p: Params<T>): T | null {
  const days = [...p.days].sort((a, b) => a.position - b.position);
  if (days.length === 0) return null;

  // Weekly plan: find the training day assigned to today's weekday.
  // Rest days are skipped – they are hidden in a weekly plan and only used when it is a rotation.
  if (p.scheduleType === 'weekly') {
    return days.find((d) => !d.is_rest && d.day_of_week === isoWeekday(p.today)) ?? null;
  }

  // Calendar rotation: every calendar day is the next day of the cycle
  if (p.advanceMode === 'calendar') {
    return days[mod(daysSince(p.startedOn, p.today), days.length)];
  }

  // Completion rotation: the day after the last completed one
  if (p.lastDayPosition === null) return days[0];
  const lastIndex = days.findIndex((d) => d.position === p.lastDayPosition);
  if (lastIndex === -1) return days[0]; // the day was removed from the plan – start over
  return days[(lastIndex + 1) % days.length];
}
