-- Project TALA (DM 373 s.2026): monthly class reading intervention tracker.
-- Raw scores only; profile, program and status are always computed.

alter table scoring_rules drop constraint if exists scoring_rules_tool_check;
alter table scoring_rules add constraint scoring_rules_tool_check
  check (tool in ('crla', 'rma', 'philiri', 'exam', 'tala'));

create table tala_results (
  id bigint generated always as identity primary key,
  learner_id uuid not null references learners (id),
  month date not null check (extract(day from month) = 1),  -- first of month
  wcpm int check (wcpm between 0 and 400),
  -- comprehension_correct <= items is enforced by the server action: the item
  -- count lives in the rules jsonb.
  comprehension_correct int check (comprehension_correct >= 0),
  frequency int check (frequency between 0 and 31),
  remarks text,
  updated_at timestamptz not null default now(),
  unique (learner_id, month)
);
create index on tala_results (month);
alter table tala_results enable row level security;

create policy "head full access" on tala_results for all
  using (public.is_head() and learner_id in (
    select id from public.learners where school_id = public.my_school()))
  with check (public.is_head() and learner_id in (
    select id from public.learners where school_id = public.my_school()));

create policy "teacher scoped access" on tala_results for all
  using (learner_id in (
    select id from public.learners
    where grade_level = any (public.teacher_grades()) and school_id = public.my_school()))
  with check (learner_id in (
    select id from public.learners
    where grade_level = any (public.teacher_grades()) and school_id = public.my_school()));
