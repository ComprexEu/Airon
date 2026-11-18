-- Deletes the signed-in user's account.
-- Removing the row from auth.users cascades to profiles, and from there
-- to plans, sessions, sets and everything else the user owns (on delete cascade).
create function public.delete_my_account()
returns void
language plpgsql
security definer -- needs extra rights: a normal user cannot delete from auth.users
set search_path = ''
as $$
begin
    if auth.uid() is null then
        raise exception 'Not signed in';
    end if;

    -- only ever the caller's own account
    delete from auth.users where id = auth.uid();
end;
$$;

-- only signed-in users may call it
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
