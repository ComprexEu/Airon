-- Theme settings in the profile, so they follow the user to another phone after sign-in
alter table public.profiles
    add column theme_mode text not null default 'system' check (theme_mode in ('system', 'light', 'dark')),
    add column accent text not null default 'steel';
