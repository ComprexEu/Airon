-- Applies a plan proposed by the agent in one transaction: creates a new plan,
-- or replaces the days of an existing one. If anything fails (e.g. an unknown
-- exercise id), everything is rolled back and the old plan stays untouched.
create function public.apply_proposal(proposal_id uuid)
returns uuid
language plpgsql
security invoker -- runs with the user's rights, so RLS still applies
set search_path = ''
as $$
declare
    prop public.plan_proposals%rowtype;
    target_plan uuid;
    d jsonb;
    e jsonb;
    new_day uuid;
    day_pos int := 0;
    ex_pos int;
begin
    select * into prop from public.plan_proposals p
    where p.id = proposal_id and p.status = 'pending';
    if not found then
        raise exception 'Proposal not found or already handled';
    end if;

    if prop.plan_id is null then
        insert into public.plans (owner_id, name, schedule_type)
        values (auth.uid(), prop.proposed_plan ->> 'name', prop.proposed_plan ->> 'schedule_type')
        returning id into target_plan;
    else
        target_plan := prop.plan_id;
        update public.plans
        set name = coalesce(prop.proposed_plan ->> 'name', name),
            schedule_type = coalesce(prop.proposed_plan ->> 'schedule_type', schedule_type)
        where id = target_plan and owner_id = auth.uid();
        if not found then
            raise exception 'You do not have access to this plan';
        end if;
        delete from public.plan_days where plan_id = target_plan; -- exercises are removed by cascade
    end if;

    for d in select * from jsonb_array_elements(prop.proposed_plan -> 'days') loop
        insert into public.plan_days (plan_id, position, name, is_rest, day_of_week)
        values (
            target_plan, day_pos, d ->> 'name',
            coalesce((d ->> 'is_rest')::boolean, false),
            (d ->> 'day_of_week')::smallint
        )
        returning id into new_day;

        ex_pos := 0;
        for e in select * from jsonb_array_elements(coalesce(d -> 'exercises', '[]'::jsonb)) loop
            insert into public.plan_day_exercises (plan_day_id, exercise_id, position, sets, reps_min, reps_max, rest_seconds)
            values (
                new_day, (e ->> 'exercise_id')::uuid, ex_pos,
                coalesce((e ->> 'sets')::int, 3),
                coalesce((e ->> 'reps_min')::int, 8),
                coalesce((e ->> 'reps_max')::int, 12),
                coalesce((e ->> 'rest_seconds')::int, 120)
            );
            ex_pos := ex_pos + 1;
        end loop;
        day_pos := day_pos + 1;
    end loop;

    update public.plan_proposals set status = 'accepted' where id = proposal_id;

    return target_plan;
end;
$$;
