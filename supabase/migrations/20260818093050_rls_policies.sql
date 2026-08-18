-- RLS policies + teacher grade scoping (ticket #4)

create function public.is_head()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'head'
  );
$$;

create function public.teacher_grades()
returns int[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(grade_level), '{}')
  from public.teacher_assignments
  where teacher_id = auth.uid();
$$;

-- profiles: head reads/writes all (own-row read policy from ticket #3 stays)
create policy "head full access" on profiles for all
  using (public.is_head()) with check (public.is_head());

-- teacher_assignments: head full access; teacher reads own rows (needed
-- so teacher_grades() can resolve for the caller)
create policy "head full access" on teacher_assignments for all
  using (public.is_head()) with check (public.is_head());
create policy "teacher reads own assignments" on teacher_assignments
  for select using (teacher_id = auth.uid());

-- learners: head full access; teacher scoped to assigned grades
create policy "head full access" on learners for all
  using (public.is_head()) with check (public.is_head());
create policy "teacher scoped access" on learners for all
  using (grade_level = any (public.teacher_grades()))
  with check (grade_level = any (public.teacher_grades()));

-- results tables: same shape, scoped via learners.grade_level (no
-- grade_level column on the result rows themselves)
create policy "head full access" on crla_results for all
  using (public.is_head()) with check (public.is_head());
create policy "teacher scoped access" on crla_results for all
  using (learner_id in (
    select id from public.learners where grade_level = any (public.teacher_grades())
  ))
  with check (learner_id in (
    select id from public.learners where grade_level = any (public.teacher_grades())
  ));

create policy "head full access" on rma_results for all
  using (public.is_head()) with check (public.is_head());
create policy "teacher scoped access" on rma_results for all
  using (learner_id in (
    select id from public.learners where grade_level = any (public.teacher_grades())
  ))
  with check (learner_id in (
    select id from public.learners where grade_level = any (public.teacher_grades())
  ));

create policy "head full access" on philiri_results for all
  using (public.is_head()) with check (public.is_head());
create policy "teacher scoped access" on philiri_results for all
  using (learner_id in (
    select id from public.learners where grade_level = any (public.teacher_grades())
  ))
  with check (learner_id in (
    select id from public.learners where grade_level = any (public.teacher_grades())
  ));

create policy "head full access" on exam_results for all
  using (public.is_head()) with check (public.is_head());
create policy "teacher scoped access" on exam_results for all
  using (learner_id in (
    select id from public.learners where grade_level = any (public.teacher_grades())
  ))
  with check (learner_id in (
    select id from public.learners where grade_level = any (public.teacher_grades())
  ));

-- reference/config tables: any authenticated user reads (teachers need
-- HPS and cut-offs to encode scores), only the head writes
create policy "authenticated read" on assessment_rounds for select using (true);
create policy "head writes" on assessment_rounds for insert with check (public.is_head());
create policy "head updates" on assessment_rounds for update using (public.is_head()) with check (public.is_head());
create policy "head deletes" on assessment_rounds for delete using (public.is_head());

create policy "authenticated read" on learning_areas for select using (true);
create policy "head writes" on learning_areas for insert with check (public.is_head());
create policy "head updates" on learning_areas for update using (public.is_head()) with check (public.is_head());
create policy "head deletes" on learning_areas for delete using (public.is_head());

create policy "authenticated read" on scoring_rules for select using (true);
create policy "head writes" on scoring_rules for insert with check (public.is_head());
create policy "head updates" on scoring_rules for update using (public.is_head()) with check (public.is_head());
create policy "head deletes" on scoring_rules for delete using (public.is_head());

-- atomic grade reassignment: delete + insert in one statement so there is
-- no partial-write window; guarded server-side, not just by the UI
create function public.set_teacher_grades(p_teacher uuid, p_grades int[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_head() then
    raise exception 'not authorized';
  end if;

  delete from public.teacher_assignments where teacher_id = p_teacher;

  insert into public.teacher_assignments (teacher_id, grade_level)
    select p_teacher, g from unnest(p_grades) as g;
end;
$$;
