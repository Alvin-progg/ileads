-- Indexes for the filters the grids, class records and dashboards use, and for
-- foreign keys that no existing unique index leads with (round_id, learning_area_id).
-- Safe to re-run. Check with EXPLAIN ANALYZE and drop any the planner ignores.

create index if not exists learners_school_grade_status_name_idx
  on learners (school_id, grade_level, status, last_name, first_name);

create index if not exists crla_results_round_language_idx on crla_results (round_id, language);
create index if not exists philiri_results_round_language_idx on philiri_results (round_id, language);
create index if not exists rma_results_round_idx on rma_results (round_id);
create index if not exists exam_results_round_idx on exam_results (round_id);
create index if not exists exam_results_learning_area_idx on exam_results (learning_area_id);
create index if not exists exam_notes_round_idx on exam_notes (round_id);

create index if not exists teacher_assignments_grade_idx on teacher_assignments (grade_level);
