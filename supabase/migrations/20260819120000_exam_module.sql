-- Exam scores module (ticket #12).

-- Teachers set the HPS for their own grades' subjects; the subject list
-- itself (name, sequence, add/remove) stays head-only, so this is additive
-- to the existing head policy rather than a replacement.
create policy "teacher updates own-grade HPS" on learning_areas
  for update using (grade_level = any (public.teacher_grades()))
  with check (grade_level = any (public.teacher_grades()));

-- Least Mastered Skills: one free-text note per subject per quarter. The
-- grade is already implied by learning_area_id, so no separate grade key.
create table exam_notes (
  id bigint generated always as identity primary key,
  learning_area_id bigint not null references learning_areas (id),
  round_id bigint not null references assessment_rounds (id),
  least_mastered_skills text,
  unique (learning_area_id, round_id)
);

alter table exam_notes enable row level security;

create policy "head full access" on exam_notes for all
  using (public.is_head()) with check (public.is_head());
create policy "teacher scoped access" on exam_notes for all
  using (learning_area_id in (
    select id from public.learning_areas where grade_level = any (public.teacher_grades())
  ))
  with check (learning_area_id in (
    select id from public.learning_areas where grade_level = any (public.teacher_grades())
  ));

-- Atomic HPS write: a plain UPDATE would need a read-modify-write of the jsonb
-- column from the client, which risks a lost update if two people touch the
-- same subject at once. This does the merge server-side in one statement, and
-- doubles as a second enforcement point beside the RLS policy above.
create function public.set_learning_area_hps(
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
begin
  select grade_level into v_grade
    from public.learning_areas
    where id = p_learning_area_id;

  if v_grade is null then
    raise exception 'learning area not found';
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
