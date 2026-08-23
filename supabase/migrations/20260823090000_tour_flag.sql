-- Guided tour flag (ticket #18)

alter table profiles add column has_seen_tour boolean not null default false;

-- Teachers have no UPDATE policy on profiles (only "read own profile" +
-- head's "for all"), and a column-scoped RLS policy is not expressible —
-- a broad own-row update policy would also let a teacher set role='head'.
-- Same security-definer guard shape as set_teacher_grades().
create function public.mark_tour_seen()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles set has_seen_tour = true where id = auth.uid();
$$;
