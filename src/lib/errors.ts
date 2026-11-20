import { Alert } from 'react-native';

/** Turns technical Supabase / network errors into messages a user understands. */
export function friendlyMessage(error: unknown): string {
  const msg = error instanceof Error
    ? error.message
    : String((error as { message?: unknown } | null)?.message ?? error);
  if (/network|fetch|timeout/i.test(msg)) return 'No internet connection. Check your network and try again.';
  if (/JWT|session|not authenticated/i.test(msg)) return 'Your session has expired. Please sign in again.';
  if (/day_of_week/i.test(msg)) return 'Another day of this plan is already on that weekday.';
  if (/reps_max|reps_min/i.test(msg)) return 'Max reps cannot be lower than min reps.';
  if (/row-level security/i.test(msg)) return 'You are not allowed to do this.';
  if (/Invalid login credentials/i.test(msg)) return 'Wrong e-mail or password.';
  return msg; // unknown error: show the original, it helps when reporting bugs
}

/** One way to show errors in the whole app. */
export function showError(error: unknown, title = 'Something went wrong') {
  Alert.alert(title, friendlyMessage(error));
}
