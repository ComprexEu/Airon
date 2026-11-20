import { friendlyMessage } from '../errors';

describe('friendlyMessage', () => {
  it('explains a network error', () => {
    expect(friendlyMessage(new Error('TypeError: Network request failed'))).toMatch(/No internet/);
  });
  it('explains a weekday clash in a plan', () => {
    expect(friendlyMessage({ message: 'duplicate key value violates unique constraint "plan_days_plan_id_day_of_week_key"' }))
      .toMatch(/already on that weekday/);
  });
  it('explains a blocked write', () => {
    expect(friendlyMessage({ message: 'new row violates row-level security policy for table "plans"' }))
      .toBe('You are not allowed to do this.');
  });
  it('keeps an unknown message as it is', () => {
    expect(friendlyMessage({ message: 'Proposal not found or already handled' })).toBe('Proposal not found or already handled');
  });
});
