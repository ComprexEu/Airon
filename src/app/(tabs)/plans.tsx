import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeContext';

type PlanListItem = {
  id: string;
  name: string;
  schedule_type: string;
  plan_days: { count: number }[];
};

export default function PlansScreen() {
  const t = useTheme();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [plans, setPlans] = useState<PlanListItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const [plansRes, activeRes] = await Promise.all([
      supabase
        .from('plans')
        .select('id, name, schedule_type, plan_days(count)')
        .eq('owner_id', userId) // RLS also lets public plans through, here we want only mine
        .order('created_at', { ascending: false }),
      supabase.from('user_active_plans').select('plan_id').maybeSingle(),
    ]);
    setLoading(false);
    if (plansRes.error) return Alert.alert('Could not load plans', plansRes.error.message);
    setPlans(plansRes.data);
    setActiveId(activeRes.data?.plan_id ?? null);
  }, [userId]);

  // Reload every time the screen comes back into focus (e.g. after editing a plan)
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function createPlan() {
    setCreating(true);
    const { data, error } = await supabase
      .from('plans')
      .insert({ name: 'New plan', schedule_type: 'rotation' })
      .select('id')
      .single();
    setCreating(false);
    if (error) return Alert.alert('Could not create the plan', error.message);
    router.push(`/plan/${data.id}`); // straight to the editor
  }

  return (
    <Screen scroll={false}>
      <FlatList
        data={plans}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 20, gap: 12 }}
        refreshing={loading}
        onRefresh={load}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 4 }}>
            <AppText variant="title">Plans</AppText>
            <Button title="New plan" onPress={createPlan} loading={creating} />
          </View>
        }
        ListEmptyComponent={
          loading ? undefined : <AppText muted>You have no plans yet. Create one or copy a featured plan.</AppText>
        }
        renderItem={({ item }) => {
          const active = item.id === activeId;
          return (
            <Pressable onPress={() => router.push(`/plan/${item.id}`)} accessibilityRole="button">
              <Card style={{ borderWidth: 1.5, borderColor: active ? t.accent : 'transparent' }}>
                {active && <AppText variant="small" style={{ color: t.accent }}>ACTIVE</AppText>}
                <AppText variant="heading">{item.name}</AppText>
                <AppText variant="small" muted>
                  {item.schedule_type === 'rotation' ? 'Rotation' : 'Weekly'} · days: {item.plan_days[0]?.count ?? 0}
                </AppText>
              </Card>
            </Pressable>
          );
        }}
        ListFooterComponent={
          // temporary: moves to the Account screen in week 5
          <View style={{ marginTop: 12 }}>
            <Button title="Sign out" variant="outline" onPress={() => supabase.auth.signOut()} />
          </View>
        }
      />
    </Screen>
  );
}
