-- supabase/seed.sql

insert into public.exercises (name, muscle_group, equipment) values
    ('Barbell Bench Press', 'Chest', 'Barbell'),
    ('Incline Dumbbell Press', 'Chest', 'Dumbbells'),
    ('Cable Fly', 'Chest', 'Cable'),
    ('Dips', 'Chest', 'Bodyweight'),
    ('Pull-up', 'Back', 'Bodyweight'),
    ('Barbell Row', 'Back', 'Barbell'),
    ('One-arm Dumbbell Row', 'Back', 'Dumbbells'),
    ('Lat Pulldown', 'Back', 'Cable'),
    ('Seated Cable Row', 'Back', 'Cable'),
    ('Deadlift', 'Back', 'Barbell'),
    ('Overhead Press', 'Shoulders', 'Barbell'),
    ('Dumbbell Shoulder Press', 'Shoulders', 'Dumbbells'),
    ('Lateral Raise', 'Shoulders', 'Dumbbells'),
    ('Face Pull', 'Shoulders', 'Cable'),
    ('Barbell Curl', 'Biceps', 'Barbell'),
    ('Dumbbell Curl', 'Biceps', 'Dumbbells'),
    ('Hammer Curl', 'Biceps', 'Dumbbells'),
    ('Triceps Pushdown', 'Triceps', 'Cable'),
    ('Skull Crusher', 'Triceps', 'Barbell'),
    ('Close-grip Bench Press', 'Triceps', 'Barbell'),
    ('Back Squat', 'Legs', 'Barbell'),
    ('Bulgarian Split Squat', 'Legs', 'Dumbbells'),
    ('Leg Press', 'Legs', 'Machine'),
    ('Romanian Deadlift', 'Legs', 'Barbell'),
    ('Leg Curl', 'Legs', 'Machine'),
    ('Leg Extension', 'Legs', 'Machine'),
    ('Dumbbell Lunge', 'Legs', 'Dumbbells'),
    ('Hip Thrust', 'Glutes', 'Barbell'),
    ('Standing Calf Raise', 'Calves', 'Machine'),
    ('Plank', 'Core', 'Bodyweight'),
    ('Hanging Leg Raise', 'Core', 'Bodyweight'),
    ('Cable Crunch', 'Core', 'Cable');

-- Featured plans are built in a DO block so we can use variables
do $$
declare
    v_plan uuid;
    v_day uuid;
    ex record;
    pos int;
begin
    -- 1. Upper/Lower as a rotation: Upper, Lower, Rest, repeat
    insert into public.plans (owner_id, name, description, goal, level, schedule_type, visibility, is_featured)
    values (null, 'Upper/Lower Rotation', 'Upper, lower, rest, repeat. Every muscle group every 3 days.',
            'hypertrophy', 'intermediate', 'rotation', 'public', true)
    returning id into v_plan;

    insert into public.plan_days (plan_id, position, name) values (v_plan, 0, 'Upper') returning id into v_day;
    pos := 0;
    for ex in select id from public.exercises where name in
        ('Barbell Bench Press', 'Barbell Row', 'Dumbbell Shoulder Press',
         'Lat Pulldown', 'Dumbbell Curl', 'Triceps Pushdown')
    loop
        insert into public.plan_day_exercises (plan_day_id, exercise_id, position, sets, reps_min, reps_max)
        values (v_day, ex.id, pos, 3, 8, 12);
        pos := pos + 1;
    end loop;

    insert into public.plan_days (plan_id, position, name) values (v_plan, 1, 'Lower') returning id into v_day;
    pos := 0;
    for ex in select id from public.exercises where name in
        ('Back Squat', 'Romanian Deadlift', 'Leg Press',
         'Leg Curl', 'Standing Calf Raise', 'Plank')
    loop
        insert into public.plan_day_exercises (plan_day_id, exercise_id, position, sets, reps_min, reps_max)
        values (v_day, ex.id, pos, 3, 8, 12);
        pos := pos + 1;
    end loop;

    insert into public.plan_days (plan_id, position, name, is_rest) values (v_plan, 2, 'Rest', true);

    -- 2. Full Body 3x a week: Mon, Wed, Fri
    insert into public.plans (owner_id, name, description, goal, level, schedule_type, visibility, is_featured)
    values (null, 'Full Body 3x a Week', 'Whole body every session. A good start for beginners.',
            'general', 'beginner', 'weekly', 'public', true)
    returning id into v_plan;

    insert into public.plan_days (plan_id, position, name, day_of_week) values
        (v_plan, 0, 'Full Body A', 1),
        (v_plan, 1, 'Full Body B', 3),
        (v_plan, 2, 'Full Body A', 5);

    for v_day in select id from public.plan_days where plan_id = v_plan loop
        pos := 0;
        for ex in select id from public.exercises where name in
            ('Back Squat', 'Barbell Bench Press', 'One-arm Dumbbell Row', 'Dumbbell Shoulder Press', 'Plank')
        loop
            insert into public.plan_day_exercises (plan_day_id, exercise_id, position, sets, reps_min, reps_max)
            values (v_day, ex.id, pos, 3, 8, 10);
            pos := pos + 1;
        end loop;
    end loop;
end $$;
