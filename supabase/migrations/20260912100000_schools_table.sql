-- Multi-school support (ticket #24), part 1: schema + backfill.
--
-- Naming note: schools.id is the surrogate primary key every FK below
-- points at. schools.school_id is the DepEd numeric school ID (e.g.
-- 107460) -- a plain unique attribute, never an FK target. profiles/
-- learners/learning_areas.school_id all reference schools.id, despite the
-- name collision with schools.school_id.

create table schools (
  id bigint generated always as identity primary key,
  name text not null,
  school_id integer not null unique,
  address text not null
);

alter table schools enable row level security;

create policy "authenticated read" on schools for select using (true);

-- Real tenants, not throwaway seed data -- these rows are structural facts
-- of the deployment, so they live in a migration rather than scripts/seed-*.
insert into schools (name, school_id, address) values
  ('Ligaya Primary School', 107460, 'TODO -- address'),
  ('San Jose ES', 107461, 'TODO -- address'),
  -- Panay ES's real DepEd School ID is not yet known. Placeholder is
  -- deliberately out of the real numbering range so an unfilled row is
  -- caught at review, matching lib/school.ts's existing placeholder style.
  ('Panay ES', 999999, 'TODO -- Panay ES real DepEd School ID + address')
on conflict (school_id) do nothing;

alter table profiles add column school_id bigint references schools (id);
alter table learners add column school_id bigint references schools (id);
alter table learning_areas add column school_id bigint references schools (id);

update profiles set school_id = (select id from schools where school_id = 107460)
  where school_id is null;
update learners set school_id = (select id from schools where school_id = 107460)
  where school_id is null;
update learning_areas set school_id = (select id from schools where school_id = 107460)
  where school_id is null;

alter table profiles alter column school_id set not null;
alter table learners alter column school_id set not null;
alter table learning_areas alter column school_id set not null;

create index on profiles (school_id);
create index on learners (school_id);
create index on learning_areas (school_id);

-- learning_areas HPS is set per-school (set_learning_area_hps), so the same
-- subject/grade must be allowed to exist once per school, not globally.
alter table learning_areas drop constraint learning_areas_name_grade_level_key;
alter table learning_areas add constraint learning_areas_school_id_name_grade_level_key
  unique (school_id, name, grade_level);

create function public.my_school()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select school_id from public.profiles where id = auth.uid();
$$;

-- Account creation must now be explicit about which school a head/teacher
-- belongs to -- no silent default to Ligaya, so every future call site
-- (seed scripts today, an admin UI later) has to pass school_id.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_school_id bigint;
begin
  v_school_id := (new.raw_user_meta_data->>'school_id')::bigint;

  if v_school_id is null then
    raise exception 'school_id is required in user metadata';
  end if;

  if not exists (select 1 from public.schools where id = v_school_id) then
    raise exception 'unknown school_id: %', v_school_id;
  end if;

  insert into public.profiles (id, full_name, role, school_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'teacher'),
    v_school_id
  );

  return new;
end;
$$;
