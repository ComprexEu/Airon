import { AppText } from '@/components/AppText';
import { Screen } from '@/components/Screen';

export default function ProgressScreen() {
  return (
    <Screen>
      <AppText variant="title">Progress</AppText>
      <AppText muted>Your stats will appear here.</AppText>
    </Screen>
  );
}