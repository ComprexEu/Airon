import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { showError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { AdvanceMode, getCurrentDay, ScheduleType } from '@/logic/rotation';
import { useTheme } from '@/theme/ThemeContext';
import { DayWithExercises, Plan, sortDays } from '@/types';

type SetEntry = { weight: string; reps: string; done: boolean };
type LastResult = { weight: number; reps: number };

// Typed sets are kept on the phone, so they survive the app being closed in the middle of a workout
const DRAFT_KEY = 'airon-workout-draft';
type Draft = { dayId: string; date: string; entries: Record<string, SetEntry[]> };

function isToday(iso: string) {
  return new Date(iso).toDateString() === new Date().toDateString();
}

export default function TodayScreen() {
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [day, setDay] = useState<DayWithExercises | null>(null);
  const [byCompletion, setByCompletion] = useState(true); // the cycle moves on after each logged workout
  const [doneToday, setDoneToday] = useState(false);
  const [last, setLast] = useState<Record<string, LastResult>>({});
  const [entries, setEntries] = useState<Record<string, SetEntry[]>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);

    // 1. Active plan with its days and exercises
    const { data: active, error } = await supabase
      .from('user_active_plans')
      .select('*, plans(*, plan_days(*, plan_day_exercises(*, exercises(id, name))))')
      .maybeSingle();
    if (error) {
      setLoading(false);
      return showError(error, 'Could not load your plan');
    }
    if (!active?.plans) {
      setPlan(null);
      setLoading(false);
      return;
    }
    const { plan_days, ...planRow } = active.plans;

    // 2. Last workout from this plan
    const { data: lastSession, error: sessionError } = await supabase
      .from('workout_sessions')
      .select('day_position, started_at')
      .eq('plan_id', planRow.id)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sessionError) {
      setLoading(false);
      return showError(sessionError, 'Could not load your history');
    }

    // 3. Which day is today
    const scheduleType = planRow.schedule_type as ScheduleType;
    const advanceMode = active.advance_mode as AdvanceMode;
    const current = getCurrentDay({
      scheduleType,
      days: sortDays(plan_days),
      advanceMode,
      startedOn: active.started_on,
      lastDayPosition: lastSession?.day_position ?? null,
      today: new Date(),
    });

    // 4. Last results for today's exercises (one query for all of them, the newest set wins)
    const exerciseIds = current?.plan_day_exercises.map((e) => e.exercise_id) ?? [];
    const lastByExercise: Record<string, LastResult> = {};
    if (exerciseIds.length) {
      const { data: sets, error: setsError } = await supabase
        .from('workout_sets')
        .select('exercise_id, weight, reps, created_at')
        .in('exercise_id', exerciseIds)
        .order('created_at', { ascending: false })
        .order('set_number', { ascending: false })
        .limit(200);
      if (setsError) {
        setLoading(false);
        return showError(setsError, 'Could not load your last results');
      }
      for (const s of sets) {
        if (!lastByExercise[s.exercise_id]) lastByExercise[s.exercise_id] = { weight: s.weight, reps: s.reps };
      }
    }

    // 5. Set fields prefilled with the last result
    const initial: Record<string, SetEntry[]> = {};
    for (const row of current?.plan_day_exercises ?? []) {
      const prev = lastByExercise[row.exercise_id];
      initial[row.id] = Array.from({ length: row.sets }, () => ({
        weight: prev ? String(prev.weight) : '',
        reps: prev ? String(prev.reps) : '',
        done: false,
      }));
    }

    // 6. A draft of the same plan day from today wins over the prefilled values
    //    (only for exercises whose number of sets did not change in the meantime)
    const draft: Draft | null = await AsyncStorage.getItem(DRAFT_KEY)
      .then((raw) => (raw ? JSON.parse(raw) : null))
      .catch(() => null);
    if (draft && current && draft.dayId === current.id && draft.date === new Date().toDateString()) {
      for (const [rowId, sets] of Object.entries(initial)) {
        if (draft.entries[rowId]?.length === sets.length) initial[rowId] = draft.entries[rowId];
      }
    }

    setPlan(planRow);
    setDay(current);
    setByCompletion(scheduleType === 'rotation' && advanceMode === 'completion');
    setDoneToday(!!lastSession && isToday(lastSession.started_at));
    setLast(lastByExercise);
    setEntries(initial);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Save a draft after every set change
  useEffect(() => {
    if (!day || Object.keys(entries).length === 0) return;
    const draft: Draft = { dayId: day.id, date: new Date().toDateString(), entries };
    AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft)).catch(() => {});
  }, [day, entries]);

  // Change one field of one set – always create NEW objects, never mutate the old ones
  function updateSet(rowId: string, index: number, changes: Partial<SetEntry>) {
    setEntries((prev) => ({
      ...prev,
      [rowId]: prev[rowId].map((s, i) => (i === index ? { ...s, ...changes } : s)),
    }));
  }

  async function saveSession(withSets: boolean) {
    if (!plan || !day || saving) return;
    setSaving(true);

    const { data: session, error } = await supabase
      .from('workout_sessions')
      .insert({
        plan_id: plan.id,
        plan_day_id: day.id,
        day_position: day.position,
        day_name: day.name,
        finished_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (error) {
      setSaving(false);
      return showError(error, 'Could not save the workout'); // the data stays on screen (NF-05)
    }

    if (withSets) {
      const rows = day.plan_day_exercises.flatMap((ex) =>
        (entries[ex.id] ?? [])
          .map((s, i) => ({ s, i }))
          .filter(({ s }) => s.done)
          .map(({ s, i }) => ({
            session_id: session.id,
            exercise_id: ex.exercise_id,
            set_number: i + 1,
            weight: Number(s.weight.replace(',', '.')) || 0, // a Polish keyboard types 82,5
            reps: parseInt(s.reps, 10) || 0,
          })),
      );
      const { error: setsError } = await supabase.from('workout_sets').insert(rows);
      if (setsError) {
        // without its sets the session would move the cycle on, so remove it and keep the data on screen
        await supabase.from('workout_sessions').delete().eq('id', session.id);
        setSaving(false);
        return showError(setsError, 'Could not save the sets');
      }
    }

    await AsyncStorage.removeItem(DRAFT_KEY).catch(() => {}); // saved for real, the draft is no longer needed
    setSaving(false);
    load(); // the cycle moves on to the next day
  }

  function finishWorkout() {
    const done = Object.values(entries).flat().filter((s) => s.done);
    if (done.length === 0) return Alert.alert('No sets', 'Tick at least one completed set.');
    // weight may be 0 (bodyweight exercises), reps may not
    if (done.some((s) => !(parseInt(s.reps, 10) > 0))) {
      return Alert.alert('Missing reps', 'Enter the number of reps for every ticked set.');
    }
    saveSession(true);
  }

  // ---------- Views ----------

  if (loading) return <Screen><AppText muted>Loading…</AppText></Screen>;

  if (!plan) {
    return (
      <Screen>
        <AppText variant="title">Today</AppText>
        <AppText muted>You have no active plan. Pick a plan and set it as active.</AppText>
        <Button title="Go to plans" onPress={() => router.push('/plans')} />
      </Screen>
    );
  }

  if (!day) {
    return (
      <Screen>
        <AppText variant="small" muted>{plan.name}</AppText>
        <AppText variant="title">Day off</AppText>
        <AppText muted>There is no workout in &quot;{plan.name}&quot; today.</AppText>
      </Screen>
    );
  }

  // A weekly or calendar plan shows the same day again after logging it, so there is nothing more to do today
  if (doneToday && !byCompletion) {
    return (
      <Screen>
        <AppText variant="small" muted>{plan.name}</AppText>
        <AppText variant="title">{day.name}</AppText>
        <Card>
          <AppText variant="heading">Workout logged</AppText>
          <AppText muted>Today&apos;s workout is saved. See you next time.</AppText>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppText variant="small" muted>{plan.name}</AppText>
      <AppText variant="title">{day.name}</AppText>

      {doneToday && (
        <Card><AppText>Today&apos;s workout is already logged. Below is the next day of the plan.</AppText></Card>
      )}

      {day.is_rest ? (
        <Card>
          <AppText variant="heading">Rest day</AppText>
          <AppText muted>Recovery is part of the plan too.</AppText>
          <Button title="Rested – next" onPress={() => saveSession(false)} loading={saving} />
        </Card>
      ) : (
        <>
          {day.plan_day_exercises.length === 0 && (
            <AppText muted>This day has no exercises yet. Add them in the plan editor.</AppText>
          )}
          {day.plan_day_exercises.map((ex) => {
            const prev = last[ex.exercise_id];
            return (
              <Card key={ex.id}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <AppText variant="heading" style={{ flex: 1 }}>{ex.exercises?.name ?? 'Unknown exercise'}</AppText>
                  <AppText muted>{ex.sets} × {ex.reps_min}–{ex.reps_max}</AppText>
                </View>
                <AppText variant="small" muted>
                  {prev ? `Last time: ${prev.weight} kg × ${prev.reps}` : 'First time – enter a weight'}
                </AppText>
                {entries[ex.id]?.map((s, i) => (
                  <SetRow key={i} index={i} entry={s} onChange={(c) => updateSet(ex.id, i, c)} />
                ))}
              </Card>
            );
          })}
          {day.plan_day_exercises.length > 0 && (
            <Button title="Finish workout" onPress={finishWorkout} loading={saving} />
          )}
        </>
      )}
    </Screen>
  );
}

// ---------- One set row ----------

function SetRow({ index, entry, onChange }: {
  index: number; entry: SetEntry; onChange: (c: Partial<SetEntry>) => void;
}) {
  const t = useTheme();
  const inputStyle = {
    width: 64, height: 40, borderRadius: 10, borderWidth: 1, borderColor: t.line,
    color: t.text, textAlign: 'center' as const, fontFamily: 'Inter_400Regular', fontSize: 15,
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <AppText muted style={{ width: 20 }}>{index + 1}</AppText>
      <TextInput style={inputStyle} value={entry.weight} keyboardType="decimal-pad"
        placeholder="kg" placeholderTextColor={t.muted} accessibilityLabel={`Set ${index + 1} weight`}
        onChangeText={(v) => onChange({ weight: v })} />
      <AppText muted>×</AppText>
      <TextInput style={inputStyle} value={entry.reps} keyboardType="number-pad"
        placeholder="reps" placeholderTextColor={t.muted} accessibilityLabel={`Set ${index + 1} reps`}
        onChangeText={(v) => onChange({ reps: v })} />
      <View style={{ flex: 1 }} />
      <Pressable
        onPress={() => onChange({ done: !entry.done })}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: entry.done }}
        accessibilityLabel={`Set ${index + 1} done`}
        style={{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
          backgroundColor: entry.done ? t.accent : 'transparent', borderWidth: entry.done ? 0 : 1, borderColor: t.line }}>
        <Ionicons name="checkmark" size={22} color={entry.done ? t.onAccent : t.muted} />
      </Pressable>
    </View>
  );
}
