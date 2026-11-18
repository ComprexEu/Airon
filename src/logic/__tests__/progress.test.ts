import {
  best1RMPerDay, bestSet, chartableExercises, estimate1RM, isPlateau, monthRange, monthShort, visibleOptions,
} from '../progress';

describe('estimate1RM', () => {
  it('80 kg × 8 is about 101.5 kg', () => {
    expect(estimate1RM(80, 8)).toBe(101.5);
  });
  it('one rep is the weight itself', () => {
    expect(estimate1RM(100, 1)).toBe(100);
  });
  it('zero reps or zero kg gives 0', () => {
    expect(estimate1RM(0, 5)).toBe(0);
    expect(estimate1RM(80, 0)).toBe(0);
  });
  it('more than 12 reps does not count', () => {
    expect(estimate1RM(40, 15)).toBe(0);
    expect(estimate1RM(60, 12)).toBe(84);
  });
});

describe('best1RMPerDay', () => {
  it('takes the best set of each day and sorts oldest first', () => {
    const points = best1RMPerDay([
      { weight: 80, reps: 8, created_at: '2026-10-10T10:00:00' },
      { weight: 70, reps: 8, created_at: '2026-10-03T10:00:00' },
      { weight: 85, reps: 5, created_at: '2026-10-10T10:05:00' },
    ]);
    expect(points.length).toBe(2);
    expect(points[0].date).toBe('2026-10-03');
    expect(points[1].value).toBe(101.5);
  });
});

describe('bestSet', () => {
  it('returns the set with the highest estimated 1RM', () => {
    const best = bestSet([
      { weight: 70, reps: 8, created_at: '2026-10-03T10:00:00' },
      { weight: 80, reps: 8, created_at: '2026-10-10T10:00:00' },
      { weight: 85, reps: 5, created_at: '2026-10-10T10:05:00' },
    ]);
    expect(best?.weight).toBe(80);
    expect(best?.reps).toBe(8);
  });
  it('returns null when no set counts', () => {
    expect(bestSet([{ weight: 30, reps: 20, created_at: '2026-10-03T10:00:00' }])).toBeNull();
  });
});

describe('isPlateau', () => {
  const p = (values: number[]) => values.map((value, i) => ({ date: `2026-10-${10 + i}`, value }));

  it('rising results are not a plateau', () => {
    expect(isPlateau(p([90, 95, 100, 101.5]))).toBe(false);
  });
  it('three workouts without a new best is a plateau', () => {
    expect(isPlateau(p([95, 101.5, 101.5, 100, 101.5]))).toBe(true);
  });
  it('too little data is not a plateau', () => {
    expect(isPlateau(p([100, 100]))).toBe(false);
  });
});

describe('chartableExercises', () => {
  const s = (exercise_id: string, weight: number, reps: number, day: string) =>
    ({ exercise_id, weight, reps, created_at: `2026-10-${day}T10:00:00` });

  it('keeps weighted exercises from at least 2 days, most trained first', () => {
    const ids = chartableExercises([
      s('bench', 80, 8, '01'), s('bench', 80, 8, '04'), s('bench', 82, 6, '08'),
      s('squat', 100, 5, '02'), s('squat', 100, 5, '06'),
      s('pushup', 0, 20, '01'), s('pushup', 0, 20, '03'),   // bodyweight: no kg
      s('curl', 12, 15, '01'), s('curl', 12, 15, '05'),     // only high-rep sets
      s('row', 60, 10, '02'),                               // only one day
    ]);
    expect(ids).toEqual(['bench', 'squat']);
  });
});

describe('visibleOptions', () => {
  const options = [
    { id: 'b', name: 'Barbell Bench Press', chartable: true },
    { id: 's', name: 'Back Squat', chartable: true },
    { id: 'c', name: 'Dumbbell Curl', chartable: false },
  ];

  it('empty search shows only exercises with a chart', () => {
    expect(visibleOptions(options, '', 'b').map((o) => o.id)).toEqual(['b', 's']);
  });
  it('search finds any logged exercise, ignoring letter case', () => {
    expect(visibleOptions(options, 'CURL', 'b').map((o) => o.id)).toEqual(['b', 'c']);
    expect(visibleOptions(options, 'curl', 'c').map((o) => o.id)).toEqual(['c']);
  });
});

describe('months', () => {
  it('short month name', () => {
    expect(monthShort('2026-08-03')).toBe('Aug');
  });
  it('range of the chart', () => {
    expect(monthRange([{ date: '2026-08-03', value: 1 }, { date: '2026-10-20', value: 2 }])).toBe('Aug – Oct');
    expect(monthRange([{ date: '2026-10-03', value: 1 }, { date: '2026-10-20', value: 2 }])).toBe('Oct');
  });
});
