import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { supabase } from '@/lib/supabase';

export default function PlansScreen() {
  return (
    <Screen>
      <AppText variant="title">Plans</AppText>
      <AppText muted>Your training plans will appear here.</AppText>
      {/* temporary: moves to the Account screen in week 5 */}
      <Button title="Sign out" variant="outline" onPress={() => supabase.auth.signOut()} />
    </Screen>
  );
}
