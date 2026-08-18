-- Auth + roles (ticket #3)

-- proxy role lookup needs users to read their own profile
create policy "read own profile" on profiles
  for select using ((select auth.uid()) = id);

-- auto-create a profile when an auth user is created (dashboard or signup).
-- role comes from raw_user_meta_data if set, defaults to 'teacher';
-- head is promoted manually afterwards.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'teacher')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
