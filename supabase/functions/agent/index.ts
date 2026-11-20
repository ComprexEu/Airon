// Airon agent: a chat with Gemini that can read the user's plans and workouts
// and save plan proposals. Runs with the user's token, so RLS still applies.
import '@supabase/functions-js/edge-runtime.d.ts';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Check the current Flash model name in Google AI Studio; it can be changed without
// redeploying: npx supabase secrets set GEMINI_MODEL=...
const MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.8-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const HISTORY_LIMIT = 20; // earlier messages sent to the model as context
const MAX_STEPS = 6; // model ↔ tools round trips per message

const SYSTEM_PROMPT = `You are the coach inside Airon, a workout planning and tracking app.
You help the user with their training plans, exercises and progress.

Rules:
- Answer in the language the user writes in. Be short and concrete.
- Write plain text: the app does not render Markdown. No **bold**, no # headings, no tables.
  For lists, start each line with "- ".
- Use the tools to look at the user's real data before giving advice about their plan or progress.
  Never invent workouts, weights or plans the user does not have.
- When the user asks for a plan or a change to a plan, ALWAYS call propose_plan.
  Do not only describe the plan in words. The user accepts or rejects the proposal in the app.
- Before propose_plan, call search_exercises and use only exercise ids it returned.
- To change an existing plan, pass its plan_id and the complete new list of days.
- A weekly plan gives every training day a day_of_week (1 = Monday … 7 = Sunday) and has no rest days.
  A rotation plan repeats its days in order and may include rest days (is_rest: true, no exercises).
- You are not a doctor. For pain or injuries, tell the user to see a professional.

Base your advice on these principles (they come from meta-analyses; do not cite any other sources):
- Training a muscle group twice a week usually gives better muscle growth than once a week (Schoenfeld et al., 2016).
- Growth increases with the number of sets; 10 or more weekly sets per muscle group give clearly more than fewer than 5 (Schoenfeld et al., 2017).
- A wide range of reps works for building muscle, as long as the set ends close to muscular failure.
- When progress stalls: change the rep range, add an accessory exercise or take a lighter week (deload).
If you are not sure, say so plainly. Do not cite studies outside this list.`;

const TOOLS = [{
  functionDeclarations: [
    {
      name: 'get_my_plans',
      description: "Returns the user's own plans with their days, exercises, sets and reps, and which plan is active.",
      parameters: { type: 'object', properties: {} },
    },
    {
      name: 'search_exercises',
      description: 'Searches the exercise library and the user\'s own exercises. Returns ids to use in propose_plan.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Part of the exercise name in English, e.g. "press". Optional.' },
          muscle_group: {
            type: 'string',
            description: 'One of: Chest, Back, Shoulders, Biceps, Triceps, Legs, Glutes, Calves, Core. Optional.',
          },
        },
      },
    },
    {
      name: 'get_recent_workouts',
      description: 'Returns the most recent logged workouts with the day name and every set (exercise, weight, reps).',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'integer', description: 'How many workouts, 1–20. Default 10.' } },
      },
    },
    {
      name: 'propose_plan',
      description: 'Saves a proposal of a new plan, or of a full replacement of an existing plan. The user accepts or rejects it in the app.',
      parameters: {
        type: 'object',
        properties: {
          plan_id: { type: 'string', description: 'Id of the user\'s plan to replace. Leave out for a new plan.' },
          name: { type: 'string' },
          schedule_type: { type: 'string', enum: ['weekly', 'rotation'] },
          summary: { type: 'string', description: 'One or two sentences on what the plan does or what changed.' },
          days: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                is_rest: { type: 'boolean' },
                day_of_week: { type: 'integer', description: '1 = Monday … 7 = Sunday. Weekly plans only.' },
                exercises: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      exercise_id: { type: 'string' },
                      sets: { type: 'integer' },
                      reps_min: { type: 'integer' },
                      reps_max: { type: 'integer' },
                      rest_seconds: { type: 'integer' },
                    },
                    required: ['exercise_id', 'sets', 'reps_min', 'reps_max'],
                  },
                },
              },
              required: ['name', 'is_rest'],
            },
          },
        },
        required: ['name', 'schedule_type', 'days'],
      },
    },
  ],
}];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Removes Markdown marks the model may still use: **bold**, __bold__, # headings. */
const plainText = (text: string) =>
  text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/^#{1,6}\s+/gm, '');

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

type Part = {
  text?: string;
  functionCall?: { id?: string; name: string; args?: Record<string, unknown> };
  functionResponse?: { id?: string; name: string; response: Record<string, unknown> };
  thoughtSignature?: string;
};
type Content = { role: 'user' | 'model'; parts: Part[] };

class GeminiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function callGemini(contents: Content[]): Promise<Content> {
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': Deno.env.get('GEMINI_API_KEY')! },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      tools: TOOLS,
    }),
  });
  if (!res.ok) {
    console.error('Gemini error', res.status, await res.text());
    throw new GeminiError(res.status, `Gemini returned ${res.status}`);
  }
  const data = await res.json();
  const content = data.candidates?.[0]?.content;
  if (!content?.parts) throw new GeminiError(502, 'Gemini returned no answer');
  return { role: 'model', parts: content.parts };
}

// ---------- Tools: every query runs with the user's token, so RLS applies ----------

async function runTool(
  db: SupabaseClient, userId: string, name: string, args: Record<string, unknown>,
  onProposal: (id: string) => void,
): Promise<unknown> {
  switch (name) {
    case 'get_my_plans': {
      const [{ data: plans, error }, { data: active }] = await Promise.all([
        db.from('plans')
          .select('id, name, schedule_type, plan_days(name, position, is_rest, day_of_week, plan_day_exercises(position, sets, reps_min, reps_max, exercises(id, name, muscle_group)))')
          .eq('owner_id', userId),
        db.from('user_active_plans').select('plan_id, started_on').maybeSingle(),
      ]);
      if (error) return { error: error.message };
      return { active_plan_id: active?.plan_id ?? null, plans };
    }

    case 'search_exercises': {
      let q = db.from('exercises')
        .select('id, name, muscle_group, equipment')
        .or(`created_by.is.null,created_by.eq.${userId}`)
        .order('name')
        .limit(40);
      if (typeof args.query === 'string' && args.query.trim()) q = q.ilike('name', `%${args.query.trim()}%`);
      if (typeof args.muscle_group === 'string' && args.muscle_group.trim()) q = q.ilike('muscle_group', args.muscle_group.trim());
      const { data, error } = await q;
      return error ? { error: error.message } : { exercises: data };
    }

    case 'get_recent_workouts': {
      const limit = Math.min(Math.max(Number(args.limit) || 10, 1), 20);
      const { data, error } = await db.from('workout_sessions')
        .select('started_at, day_name, workout_sets(set_number, reps, weight, exercises(name))')
        .order('started_at', { ascending: false })
        .limit(limit);
      return error ? { error: error.message } : { workouts: data };
    }

    case 'propose_plan': {
      const days = Array.isArray(args.days) ? args.days : [];
      // the model may invent ids: check them now, so the proposal can be applied later
      const ids = [...new Set(days.flatMap((d: { exercises?: { exercise_id: string }[] }) =>
        (d.exercises ?? []).map((e) => e.exercise_id)))];
      if (ids.length) {
        const { data: found } = await db.from('exercises').select('id').in('id', ids);
        const known = new Set((found ?? []).map((e) => e.id));
        const unknown = ids.filter((id) => !known.has(id));
        if (unknown.length) return { error: `Unknown exercise ids: ${unknown.join(', ')}. Use ids from search_exercises.` };
      }
      const planId = typeof args.plan_id === 'string' && args.plan_id ? args.plan_id : null;
      if (planId) {
        const { data: own } = await db.from('plans').select('id').eq('id', planId).eq('owner_id', userId).maybeSingle();
        if (!own) return { error: 'plan_id is not one of the user\'s plans. Leave it out to propose a new plan.' };
      }
      const { plan_id: _drop, ...proposedPlan } = args;
      const { data, error } = await db.from('plan_proposals')
        .insert({ user_id: userId, plan_id: planId, proposed_plan: proposedPlan })
        .select('id')
        .single();
      if (error) return { error: error.message };
      onProposal(data.id);
      return { ok: true, proposal_id: data.id, note: 'The user now sees the proposal with Accept and Reject buttons.' };
    }

    default:
      return { error: `Unknown tool ${name}` };
  }
}

// ---------- Request handler ----------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  // 1. Who is asking? Check the user's token
  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY') ?? req.headers.get('apikey') ?? '',
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  );
  const { data: { user } } = await db.auth.getUser();
  if (!user) return json({ error: 'Not signed in' }, 401);

  if (!Deno.env.get('GEMINI_API_KEY')) return json({ error: 'The agent is not set up yet (missing GEMINI_API_KEY).' }, 500);

  const body = await req.json().catch(() => null);
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  if (!message) return json({ error: 'The message is empty.' }, 400);
  if (message.length > 2000) return json({ error: 'The message is too long (max 2000 characters).' }, 400);

  const askedAt = new Date().toISOString(); // the user's message is saved with this time, before the answer

  // 2. Conversation so far (oldest first) + the new message
  // (role as a tie-breaker: older pairs were saved with the same time, the question goes before the answer)
  const { data: history } = await db.from('agent_messages')
    .select('role, content')
    .order('created_at', { ascending: false })
    .order('role', { ascending: true })
    .limit(HISTORY_LIMIT);
  const contents: Content[] = (history ?? []).reverse().map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  contents.push({ role: 'user', parts: [{ text: message }] });

  // 3. Let the model call tools until it gives a text answer
  const found: { proposalId: string | null } = { proposalId: null }; // set by propose_plan
  let reply = '';
  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const answer = await callGemini(contents);
      contents.push(answer); // unchanged, so thought signatures go back to Gemini as required

      const calls = answer.parts.filter((p) => p.functionCall);
      if (calls.length === 0) {
        reply = plainText(answer.parts.map((p) => p.text ?? '').join('')).trim();
        break;
      }
      const responses: Part[] = [];
      for (const { functionCall } of calls) {
        const result = await runTool(db, user.id, functionCall!.name, functionCall!.args ?? {}, (id) => { found.proposalId = id; });
        responses.push({ functionResponse: { id: functionCall!.id, name: functionCall!.name, response: { result } } });
      }
      contents.push({ role: 'user', parts: responses });
    }
  } catch (e) {
    // 429 = our Gemini limit, 503 = the model is overloaded at Google; both pass after a while
    if (e instanceof GeminiError && (e.status === 429 || e.status === 503)) {
      return json({ error: 'The agent is overloaded right now. Please try again in a minute.' }, 429);
    }
    console.error(e);
    return json({ error: 'The agent could not answer. Please try again.' }, 502);
  }
  if (!reply) reply = found.proposalId ? 'Here is my proposal.' : 'Sorry, I could not finish the answer. Please try again.';

  // 4. Save both messages; the answer carries the proposal id, so the app shows the card under it
  const { error } = await db.from('agent_messages').insert([
    { user_id: user.id, role: 'user', content: message, created_at: askedAt },
    { user_id: user.id, role: 'assistant', content: reply, proposal_id: found.proposalId, created_at: new Date().toISOString() },
  ]);
  if (error) return json({ error: error.message }, 500);

  return json({ reply, proposal_id: found.proposalId });
});
