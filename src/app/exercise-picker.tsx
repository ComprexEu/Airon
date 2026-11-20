import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { useAuth } from '@/context/AuthContext';
import { showError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeContext';
import type { Exercise } from '@/types';

// The same groups as in the exercise library (seed.sql)
const MUSCLE_GROUPS = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Glutes', 'Calves', 'Core'];

export default function ExercisePicker() {
  const { dayId } = useLocalSearchParams<{ dayId: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const t = useTheme();
  const [query, setQuery] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [customMuscle, setCustomMuscle] = useState('');
  const [saving, setSaving] = useState(false);

  // Search: a new query 250 ms after the last key press (debounce)
  useEffect(() => {
    if (!userId) return;
    const timer = setTimeout(async () => {
      // Library exercises and my own only. RLS also shows other people's custom exercises
      // that appear in public plans (so those plans show names), but they don't belong in the picker.
      let q = supabase
        .from('exercises')
        .select('*')
        .or(`created_by.is.null,created_by.eq.${userId}`)
        .order('name')
        .limit(50);
      if (query.trim()) q = q.ilike('name', `%${query.trim()}%`);
      const { data, error } = await q;
      if (error) return showError(error, 'Could not load exercises');
      setExercises(data);
    }, 250);
    return () => clearTimeout(timer); // cancel the previous delayed query
  }, [query, userId]);

  async function pick(exerciseId: string) {
    if (saving) return;
    setSaving(true);
    // next position = highest existing position + 1
    const { data: lastRow } = await supabase
      .from('plan_day_exercises')
      .select('position')
      .eq('plan_day_id', dayId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await supabase
      .from('plan_day_exercises')
      .insert({ plan_day_id: dayId, exercise_id: exerciseId, position: (lastRow?.position ?? -1) + 1 });
    setSaving(false);
    if (error) return showError(error, 'Could not add the exercise');
    router.back(); // the editor reloads itself thanks to useFocusEffect
  }

  async function addCustom() {
    if (!userId || !query.trim()) return;
    if (!customMuscle) return Alert.alert('Pick a muscle group', 'Choose which muscle group the exercise trains.');
    const { data, error } = await supabase
      .from('exercises')
      .insert({ name: query.trim(), muscle_group: customMuscle, created_by: userId })
      .select('id')
      .single();
    if (error) return showError(error, 'Could not create the exercise');
    pick(data.id);
  }

  // Offer a custom exercise right under the search box when the typed name is not in the list
  const name = query.trim();
  const exactMatch = exercises.some((e) => e.name.toLowerCase() === name.toLowerCase());
  const offerCustom = name.length >= 2 && !exactMatch;

  return (
    <FlatList
      style={{ backgroundColor: t.bg }}
      data={exercises}
      keyExtractor={(e) => e.id}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 20, gap: 8 }}
      ListHeaderComponent={
        <View style={{ gap: 8, marginBottom: 4 }}>
          <Input label="Search" value={query} onChangeText={setQuery} placeholder="Search or type a new exercise" />
          {offerCustom && (
            <Card style={{ borderWidth: 1, borderColor: t.line }}>
              <AppText>Add &quot;{name}&quot; as your own exercise</AppText>
              <AppText variant="small" muted>Only you will see it.</AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {MUSCLE_GROUPS.map((group) => {
                  const selected = customMuscle === group;
                  return (
                    <Pressable key={group} onPress={() => setCustomMuscle(group)}
                      accessibilityRole="radio" accessibilityState={{ selected }}
                      style={{ paddingHorizontal: 12, minHeight: 36, justifyContent: 'center', borderRadius: 999,
                        backgroundColor: selected ? t.accent : t.bg }}>
                      <AppText variant="small" style={{ color: selected ? t.onAccent : t.text }}>{group}</AppText>
                    </Pressable>
                  );
                })}
              </View>
              <Button title="Add exercise" variant="outline" onPress={addCustom} loading={saving}
                disabled={!customMuscle} />
            </Card>
          )}
        </View>
      }
      ListEmptyComponent={name ? <AppText muted>No exercises match &quot;{name}&quot;.</AppText> : undefined}
      renderItem={({ item }) => (
        <Pressable onPress={() => pick(item.id)} accessibilityRole="button"
          style={{ padding: 14, borderRadius: 12, backgroundColor: t.surface }}>
          <AppText>{item.name}</AppText>
          <AppText variant="small" muted>
            {item.muscle_group}{item.created_by ? ' · custom' : ''}
          </AppText>
        </Pressable>
      )}
      ListFooterComponent={
        name ? undefined : (
          <AppText variant="small" muted style={{ marginTop: 8 }}>
            Can&apos;t find an exercise? Type its name above to add your own.
          </AppText>
        )
      }
    />
  );
}
