// Calculations for the Progress screen – pure functions, easy to test.

export type LoggedSet = { weight: number; reps: number; created_at: string };
export type Point = { date: string; value: number }; // date: 'YYYY-MM-DD'

/** Above this many reps the formula is too inaccurate, so such sets are skipped. */
export const MAX_REPS_FOR_1RM = 12;

/** Is this set usable for the 1RM chart? It needs a weight and at most 12 reps. */
export function countsFor1RM(weight: number, reps: number): boolean {
  return weight > 0 && reps > 0 && reps <= MAX_REPS_FOR_1RM;
}

/** Estimated one-rep max (Epley formula), rounded to 0.5 kg. 0 when the set does not count. */
export function estimate1RM(weight: number, reps: number): number {
  if (!countsFor1RM(weight, reps)) return 0;
  if (reps === 1) return weight;
  const raw = weight * (1 + reps / 30);
  return Math.round(raw * 2) / 2;
}

/** 'YYYY-MM-DD' date in the phone's local time. */
export function localDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Best estimated 1RM from each training day, oldest first. */
export function best1RMPerDay(sets: LoggedSet[]): Point[] {
  const best = new Map<string, number>();
  for (const s of sets) {
    const day = localDate(s.created_at);
    const value = estimate1RM(s.weight, s.reps);
    if (value > (best.get(day) ?? 0)) best.set(day, value);
  }
  return [...best.entries()]
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** The set with the best estimated 1RM, for the line "best set 80 kg × 8". */
export function bestSet(sets: LoggedSet[]): (LoggedSet & { value: number }) | null {
  let best: (LoggedSet & { value: number }) | null = null;
  for (const s of sets) {
    const value = estimate1RM(s.weight, s.reps);
    if (value > 0 && (!best || value > best.value)) best = { ...s, value };
  }
  return best;
}

/**
 * Plateau: none of the last `window` workouts beat the best result
 * from before them. Not enough data → false.
 */
export function isPlateau(points: Point[], window = 3): boolean {
  if (points.length < window + 1) return false;
  const before = Math.max(...points.slice(0, -window).map((p) => p.value));
  const recent = Math.max(...points.slice(-window).map((p) => p.value));
  return recent <= before;
}

/**
 * Exercises worth a chart: at least `minDays` different days with sets that count for 1RM.
 * Sorted by the number of days, most trained first.
 */
export function chartableExercises<T extends LoggedSet & { exercise_id: string }>(
  sets: T[],
  minDays = 2,
): string[] {
  const days = new Map<string, Set<string>>();
  for (const s of sets) {
    if (!countsFor1RM(s.weight, s.reps)) continue;
    if (!days.has(s.exercise_id)) days.set(s.exercise_id, new Set());
    days.get(s.exercise_id)!.add(localDate(s.created_at));
  }
  return [...days]
    .filter(([, d]) => d.size >= minDays)
    .sort((a, b) => b[1].size - a[1].size)
    .map(([id]) => id);
}

export type ExerciseOption = { id: string; name: string; chartable: boolean };

/**
 * Chips under the search box. Empty search: the chartable exercises (up to `limit`).
 * With text: every logged exercise whose name contains it, ignoring letter case.
 * The selected exercise always stays visible, so the user sees what the chart shows.
 */
export function visibleOptions(
  options: ExerciseOption[],
  query: string,
  selectedId: string | null,
  limit = 8,
): ExerciseOption[] {
  const q = query.trim().toLowerCase();
  const list = q
    ? options.filter((o) => o.name.toLowerCase().includes(q))
    : options.filter((o) => o.chartable).slice(0, limit);
  const selected = options.find((o) => o.id === selectedId);
  return selected && !list.some((o) => o.id === selected.id) ? [selected, ...list] : list;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Short month name of a 'YYYY-MM-DD' date, e.g. 'Aug'. */
export function monthShort(date: string): string {
  return MONTHS[Number(date.slice(5, 7)) - 1];
}

/** Month range shown above the chart, e.g. 'Aug – Oct' (or just 'Oct'). */
export function monthRange(points: Point[]): string {
  if (points.length === 0) return '';
  const first = monthShort(points[0].date);
  const last = monthShort(points[points.length - 1].date);
  return first === last ? last : `${first} – ${last}`;
}
