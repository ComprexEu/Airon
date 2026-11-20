import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { showError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeContext';
import { AppText } from './AppText';
import { Button } from './Button';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; // index + 1 = day_of_week

// The shape the agent saves with propose_plan. It comes from an AI model, so any field may be missing.
type ProposedExercise = { exercise_id: string; sets?: number; reps_min?: number; reps_max?: number };
type ProposedDay = { name?: string; is_rest?: boolean; day_of_week?: number; exercises?: ProposedExercise[] };
type ProposedPlan = { name?: string; schedule_type?: 'weekly' | 'rotation'; summary?: string; days?: ProposedDay[] };

/** Preview of a plan proposed by the agent, with Accept and Reject. The plan changes only after Accept. */
export function ProposalCard({ proposalId }: { proposalId: string }) {
  const t = useTheme();
  const [plan, setPlan] = useState<ProposedPlan | null>(null);
  const [status, setStatus] = useState('pending');
  const [isChange, setIsChange] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<'accept' | 'reject' | null>(null);

  // The card loads its own data, the chat only passes the id
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('plan_proposals').select('*').eq('id', proposalId).single();
      if (error) return; // e.g. the proposal was removed: show nothing under the message
      const p = data.proposed_plan as unknown as ProposedPlan; // jsonb has a generic type in the generated types
      setPlan(p);
      setStatus(data.status);
      setIsChange(!!data.plan_id);

      // exercise names for the preview (the proposal only holds their ids)
      const ids = (p.days ?? []).flatMap((d) => d.exercises?.map((e) => e.exercise_id) ?? []);
      if (ids.length) {
        const { data: ex } = await supabase.from('exercises').select('id, name').in('id', ids);
        setNames(Object.fromEntries((ex ?? []).map((e) => [e.id, e.name])));
      }
    })();
  }, [proposalId]);

  async function accept() {
    setBusy('accept');
    const { data: planId, error } = await supabase.rpc('apply_proposal', { proposal_id: proposalId });
    setBusy(null);
    if (error) return showError(error, 'Could not apply the proposal');
    setStatus('accepted');
    router.push(`/plan/${planId}`); // show the new or updated plan right away
  }

  async function reject() {
    setBusy('reject');
    const { error } = await supabase.from('plan_proposals').update({ status: 'rejected' }).eq('id', proposalId);
    setBusy(null);
    if (error) return showError(error, 'Could not reject the proposal');
    setStatus('rejected');
  }

  if (!plan) return null;
  const weekly = plan.schedule_type === 'weekly';

  return (
    <View style={{ padding: 14, gap: 10, borderRadius: 16, borderWidth: 1.5, borderColor: t.accent, backgroundColor: t.surface }}>
      <View style={{ gap: 4 }}>
        <AppText variant="small" style={{ color: t.accent, fontFamily: 'Inter_600SemiBold' }}>
          {isChange ? 'PROPOSED CHANGES' : 'NEW PLAN'} · {weekly ? 'Weekly' : 'Rotation'}
        </AppText>
        <AppText variant="heading">{plan.name ?? 'Plan'}</AppText>
        {plan.summary ? <AppText muted>{plan.summary}</AppText> : null}
      </View>

      {(plan.days ?? []).map((d, i) => (
        <View key={i} style={{ gap: 2 }}>
          <AppText style={{ fontFamily: 'Inter_600SemiBold' }}>
            {weekly && d.day_of_week ? `${WEEKDAYS[d.day_of_week - 1]} · ` : ''}{d.name ?? `Day ${i + 1}`}
          </AppText>
          {d.is_rest ? (
            <AppText variant="small" muted>Rest</AppText>
          ) : (
            (d.exercises ?? []).map((e, j) => (
              <AppText key={j} variant="small" muted>
                {names[e.exercise_id] ?? '…'} · {e.sets ?? 3} × {e.reps_min ?? 8}–{e.reps_max ?? 12}
              </AppText>
            ))
          )}
        </View>
      ))}

      {status === 'pending' ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button title="Reject" variant="outline" onPress={reject} loading={busy === 'reject'} disabled={busy !== null} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Accept" onPress={accept} loading={busy === 'accept'} disabled={busy !== null} />
          </View>
        </View>
      ) : (
        <AppText variant="small" muted>{status === 'accepted' ? 'Accepted' : 'Rejected'}</AppText>
      )}
    </View>
  );
}
