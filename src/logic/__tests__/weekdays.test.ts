import { assignWeekdays } from '../weekdays';

const day = (id: string, position: number, day_of_week: number | null = null, is_rest = false) =>
  ({ id, position, day_of_week, is_rest });

describe('assignWeekdays', () => {
  it('spreads 3 training days over Mon, Wed, Fri and skips the rest day', () => {
    const days = [day('upper', 0), day('lower', 1), day('rest', 2, null, true), day('full', 3)];
    expect(assignWeekdays(days)).toEqual([
      { id: 'upper', day_of_week: 1 },
      { id: 'lower', day_of_week: 3 },
      { id: 'full', day_of_week: 5 },
    ]);
  });

  it('goes by position, not by array order', () => {
    expect(assignWeekdays([day('b', 1), day('a', 0)])).toEqual([
      { id: 'a', day_of_week: 1 },
      { id: 'b', day_of_week: 4 },
    ]);
  });

  it('keeps remembered weekdays and gives the others free ones', () => {
    // Upper was on Monday before; 2 training days → preferred Mon, Thu
    expect(assignWeekdays([day('upper', 0, 1), day('lower', 1)])).toEqual([{ id: 'lower', day_of_week: 4 }]);
  });

  it('changes nothing when every training day has a weekday', () => {
    expect(assignWeekdays([day('a', 0, 2), day('b', 1, 5)])).toEqual([]);
  });

  it('leaves days without a weekday when the week is full', () => {
    const days = Array.from({ length: 8 }, (_, i) => day(`d${i}`, i));
    const changes = assignWeekdays(days);
    expect(changes).toHaveLength(7);
    expect(new Set(changes.map((c) => c.day_of_week)).size).toBe(7);
    expect(changes.some((c) => c.id === 'd7')).toBe(false);
  });
});
