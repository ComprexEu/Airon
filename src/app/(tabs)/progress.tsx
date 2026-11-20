import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { supabase } from '@/lib/supabase';
import {
  best1RMPerDay, bestSet, chartableExercises, ExerciseOption, isPlateau, LoggedSet, monthRange, monthShort,
  visibleOptions,
} from '@/logic/progress';
import { useTheme } from '@/theme/ThemeContext';

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

export default function ProgressScreen() {
  const t = useTheme();
  const [sessionsCount, setSessionsCount] = useState(0);
  const [options, setOptions] = useState<ExerciseOption[]>([]);
  const [selected, setSelected] = useState<ExerciseOption | null>(null);
  const [query, setQuery] = useState('');
  const [sets, setSets] = useState<LoggedSet[]>([]);
  const [volume, setVolume] = useState<{ group: string; perWeek: number }[]>([]);
  const [chartWidth, setChartWidth] = useState(0);

  // Summary: workout count, exercises worth a chart, weekly sets per muscle group
  async function loadSummary() {
    // Only sessions with at least one set: "Rested – next" also saves a session, but a rest day is not a workout
    const { count } = await supabase
      .from('workout_sessions')
      .select('id, workout_sets!inner(id)', { count: 'exact', head: true })
      .gte('started_at', daysAgo(90));
    setSessionsCount(count ?? 0);

    const { data } = await supabase
      .from('workout_sets')
      .select('exercise_id, weight, reps, created_at, exercises(name, muscle_group)')
      .order('created_at', { ascending: false })
      .limit(1000);
    const recent = data ?? [];

    // Every exercise the user has logged; the ones worth a chart go first
    const names = new Map<string, string>();
    for (const s of recent) {
      if (s.exercises && !names.has(s.exercise_id)) names.set(s.exercise_id, s.exercises.name);
    }
    const chartable = chartableExercises(recent);
    const list: ExerciseOption[] = [
      ...chartable.map((id) => ({ id, name: names.get(id) ?? '', chartable: true })),
      ...[...names].filter(([id]) => !chartable.includes(id)).map(([id, name]) => ({ id, name, chartable: false })),
    ];
    setOptions(list);
    // keep the current choice after a refresh; otherwise start with the first chartable exercise
    setSelected((cur) => list.find((o) => o.id === cur?.id) ?? list.find((o) => o.chartable) ?? list[0] ?? null);

    // Weekly sets per muscle group: sets from the last 28 days divided by 4
    const since = daysAgo(28);
    const counts = new Map<string, number>();
    for (const s of recent) {
      if (s.created_at < since || !s.exercises) continue;
      counts.set(s.exercises.muscle_group, (counts.get(s.exercises.muscle_group) ?? 0) + 1);
    }
    setVolume([...counts]
      .map(([group, c]) => ({ group, perWeek: Math.round(c / 4) }))
      .filter((v) => v.perWeek > 0)
      .sort((a, b) => b.perWeek - a.perWeek));
  }

  useFocusEffect(useCallback(() => { loadSummary(); }, []));

  // All sets of the selected exercise, oldest first
  useEffect(() => {
    if (!selected) return;
    supabase
      .from('workout_sets')
      .select('weight, reps, created_at')
      .eq('exercise_id', selected.id)
      .order('created_at')
      .then(({ data }) => setSets(data ?? []));
  }, [selected]);

  const points = best1RMPerDay(sets);
  const best = bestSet(sets);
  const plateau = isPlateau(points);
  const maxVolume = Math.max(1, ...volume.map((v) => v.perWeek));
  const chips = visibleOptions(options, query, selected?.id ?? null);
  const noMatch = query.trim() !== '' && !options.some((o) => o.name.toLowerCase().includes(query.trim().toLowerCase()));

  // The chart starts a bit below the lowest value, so the line uses the whole height
  const values = points.map((p) => p.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const base = Math.max(0, Math.floor(low - Math.max(high - low, 10) * 0.3));
  const chartData = points.map((p, i) => ({
    value: p.value - base,
    // month name only under the first point of each month
    label: i === 0 || monthShort(p.date) !== monthShort(points[i - 1].date) ? monthShort(p.date) : '',
  }));

  return (
    <Screen>
      <AppText variant="title">Progress</AppText>

      {/* Workout count */}
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <AppText variant="title" style={{ fontSize: 34 }}>{sessionsCount}</AppText>
        <AppText muted style={{ flex: 1 }}>workouts in the{'\n'}last 3 months</AppText>
      </Card>

      {options.length === 0 ? (
        <AppText muted>Log your first workout and your progress will show up here.</AppText>
      ) : (
        <>
          {/* Search: type any exercise you have logged */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 12,
            borderRadius: 12, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface }}>
            <Ionicons name="search" size={16} color={t.muted} />
            <TextInput value={query} onChangeText={setQuery} placeholder="Search your exercises"
              placeholderTextColor={t.muted} autoCorrect={false}
              style={{ flex: 1, color: t.text, fontFamily: 'Inter_400Regular', fontSize: 15 }} />
            {query !== '' && (
              <Pressable onPress={() => setQuery('')} hitSlop={10}>
                <Ionicons name="close-circle" size={16} color={t.muted} />
              </Pressable>
            )}
          </View>

          {/* Exercise chips */}
          {noMatch && <AppText variant="small" muted>No logged exercise matches &quot;{query.trim()}&quot;.</AppText>}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}
            keyboardShouldPersistTaps="handled">
            {chips.map((o) => {
              const on = o.id === selected?.id;
              return (
                <Pressable key={o.id} onPress={() => { setSelected(o); setQuery(''); }}
                  style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1,
                    borderColor: on ? t.accent : t.line, backgroundColor: on ? t.accent : 'transparent' }}>
                  <AppText variant="small" style={{ color: on ? t.onAccent : t.text, fontFamily: 'Inter_600SemiBold' }}>
                    {o.name}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Chart card */}
          <Card style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 4 }}>
                <AppText variant="title" style={{ fontSize: 26 }}>{best ? `${best.value} kg` : '–'}</AppText>
                <AppText variant="small" muted>
                  best estimated 1RM{best ? ` · best set ${best.weight} kg × ${best.reps}` : ''}
                </AppText>
              </View>
              <AppText variant="small" muted>{monthRange(points)}</AppText>
            </View>

            <View onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}>
              {selected && !selected.chartable ? (
                <AppText muted>
                  No 1RM chart for this exercise yet. It needs sets with weight and at most 12 reps on at least 2 days.
                </AppText>
              ) : points.length >= 2 && chartWidth > 0 ? (
                <LineChart
                  data={chartData}
                  width={chartWidth - 8}
                  height={150}
                  adjustToWidth
                  initialSpacing={4}
                  endSpacing={4}
                  areaChart
                  color={t.accent}
                  thickness={2}
                  startFillColor={t.accent}
                  endFillColor={t.accent}
                  startOpacity={0.25}
                  endOpacity={0}
                  dataPointsColor={t.accent}
                  dataPointsRadius={4}
                  hideRules
                  hideYAxisText
                  yAxisLabelWidth={0}
                  yAxisThickness={0}
                  xAxisColor={t.line}
                  xAxisLabelTextStyle={{ color: t.muted, fontSize: 11 }}
                  disableScroll
                />
              ) : (
                <AppText muted>At least two workouts are needed to draw a chart.</AppText>
              )}
            </View>

            {plateau && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10,
                borderTopWidth: 1, borderTopColor: t.line, paddingTop: 12 }}>
                <Ionicons name="warning-outline" size={18} color={t.muted} />
                <AppText variant="small" muted style={{ flex: 1 }}>No progress in the last 3 workouts.</AppText>
                <Pressable hitSlop={8} onPress={() => router.push({ pathname: '/agent',
                  params: { prompt: `I'm not making progress on ${selected?.name}. What should I change in my plan?` } })}>
                  <AppText variant="small" style={{ fontFamily: 'Inter_600SemiBold' }}>Ask the agent →</AppText>
                </Pressable>
              </View>
            )}
          </Card>
        </>
      )}

      {/* Weekly sets per muscle group */}
      {volume.length > 0 && (
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 }}>
            <AppText variant="heading">Weekly sets</AppText>
            <AppText variant="small" muted>average, last 4 weeks</AppText>
          </View>
          <Card style={{ gap: 14 }}>
            {volume.map((v) => (
              <View key={v.group} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <AppText variant="small" style={{ width: 72 }}>{v.group}</AppText>
                <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: t.line }}>
                  <View style={{ width: `${(v.perWeek / maxVolume) * 100}%`, height: 6, borderRadius: 3,
                    backgroundColor: t.accent }} />
                </View>
                <AppText variant="small" style={{ width: 24, textAlign: 'right', fontFamily: 'Inter_600SemiBold' }}>
                  {v.perWeek}
                </AppText>
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}
