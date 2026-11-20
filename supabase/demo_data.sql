-- supabase/demo_data.sql – workout history for the demo account (run in the SQL Editor)
-- Before running: sign up in the app with the e-mail below, copy the featured
-- "Upper/Lower Rotation" plan in Explore and set the copy as active.
-- The script first deletes the demo account's earlier workouts, so it can be run again.
do $$
declare
    v_email text := 'demo@airon.app';  -- ← demo account e-mail
    v_user uuid;
    v_plan uuid;
    v_days uuid[];
    v_session uuid;
    v_day_index int;
    v_date timestamptz;
    ex record;
    i int;
    s int;
    k int;          -- per-exercise offset, so the lines do not all look alike
    v_base numeric; -- starting weight
    v_step numeric; -- weight added every second workout of this exercise
    w numeric;
    r int;
begin
    select id into v_user from auth.users where email = v_email;
    if v_user is null then raise exception 'No user with e-mail %', v_email; end if;

    select plan_id into v_plan from public.user_active_plans where user_id = v_user;
    if v_plan is null then raise exception 'The demo account has no active plan'; end if;

    -- start over: sets are removed together with their sessions (on delete cascade)
    delete from public.workout_sessions where user_id = v_user;

    -- training days only, in cycle order
    select array_agg(id order by position) into v_days
    from public.plan_days where plan_id = v_plan and not is_rest;

    -- 24 workouts every 2–3 days, ending yesterday
    for i in 0..23 loop
        v_day_index := (i % array_length(v_days, 1)) + 1; -- SQL arrays start at 1
        v_date := now() - interval '1 day' - ((23 - i) * interval '2.5 days');

        insert into public.workout_sessions (user_id, plan_id, plan_day_id, day_position, day_name, started_at, finished_at)
        select v_user, v_plan, d.id, d.position, d.name, v_date, v_date + interval '1 hour'
        from public.plan_days d where d.id = v_days[v_day_index]
        returning id into v_session;

        for ex in
            select pde.exercise_id, pde.sets, e.name
            from public.plan_day_exercises pde join public.exercises e on e.id = pde.exercise_id
            where pde.plan_day_id = v_days[v_day_index]
        loop
            -- realistic starting weights and progress per exercise (kg)
            select b, st into v_base, v_step from (values
                ('Back Squat', 70, 2.5), ('Romanian Deadlift', 60, 2.5), ('Leg Press', 120, 5),
                ('Leg Curl', 35, 1.25), ('Standing Calf Raise', 60, 2.5), ('Barbell Row', 50, 2.5),
                ('Lat Pulldown', 45, 2.5), ('Dumbbell Shoulder Press', 16, 1), ('Dumbbell Curl', 10, 0.5),
                ('Triceps Pushdown', 20, 1.25), ('One-arm Dumbbell Row', 22, 1)
            ) as t(n, b, st) where n = ex.name;
            if v_base is null then v_base := 20; v_step := 1.25; end if;
            k := length(ex.name) % 4;

            if ex.name = 'Barbell Bench Press' then
                -- bench press goes up to 80 kg and then stalls (plateau in the last weeks)
                w := least(60 + (i / 2) * 2.5, 80);
            elsif ex.name = 'Plank' then
                w := 0; -- bodyweight: no 1RM chart for it
            else
                -- slow progress with a lighter week now and then
                w := v_base + (i / 2) * v_step - case when (i / 2 + k) % 4 = 3 then 2 * v_step else 0 end;
            end if;

            for s in 1..ex.sets loop
                -- reps change a little between workouts and drop in the last sets
                r := case when ex.name = 'Barbell Bench Press' then 8 - (s / 3)
                          else 10 - (s / 2) - ((i / 2 + k) % 3) end;
                insert into public.workout_sets (session_id, user_id, exercise_id, set_number, weight, reps, created_at)
                values (v_session, v_user, ex.exercise_id, s, w, r, v_date + s * interval '3 minutes');
            end loop;
            v_base := null;
        end loop;
    end loop;
end $$;
