import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, Switch, TextInput, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/context/AuthContext';
import { showError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { assignWeekdays } from '@/logic/weekdays';
import { useTheme } from '@/theme/ThemeContext';
import { DayWithExercises, Plan, PLAN_WITH_DAYS, PlanDay, PlanDayExercise, sortDays } from '@/types';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; // index + 1 = day_of_week

/** Today as 'YYYY-MM-DD' in the phone's time zone (toISOString() would give the UTC date, a day off after midnight). */
function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function PlanEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const t = useTheme();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [days, setDays] = useState<DayWithExercises[]>([]);
  const [name, setName] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('plans').select(PLAN_WITH_DAYS).eq('id', id).single();
    if (error) return showError(error, 'Could not load the plan');
    const { plan_days, ...planRow } = data;
    setPlan(planRow);
    setName(planRow.name);
    setDays(sortDays(plan_days));
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // One function to save changes to the plan
  async function updatePlan(changes: Partial<Plan>) {
    const { error } = await supabase.from('plans').update(changes).eq('id', id);
    if (error) showError(error, 'Could not save');
    load();
  }

  // Both types use the same days. Switching to weekly gives every training day a weekday first.
  async function changeType(type: 'weekly' | 'rotation') {
    if (!plan || plan.schedule_type === type) return;
    if (type === 'weekly') {
      for (const change of assignWeekdays(days)) {
        const { error } = await supabase.from('plan_days').update({ day_of_week: change.day_of_week }).eq('id', change.id);
        if (error) return showError(error, 'Could not switch');
      }
    }
    updatePlan({ schedule_type: type });
  }

  async function addDay(isRest: boolean) {
    // In a weekly plan a new day gets the first free weekday right away
    let dayOfWeek: number | null = null;
    if (plan?.schedule_type === 'weekly') {
      const taken = days.filter((d) => !d.is_rest).map((d) => d.day_of_week);
      dayOfWeek = [1, 2, 3, 4, 5, 6, 7].find((d) => !taken.includes(d)) ?? null;
      if (dayOfWeek === null) return Alert.alert('Week is full', 'Every day of the week already has a workout.');
    }
    const nextPosition = days.length ? Math.max(...days.map((d) => d.position)) + 1 : 0;
    const { error } = await supabase.from('plan_days').insert({
      plan_id: id,
      position: nextPosition,
      name: isRest ? 'Rest' : `Day ${days.filter((d) => !d.is_rest).length + 1}`,
      is_rest: isRest,
      day_of_week: dayOfWeek,
    });
    if (error) showError(error, 'Could not add the day');
    load();
  }

  async function setActive() {
    if (!userId) return;
    // upsert = insert, or update when the user already has an active plan (user_id is the key)
    const { error } = await supabase
      .from('user_active_plans')
      .upsert({ user_id: userId, plan_id: id, started_on: todayLocal() });
    if (error) return showError(error, 'Could not set the active plan');
    Alert.alert('Done', 'This is now your active plan.');
  }

  function deletePlan() {
    Alert.alert('Delete this plan?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('plans').delete().eq('id', id);
          if (error) return showError(error, 'Could not delete the plan');
          router.back();
        },
      },
    ]);
  }

  if (!plan) return null;
  const weekly = plan.schedule_type === 'weekly';
  // Both types use the same days, only the view changes, so switching back and forth loses nothing.
  // Weekdays chosen in a weekly plan are remembered while the plan is a rotation.
  // Weekly: rest days are hidden (every weekday without a workout is rest), order Mon → Sun.
  // Rotation: all days in cycle order, weekdays are ignored.
  const hiddenRestDays = weekly ? days.filter((d) => d.is_rest).length : 0;
  const shownDays = weekly
    ? days.filter((d) => !d.is_rest).sort((a, b) => (a.day_of_week ?? 8) - (b.day_of_week ?? 8))
    : days;

  if (plan.owner_id !== userId) {
    return (
      <Screen>
        <AppText variant="heading">{plan.name}</AppText>
        <AppText muted>This plan belongs to someone else. Copy it in Explore to edit it.</AppText>
      </Screen>
    );
  }

  return (
    <Screen>
      <Input label="Plan name" value={name} onChangeText={setName}
        onEndEditing={() => name.trim() && name.trim() !== plan.name && updatePlan({ name: name.trim() })} />

      {/* Plan type toggle */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['rotation', 'weekly'] as const).map((type) => {
          const selected = plan.schedule_type === type;
          return (
            <Pressable key={type} onPress={() => changeType(type)}
              accessibilityRole="radio" accessibilityState={{ selected }}
              style={{ flex: 1, minHeight: 44, padding: 12, borderRadius: 12, alignItems: 'center',
                backgroundColor: selected ? t.accent : t.surface }}>
              <AppText style={{ color: selected ? t.onAccent : t.text }}>
                {type === 'rotation' ? 'Rotation' : 'Weekly'}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <AppText variant="small" muted>
        {weekly
          ? 'Each workout is on a fixed weekday. Days without a workout are rest days.'
          : 'Days repeat in a loop in this order, whatever the weekday. Add rest days where you need them.'}
      </AppText>

      {shownDays.length === 0 && (
        <AppText muted>No days yet. Add a training day, then add exercises to it.</AppText>
      )}
      {hiddenRestDays > 0 && (
        <AppText variant="small" muted>
          {hiddenRestDays} rest day(s) hidden – they come back when you switch to Rotation.
        </AppText>
      )}

      {shownDays.map((day) => (
        <DayCard key={day.id} day={day} weekly={weekly} onChange={load}
          takenWeekdays={shownDays.filter((d) => d.id !== day.id).map((d) => d.day_of_week)} />
      ))}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Button title="+ Training day" variant="outline" onPress={() => addDay(false)} /></View>
        {!weekly && (
          <View style={{ flex: 1 }}><Button title="+ Rest day" variant="outline" onPress={() => addDay(true)} /></View>
        )}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <AppText>Public plan</AppText>
        <Switch value={plan.visibility === 'public'} accessibilityLabel="Public plan"
          onValueChange={(on) => updatePlan({ visibility: on ? 'public' : 'private' })} />
      </View>

      <Button title="Set as active" onPress={setActive} />
      <Button title="Delete plan" variant="outline" onPress={deletePlan} />
    </Screen>
  );
}

// ---------- One day card ----------

function DayCard({ day, weekly, takenWeekdays, onChange }: {
  day: DayWithExercises; weekly: boolean; takenWeekdays: (number | null)[]; onChange: () => void;
}) {
  const t = useTheme();

  async function updateDay(changes: Partial<PlanDay>) {
    const { error } = await supabase.from('plan_days').update(changes).eq('id', day.id);
    if (error) showError(error, 'Could not save'); // e.g. two days on the same weekday
    onChange();
  }

  function removeDay() {
    Alert.alert(`Remove "${day.name}"?`, 'Its exercises will be removed too.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('plan_days').delete().eq('id', day.id); // exercises go by cascade
          if (error) showError(error, 'Could not remove the day');
          onChange();
        },
      },
    ]);
  }

  async function updateExercise(rowId: string, changes: Partial<PlanDayExercise>) {
    const { error } = await supabase.from('plan_day_exercises').update(changes).eq('id', rowId);
    if (error) showError(error, 'Could not save'); // e.g. max reps lower than min reps
    onChange();
    return !error;
  }

  async function removeExercise(rowId: string) {
    const { error } = await supabase.from('plan_day_exercises').delete().eq('id', rowId);
    if (error) showError(error, 'Could not remove the exercise');
    onChange();
  }

  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <TextInput defaultValue={day.name} accessibilityLabel="Day name"
          onEndEditing={(e) => {
            const text = e.nativeEvent.text.trim();
            if (text && text !== day.name) updateDay({ name: text });
          }}
          style={{ color: t.text, fontFamily: 'Inter_600SemiBold', fontSize: 18, flex: 1, minHeight: 44 }} />
        <Pressable onPress={removeDay} hitSlop={10} accessibilityRole="button">
          <AppText muted>Remove</AppText>
        </Pressable>
      </View>

      {weekly && (
        <>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {WEEKDAYS.map((label, i) => {
              const weekday = i + 1;
              const selected = day.day_of_week === weekday;
              const taken = takenWeekdays.includes(weekday); // another day of this plan is on this weekday
              return (
                <Pressable key={label} disabled={taken || selected}
                  onPress={() => updateDay({ day_of_week: weekday })}
                  accessibilityRole="radio" accessibilityState={{ selected, disabled: taken }}
                  style={{ flex: 1, minHeight: 40, justifyContent: 'center', borderRadius: 8, alignItems: 'center',
                    backgroundColor: selected ? t.accent : t.bg, opacity: taken ? 0.35 : 1 }}>
                  <AppText variant="small" style={{ color: selected ? t.onAccent : t.text }}>{label}</AppText>
                </Pressable>
              );
            })}
          </View>
          {day.day_of_week === null && (
            // only possible with more than 7 training days
            <AppText variant="small" muted>No free weekday – this workout won&apos;t show up on Today.</AppText>
          )}
        </>
      )}

      {day.is_rest ? (
        <AppText muted>Rest day</AppText>
      ) : (
        <>
          {day.plan_day_exercises.map((row) => (
            <View key={row.id} style={{ gap: 6, paddingVertical: 6, borderTopWidth: 1, borderTopColor: t.line }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <AppText style={{ flex: 1 }}>{row.exercises?.name ?? 'Unknown exercise'}</AppText>
                <Pressable onPress={() => removeExercise(row.id)} hitSlop={10}
                  accessibilityRole="button" accessibilityLabel={`Remove ${row.exercises?.name ?? 'exercise'}`}>
                  <Ionicons name="close" size={20} color={t.muted} />
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <NumberField label="Sets" value={row.sets} onSave={(v) => updateExercise(row.id, { sets: v })} />
                <AppText muted>sets ×</AppText>
                <NumberField label="Min reps" value={row.reps_min} onSave={(v) => updateExercise(row.id, { reps_min: v })} />
                <AppText muted>–</AppText>
                <NumberField label="Max reps" value={row.reps_max} onSave={(v) => updateExercise(row.id, { reps_max: v })} />
                <AppText muted>reps</AppText>
              </View>
            </View>
          ))}
          <Button title="+ Add exercise" variant="outline"
            onPress={() => router.push({ pathname: '/exercise-picker', params: { dayId: day.id } })} />
        </>
      )}
    </Card>
  );
}

// Small number field. Keeps its own text while typing and saves when editing ends.
// When the save fails (e.g. max reps lower than min reps) it goes back to the value from the database.
function NumberField({ label, value, onSave }: { label: string; value: number; onSave: (v: number) => Promise<boolean> }) {
  const t = useTheme();
  const [text, setText] = useState(String(value));
  const [shown, setShown] = useState(value);
  if (value !== shown) {
    // the value in the database changed: update the field during render (no useEffect needed)
    setShown(value);
    setText(String(value));
  }

  async function commit() {
    const n = parseInt(text, 10);
    if (!(n > 0)) return setText(String(value));
    if (n !== value && !(await onSave(n))) setText(String(value));
  }

  return (
    <TextInput value={text} onChangeText={setText} onEndEditing={commit}
      keyboardType="number-pad" selectTextOnFocus accessibilityLabel={label}
      style={{ width: 48, height: 40, borderRadius: 8, borderWidth: 1, borderColor: t.line,
        color: t.text, textAlign: 'center', fontFamily: 'Inter_400Regular' }} />
  );
}
