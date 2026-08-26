-- "Special teacher" = the Kindergarten teacher. LABEL ONLY: it grants nothing
-- and gates nothing. Real Kinder access comes from a teacher_assignments row
-- at grade_level 0, which public.teacher_grades() hands to every grade-scoped
-- RLS policy.
--
-- Named is_special, not is_kinder_teacher, precisely so it cannot be mistaken
-- for that source of truth -- and so the head can re-label a teacher without
-- touching her assignments.
--
-- No security-definer RPC here (cf. mark_tour_seen in
-- 20260823090000_tour_flag.sql, which exists only because teachers have no
-- UPDATE policy on profiles). Only the head ever writes this column, and
-- "head full access" on profiles already covers it.

alter table profiles
  add column is_special boolean not null default false;

comment on column profiles.is_special is
  'Head-applied label: this teacher handles Kindergarten. Display only - grants no access.';
