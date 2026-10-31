-- User profile (1:1 with the Supabase Auth account)
create table public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    display_name text,
    created_at timestamptz not null default now()
);

-- Exercises: created_by = null means a built-in library exercise,
-- created_by = user id means the user's own private exercise
create table public.exercises (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    muscle_group text not null,
    equipment text,
    created_by uuid references public.profiles (id) on delete cascade,
    created_at timestamptz not null default now()
);

-- Plans: owner_id = null means a "system" plan (featured, from the seed)
create table public.plans (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid default auth.uid() references public.profiles (id) on delete cascade,
    name text not null,
    description text,
    goal text check (goal in ('strength', 'hypertrophy', 'general')),
    level text check (level in ('beginner', 'intermediate', 'advanced')),
    schedule_type text not null check (schedule_type in ('weekly', 'rotation')),
    visibility text not null default 'private' check (visibility in ('private', 'public')),
    is_featured boolean not null default false,
    copied_from uuid references public.plans (id) on delete set null,
    created_at timestamptz not null default now()
);

-- Plan days. position = order in the cycle (0, 1, 2...),
-- day_of_week = weekday (1 = Mon ... 7 = Sun), weekly plans only
create table public.plan_days (
    id uuid primary key default gen_random_uuid(),
    plan_id uuid not null references public.plans (id) on delete cascade,
    position int not null,
    name text not null,
    is_rest boolean not null default false,
    day_of_week smallint check (day_of_week between 1 and 7),
    unique (plan_id, position),
    unique (plan_id, day_of_week) -- at most one day per weekday (null is allowed many times)
);

-- Exercises within a plan day
create table public.plan_day_exercises (
    id uuid primary key default gen_random_uuid(),
    plan_day_id uuid not null references public.plan_days (id) on delete cascade,
    exercise_id uuid not null references public.exercises (id) on delete cascade,
    position int not null default 0,
    sets int not null default 3 check (sets > 0),
    reps_min int not null default 8 check (reps_min > 0),
    reps_max int not null default 12 check (reps_max >= reps_min),
    rest_seconds int not null default 120
);

-- The user's active plan (at most one, so user_id is the key)
create table public.user_active_plans (
    user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
    plan_id uuid not null references public.plans (id) on delete cascade,
    started_on date not null default current_date,
    advance_mode text not null default 'completion' check (advance_mode in ('completion', 'calendar'))
);

-- Completed workouts. day_position and day_name are a "snapshot" of the day,
-- so history does not change when the plan is edited later
create table public.workout_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
    plan_id uuid references public.plans (id) on delete set null,
    plan_day_id uuid references public.plan_days (id) on delete set null,
    day_position int,
    day_name text,
    started_at timestamptz not null default now(),
    finished_at timestamptz
);

-- Completed sets
create table public.workout_sets (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null references public.workout_sessions (id) on delete cascade,
    user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
    exercise_id uuid not null references public.exercises (id) on delete cascade,
    set_number int not null,
    weight numeric(6, 2) not null default 0,
    reps int not null,
    created_at timestamptz not null default now()
);

-- Indexes for the most common queries
create index on public.plan_days (plan_id);
create index on public.plan_day_exercises (plan_day_id);
create index on public.workout_sessions (user_id, started_at desc);
create index on public.workout_sets (user_id, exercise_id, created_at desc);

-- Create a profile automatically after sign-up
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.profiles (id, display_name)
    values (new.id, new.raw_user_meta_data ->> 'display_name');
    return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();
