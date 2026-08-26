-- Kindergarten returns as a roster-only grade (grade_level 0).
--
-- This reverses 20260819150000_remove_kindergarten.sql, but only halfway, on
-- purpose. Grade 0 comes back on learners (Kinder learners are rows here) and
-- on teacher_assignments (a Kinder teacher needs a grade-0 assignment for
-- public.teacher_grades() to feed the grade-scoped RLS policies).
--
-- It deliberately does NOT come back on learning_areas or scoring_rules.
-- Kindergarten sits no DepEd instrument, so leaving those two at 1-6 makes
-- "Kinder takes no assessments" a database invariant rather than something
-- only the *_GRADES lists in lib/grades.ts enforce. Widen them in a later
-- migration if DepEd ever issues a Kinder instrument.
--
-- The 2026-08-19 migration replaced the original auto-named checks with
-- explicitly named ones, so these drop by name -- no pg_constraint loop.

alter table learners
  drop constraint learners_grade_level_check,
  add constraint learners_grade_level_check
    check (grade_level between 0 and 6);

alter table teacher_assignments
  drop constraint teacher_assignments_grade_level_check,
  add constraint teacher_assignments_grade_level_check
    check (grade_level between 0 and 6);

comment on column learners.grade_level is
  'grade_level 0 = Kindergarten (roster only - no assessments), 1-6 = Grades 1-6';
comment on column teacher_assignments.grade_level is
  'grade_level 0 = Kindergarten, 1-6 = Grades 1-6';
