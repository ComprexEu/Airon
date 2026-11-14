import type { Database } from './database.types';

type Row<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];

export type Plan = Row<'plans'>;
export type PlanDay = Row<'plan_days'>;
export type PlanDayExercise = Row<'plan_day_exercises'>;
export type Exercise = Row<'exercises'>;

// A day together with its exercises – the shape returned by a nested query
export type DayWithExercises = PlanDay & {
  plan_day_exercises: (PlanDayExercise & { exercises: Pick<Exercise, 'id' | 'name'> | null })[];
};

// The nested select used by the editor and the Today screen
export const PLAN_WITH_DAYS = '*, plan_days(*, plan_day_exercises(*, exercises(id, name)))' as const;

/** Sorts days and the exercises inside them by position (returns new arrays). */
export function sortDays(days: DayWithExercises[]): DayWithExercises[] {
  return [...days]
    .sort((a, b) => a.position - b.position)
    .map((d) => ({ ...d, plan_day_exercises: [...d.plan_day_exercises].sort((a, b) => a.position - b.position) }));
}
