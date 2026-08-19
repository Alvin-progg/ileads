-- The deployment school has no Kindergarten section, so grade_level 0 is
-- removed entirely rather than kept as an unused option. Deletes existing
-- dummy seed rows at grade_level 0 (children first, to satisfy the
-- unnamed FKs on exam_results/exam_notes, which have no ON DELETE clause),
-- then tightens every grade_level check constraint from 0-6 to 1-6.

delete from exam_results
where learner_id in (select id from learners where grade_level = 0)
   or learning_area_id in (select id from learning_areas where grade_level = 0);

delete from exam_notes
where learning_area_id in (select id from learning_areas where grade_level = 0);

delete from teacher_assignments where grade_level = 0;
delete from learners where grade_level = 0;
delete from learning_areas where grade_level = 0;

-- Constraint names weren't given explicitly when these tables were created,
-- so drop whatever Postgres auto-named them by inspecting pg_constraint
-- rather than assuming a naming convention.
do $$
declare
  r record;
begin
  for r in
    select conname, conrelid::regclass::text as tbl
    from pg_constraint
    where contype = 'c'
      and conrelid::regclass::text in
        ('learners', 'teacher_assignments', 'learning_areas', 'scoring_rules')
      -- Postgres normalises "between 0 and 6" into ">= 0) AND (... <= 6" when
      -- it stores the constraint, so match on the column instead of the
      -- keyword. Each of these tables has exactly one check on grade_level.
      and pg_get_constraintdef(oid) ilike '%grade_level%'
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

alter table learners add constraint learners_grade_level_check
  check (grade_level between 1 and 6);
alter table teacher_assignments add constraint teacher_assignments_grade_level_check
  check (grade_level between 1 and 6);
alter table learning_areas add constraint learning_areas_grade_level_check
  check (grade_level between 1 and 6);
alter table scoring_rules add constraint scoring_rules_grade_level_check
  check (grade_level between 1 and 6);
