import { AppText } from '@/components/AppText';
import { Screen } from '@/components/Screen';

export default function PlansScreen() {
  return (
    <Screen>
      <AppText variant="title">Plans</AppText>
      <AppText muted>Your training plans will appear here.</AppText>
    </Screen>
  );
}