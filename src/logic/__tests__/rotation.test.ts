import { daysSince, getCurrentDay, isoWeekday } from '../rotation';

const upper = { id: 'u', position: 0, day_of_week: null, is_rest: false };
const lower = { id: 'l', position: 1, day_of_week: null, is_rest: false };
const rest = { id: 'r', position: 2, day_of_week: null, is_rest: true };
const rotation = [upper, lower, rest];

// 20 Oct 2026 is a Tuesday
const tuesday = new Date(2026, 9, 20);

describe('isoWeekday', () => {
  it('Monday is 1, Sunday is 7', () => {
    expect(isoWeekday(new Date(2026, 9, 19))).toBe(1);
    expect(isoWeekday(new Date(2026, 9, 25))).toBe(7);
  });
});

describe('daysSince', () => {
  it('counts whole days', () => {
    expect(daysSince('2026-10-18', tuesday)).toBe(2);
    expect(daysSince('2026-10-20', tuesday)).toBe(0);
  });

  it('is not shifted by the change to winter time (25 Oct 2026)', () => {
    expect(daysSince('2026-10-24', new Date(2026, 9, 26))).toBe(2);
  });
});

describe('rotation by completion', () => {
  const base = { scheduleType: 'rotation' as const, advanceMode: 'completion' as const, startedOn: '2026-10-01', today: tuesday };

  it('starts from the first day when there is no history', () => {
    expect(getCurrentDay({ ...base, days: rotation, lastDayPosition: null })?.id).toBe('u');
  });

  it('Lower comes after Upper, rest comes after Lower', () => {
    expect(getCurrentDay({ ...base, days: rotation, lastDayPosition: 0 })?.id).toBe('l');
    expect(getCurrentDay({ ...base, days: rotation, lastDayPosition: 1 })?.id).toBe('r');
  });

  it('goes back to the start after the last day', () => {
    expect(getCurrentDay({ ...base, days: rotation, lastDayPosition: 2 })?.id).toBe('u');
  });

  it('takes the order from position, not from the array order', () => {
    expect(getCurrentDay({ ...base, days: [rest, upper, lower], lastDayPosition: 0 })?.id).toBe('l');
  });

  it('starts over when the last day was removed from the plan', () => {
    expect(getCurrentDay({ ...base, days: rotation, lastDayPosition: 7 })?.id).toBe('u');
  });

  it('returns null for an empty plan', () => {
    expect(getCurrentDay({ ...base, days: [], lastDayPosition: null })).toBeNull();
  });
});

describe('rotation by calendar', () => {
  const base = { scheduleType: 'rotation' as const, advanceMode: 'calendar' as const, days: rotation, lastDayPosition: null };

  it('is on the first day on the start date', () => {
    expect(getCurrentDay({ ...base, startedOn: '2026-10-20', today: tuesday })?.id).toBe('u');
  });

  it('a 3-day cycle is on the second day after 4 days', () => {
    expect(getCurrentDay({ ...base, startedOn: '2026-10-16', today: tuesday })?.id).toBe('l');
  });
});

describe('weekly plan', () => {
  const mon = { id: 'mon', position: 0, day_of_week: 1, is_rest: false };
  const wed = { id: 'wed', position: 1, day_of_week: 3, is_rest: false };
  const base = { scheduleType: 'weekly' as const, advanceMode: 'completion' as const, days: [mon, wed], startedOn: '2026-10-01', lastDayPosition: null };

  it('returns the Monday day on a Monday', () => {
    expect(getCurrentDay({ ...base, today: new Date(2026, 9, 19) })?.id).toBe('mon');
  });

  it('has no workout on a Tuesday', () => {
    expect(getCurrentDay({ ...base, today: tuesday })).toBeNull();
  });

  it('ignores a rest day kept from a rotation, even with a weekday', () => {
    const hiddenRest = { id: 'rest', position: 2, day_of_week: 2, is_rest: true };
    expect(getCurrentDay({ ...base, days: [mon, wed, hiddenRest], today: tuesday })).toBeNull();
  });
});
