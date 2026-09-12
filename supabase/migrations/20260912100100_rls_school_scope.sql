-- Multi-school support (ticket #24), part 2: RLS re-scope + RPC guards.
--
-- Every policy from 20260818093050_rls_policies.sql and
-- 20260819120000_exam_module.sql is dropped and recreated under the same
-- name, now additionally scoped by school. Two shapes:
--   - direct school_id column: profiles, learners, learning_areas
--   - join-through (no new column): teacher_assignments (via profiles),
--     crla/rma/philiri/exam_results (via learners), exam_notes (via
--     learning_areas, which is itself now school-scoped, so this join
--     becomes correct for free)
-- assessment_rounds and scoring_rules stay global -- national DepEd
-- instrument definitions, identical across schools by spec.

-- profiles
drop policy "head full access" on profiles;
create policy "head full access" on profiles for all
  using (public.is_head() and school_id = public.my_school())
  with check (public.is_head() and school_id = public.my_school());

-- teacher_assignments
drop policy "head full access" on teacher_assignments;
create policy "head full access" on teacher_assignments for all
  using (public.is_head() and teacher_id in (
    select id from public.profiles where school_id = public.my_school()
  ))
  with check (public.is_head() and teacher_id in (
    select id from public.profiles where school_id = public.my_school()
  ));
-- "teacher reads own assignments" (teacher_id = auth.uid()) is inherently
-- single-school and needs no change.

-- learners
drop policy "head full access" on learners;
drop policy "teacher scoped access" on learners;
create policy "head full access" on learners for all
  using (public.is_head() and school_id = public.my_school())
  with check (public.is_head() and school_id = public.my_school());
create policy "teacher scoped access" on learners for all
  using (grade_level = any (public.teacher_grades()) and school_id = public.my_school())
  with check (grade_level = any (public.teacher_grades()) and school_id = public.my_school());

-- crla_results / rma_results / philiri_results / exam_results: same shape,
-- scoped via learners (no grade_level or school_id column on the result
-- rows themselves)
drop policy "head full access" on crla_results;
drop policy "teacher scoped access" on crla_results;
create policy "head full access" on crla_results for all
  using (public.is_head() and learner_id in (
    select id from public.learners where school_id = public.my_school()
  ))
  with check (public.is_head() and learner_id in (
    select id from public.learners where school_id = public.my_school()
  ));
create policy "teacher scoped access" on crla_results for all
  using (learner_id in (
    select id from public.learners
    where grade_level = any (public.teacher_grades()) and school_id = public.my_school()
  ))
  with check (learner_id in (
    select id from public.learners
    where grade_level = any (public.teacher_grades()) and school_id = public.my_school()
  ));

drop policy "head full access" on rma_results;
drop policy "teacher scoped access" on rma_results;
create policy "head full access" on rma_results for all
  using (public.is_head() and learner_id in (
    select id from public.learners where school_id = public.my_school()
  ))
  with check (public.is_head() and learner_id in (
    select id from public.learners where school_id = public.my_school()
  ));
create policy "teacher scoped access" on rma_results for all
  using (learner_id in (
    select id from public.learners
    where grade_level = any (public.teacher_grades()) and school_id = public.my_school()
  ))
  with check (learner_id in (
    select id from public.learners
    where grade_level = any (public.teacher_grades()) and school_id = public.my_school()
  ));

drop policy "head full access" on philiri_results;
drop policy "teacher scoped access" on philiri_results;
create policy "head full access" on philiri_results for all
  using (public.is_head() and learner_id in (
    select id from public.learners where school_id = public.my_school()
  ))
  with check (public.is_head() and learner_id in (
    select id from public.learners where school_id = public.my_school()
  ));
create policy "teacher scoped access" on philiri_results for all
  using (learner_id in (
    select id from public.learners
    where grade_level = any (public.teacher_grades()) and school_id = public.my_school()
  ))
  with check (learner_id in (
    select id from public.learners
    where grade_level = any (public.teacher_grades()) and school_id = public.my_school()
  ));

drop policy "head full access" on exam_results;
drop policy "teacher scoped access" on exam_results;
create policy "head full access" on exam_results for all
  using (public.is_head() and learner_id in (
    select id from public.learners where school_id = public.my_school()
  ))
  with check (public.is_head() and learner_id in (
    select id from public.learners where school_id = public.my_school()
  ));
create policy "teacher scoped access" on exam_results for all
  using (learner_id in (
    select id from public.learners
    where grade_level = any (public.teacher_grades()) and school_id = public.my_school()
  ))
  with check (learner_id in (
    select id from public.learners
    where grade_level = any (public.teacher_grades()) and school_id = public.my_school()
  ));

-- learning_areas: now school-scoped (see part 1 migration). Read narrows
-- from "any authenticated user" to "own school only"; head writes and the
-- teacher HPS-update both gain the same school check.
drop policy "authenticated read" on learning_areas;
drop policy "head writes" on learning_areas;
drop policy "head updates" on learning_areas;
drop policy "head deletes" on learning_areas;
drop policy "teacher updates own-grade HPS" on learning_areas;
create policy "authenticated read own school" on learning_areas for select
  using (school_id = public.my_school());
create policy "head writes" on learning_areas for insert
  with check (public.is_head() and school_id = public.my_school());
create policy "head updates" on learning_areas for update
  using (public.is_head() and school_id = public.my_school())
  with check (public.is_head() and school_id = public.my_school());
create policy "head deletes" on learning_areas for delete
  using (public.is_head() and school_id = public.my_school());
create policy "teacher updates own-grade HPS" on learning_areas
  for update using (
    grade_level = any (public.teacher_grades()) and school_id = public.my_school()
  )
  with check (
    grade_level = any (public.teacher_grades()) and school_id = public.my_school()
  );

-- exam_notes: join through learning_areas, which is now itself
-- school-scoped, so this becomes correctly school-scoped with no new
-- column or explicit school_id needed here.
drop policy "head full access" on exam_notes;
drop policy "teacher scoped access" on exam_notes;
create policy "head full access" on exam_notes for all
  using (public.is_head() and learning_area_id in (
    select id from public.learning_areas where school_id = public.my_school()
  ))
  with check (public.is_head() and learning_area_id in (
    select id from public.learning_areas where school_id = public.my_school()
  ));
create policy "teacher scoped access" on exam_notes for all
  using (learning_area_id in (
    select id from public.learning_areas
    where grade_level = any (public.teacher_grades()) and school_id = public.my_school()
  ))
  with check (learning_area_id in (
    select id from public.learning_areas
    where grade_level = any (public.teacher_grades()) and school_id = public.my_school()
  ));

-- RPC guards: both functions are security definer and bypass RLS, so the
-- same-school check has to be hand-written in the function body.

create or replace function public.set_teacher_grades(p_teacher uuid, p_grades int[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_head() then
    raise exception 'not authorized';
  end if;

  if (select school_id from public.profiles where id = p_teacher) is distinct from public.my_school() then
    raise exception 'not authorized';
  end if;

  delete from public.teacher_assignments where teacher_id = p_teacher;

  insert into public.teacher_assignments (teacher_id, grade_level)
    select p_teacher, g from unnest(p_grades) as g;
end;
$$;

create or replace function public.set_learning_area_hps(
  p_learning_area_id bigint,
  p_quarter text,
  p_hps numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grade int;
  v_school bigint;
begin
  select grade_level, school_id into v_grade, v_school
    from public.learning_areas
    where id = p_learning_area_id;

  if v_grade is null then
    raise exception 'learning area not found';
  end if;

  if v_school is distinct from public.my_school() then
    raise exception 'not authorized';
  end if;

  if not (public.is_head() or v_grade = any (public.teacher_grades())) then
    raise exception 'not authorized';
  end if;

  update public.learning_areas
    set hps_per_quarter = coalesce(hps_per_quarter, '{}'::jsonb)
      || jsonb_build_object(p_quarter, p_hps)
    where id = p_learning_area_id;
end;
$$;
