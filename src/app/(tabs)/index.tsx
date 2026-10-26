import { AppText } from '@/components/AppText';
import { Screen } from '@/components/Screen';

export default function TodayScreen() {
  return (
    <Screen>
      <AppText variant="title">Today</AppText>
      <AppText muted>Your workout for today will appear here.</AppText>
    </Screen>
  );
}