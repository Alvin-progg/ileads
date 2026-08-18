-- Widen assessment_rounds.name to accept Phil-IRI's Pre/Post rounds
-- (ticket #2's check only had BOSY/MOY/EOSY/Q1-Q4). Find the auto-named
-- constraint dynamically instead of guessing its generated name.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.assessment_rounds'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%BOSY%'
  loop
    execute format('alter table public.assessment_rounds drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.assessment_rounds
  add constraint assessment_rounds_name_check
  check (name in ('BOSY', 'MOY', 'EOSY', 'Q1', 'Q2', 'Q3', 'Q4', 'Pre', 'Post'));
