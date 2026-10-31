alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.plans enable row level security;
alter table public.plan_days enable row level security;
alter table public.plan_day_exercises enable row level security;
alter table public.user_active_plans enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_sets enable row level security;

-- PROFILES: everyone sees and edits only their own
create policy "profiles: read own" on public.profiles
    for select to authenticated using (id = auth.uid());
create policy "profiles: update own" on public.profiles
    for update to authenticated using (id = auth.uid());

-- EXERCISES: built-in ones are visible to all, custom ones only to the author
create policy "exercises: read" on public.exercises
    for select to authenticated using (
        created_by is null
        or created_by = auth.uid()
        -- someone else's custom exercise is visible when it is used in a plan you can see
        or exists (select 1 from public.plan_day_exercises pde where pde.exercise_id = exercises.id)
    );
create policy "exercises: insert own" on public.exercises
    for insert to authenticated with check (created_by = auth.uid());
create policy "exercises: update own" on public.exercises
    for update to authenticated using (created_by = auth.uid());
create policy "exercises: delete own" on public.exercises
    for delete to authenticated using (created_by = auth.uid());

-- PLANS: own, public and featured are visible; only own can be changed
create policy "plans: read" on public.plans
    for select to authenticated
    using (owner_id = auth.uid() or visibility = 'public' or is_featured);
create policy "plans: insert" on public.plans
    for insert to authenticated with check (owner_id = auth.uid());
create policy "plans: update" on public.plans
    for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "plans: delete" on public.plans
    for delete to authenticated using (owner_id = auth.uid());

-- PLAN DAYS: inherit access from the plan
create policy "plan days: read" on public.plan_days
    for select to authenticated
    using (exists (select 1 from public.plans p where p.id = plan_id));
create policy "plan days: write" on public.plan_days
    for all to authenticated
    using (exists (select 1 from public.plans p where p.id = plan_id and p.owner_id = auth.uid()))
    with check (exists (select 1 from public.plans p where p.id = plan_id and p.owner_id = auth.uid()));

-- DAY EXERCISES: inherit access from the day, and so from the plan
create policy "day exercises: read" on public.plan_day_exercises
    for select to authenticated
    using (exists (select 1 from public.plan_days d where d.id = plan_day_id));
create policy "day exercises: write" on public.plan_day_exercises
    for all to authenticated
    using (exists (
        select 1 from public.plan_days d join public.plans p on p.id = d.plan_id
        where d.id = plan_day_id and p.owner_id = auth.uid()))
    with check (exists (
        select 1 from public.plan_days d join public.plans p on p.id = d.plan_id
        where d.id = plan_day_id and p.owner_id = auth.uid()));

-- PRIVATE DATA: active plan, workouts and sets - owner only
create policy "active plan: own" on public.user_active_plans
    for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "workouts: own" on public.workout_sessions
    for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "sets: own" on public.workout_sets
    for all to authenticated using (user_id = auth.uid())
    with check (
        user_id = auth.uid()
        -- the set must belong to your own workout
        and exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = auth.uid())
    );
