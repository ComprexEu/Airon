import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useAuth } from '@/context/AuthContext';
import { showError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeContext';

type ExplorePlan = {
  id: string;
  owner_id: string | null;
  name: string;
  description: string | null;
  goal: string | null;
  level: string | null;
  schedule_type: string;
  is_featured: boolean;
  plan_days: { name: string; position: number; is_rest: boolean }[];
};

type Option = { value: string | null; label: string };

const GOALS: Option[] = [
  { value: null, label: 'All goals' },
  { value: 'hypertrophy', label: 'Muscle' },
  { value: 'strength', label: 'Strength' },
  { value: 'general', label: 'General' },
];
const LEVELS: Option[] = [
  { value: null, label: 'Any level' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

export default function ExploreScreen() {
  const t = useTheme();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [plans, setPlans] = useState<ExplorePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [goal, setGoal] = useState<string | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);

  // Build the query step by step: add a filter only when one is selected
  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      let q = supabase
        .from('plans')
        .select('id, owner_id, name, description, goal, level, schedule_type, is_featured, plan_days(name, position, is_rest)')
        .or('visibility.eq.public,is_featured.eq.true')
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false });
      if (goal) q = q.eq('goal', goal);
      if (level) q = q.eq('level', level);
      const { data, error } = await q;
      setLoading(false);
      if (error) return showError(error, 'Could not load plans');
      // Own plans are filtered out here, not with .neq('owner_id', ...) in the query:
      // featured plans have owner_id = null, and in SQL null <> 'abc' is not true, so they would vanish too
      setPlans(data.filter((p) => p.owner_id !== userId));
    })();
  }, [goal, level, userId]); // runs again when a filter changes

  async function copy(planId: string) {
    setCopyingId(planId);
    const { data: newId, error } = await supabase.rpc('copy_plan', { source_plan_id: planId });
    setCopyingId(null);
    if (error) return showError(error, 'Could not copy the plan');
    router.replace(`/plan/${newId}`); // straight to the copy's editor; "back" returns to the plan list
  }

  const filters = [
    { items: GOALS, value: goal, set: setGoal },
    { items: LEVELS, value: level, set: setLevel },
  ];

  return (
    <FlatList
      style={{ backgroundColor: t.bg }}
      data={plans}
      keyExtractor={(p) => p.id}
      contentContainerStyle={{ padding: 20, gap: 12 }}
      ListHeaderComponent={
        <View style={{ gap: 8 }}>
          {filters.map((f, i) => (
            <View key={i} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {f.items.map((o) => {
                const selected = f.value === o.value;
                return (
                  <Pressable key={o.label} onPress={() => f.set(o.value)}
                    accessibilityRole="radio" accessibilityState={{ selected }}
                    style={{ paddingHorizontal: 12, minHeight: 36, justifyContent: 'center', borderRadius: 999,
                      backgroundColor: selected ? t.accent : t.surface }}>
                    <AppText variant="small" style={{ color: selected ? t.onAccent : t.text }}>{o.label}</AppText>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      }
      ListEmptyComponent={loading ? undefined : <AppText muted>No plans match these filters.</AppText>}
      renderItem={({ item }) => {
        // A weekly plan shows only its workouts, the same as the editor does
        const days = [...item.plan_days]
          .filter((d) => item.schedule_type === 'rotation' || !d.is_rest)
          .sort((a, b) => a.position - b.position);
        return (
          <Card>
            {item.is_featured && <AppText variant="small" style={{ color: t.accent }}>FEATURED</AppText>}
            <AppText variant="heading">{item.name}</AppText>
            {item.description && <AppText muted>{item.description}</AppText>}
            <AppText variant="small" muted>
              {item.schedule_type === 'rotation' ? 'Rotation' : 'Weekly'} · {days.map((d) => d.name).join(' → ')}
            </AppText>
            <Button title="Copy to my plans" variant="outline"
              loading={copyingId === item.id} disabled={copyingId !== null} onPress={() => copy(item.id)} />
          </Card>
        );
      }}
    />
  );
}
