-- Copies a plan with its days and exercises in one transaction:
-- either the whole copy is created, or nothing changes
create function public.copy_plan(source_plan_id uuid)
returns uuid
language plpgsql
security invoker -- runs with the user's rights, so RLS still applies
set search_path = ''
as $$
declare
    new_plan_id uuid;
    old_day record;
    new_day_id uuid;
begin
    -- copy the plan itself: the signed-in user becomes the owner, the plan is private
    insert into public.plans (owner_id, name, description, goal, level, schedule_type, copied_from)
    select auth.uid(), p.name, p.description, p.goal, p.level, p.schedule_type, p.id
    from public.plans p
    where p.id = source_plan_id
    returning id into new_plan_id;

    if new_plan_id is null then
        raise exception 'Plan not found or access denied';
    end if;

    -- copy the days and the exercises in each day
    for old_day in
        select * from public.plan_days where plan_id = source_plan_id order by position
    loop
        insert into public.plan_days (plan_id, position, name, is_rest, day_of_week)
        values (new_plan_id, old_day.position, old_day.name, old_day.is_rest, old_day.day_of_week)
        returning id into new_day_id;

        insert into public.plan_day_exercises (plan_day_id, exercise_id, position, sets, reps_min, reps_max, rest_seconds)
        select new_day_id, e.exercise_id, e.position, e.sets, e.reps_min, e.reps_max, e.rest_seconds
        from public.plan_day_exercises e
        where e.plan_day_id = old_day.id;
    end loop;

    return new_plan_id;
end;
$$;
