-- I-LEADS schema (ticket #2)
-- Levels/profiles are never stored for CRLA/RMA/exams — computed from raw
-- scores via scoring_rules. Phil-IRI stores reading_level because the
-- instrument itself reports a level, not raw scores (spec provisional).

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('head', 'teacher')),
  active boolean not null default true
);

-- grade_level 0 = Kindergarten, 1–6 = Grades 1–6 (everywhere below too)
create table teacher_assignments (
  id bigint generated always as identity primary key,
  teacher_id uuid not null references profiles (id),
  grade_level int not null check (grade_level between 0 and 6),
  unique (teacher_id, grade_level)
);

create table learners (
  id uuid primary key default gen_random_uuid(),
  lrn text not null unique check (lrn ~ '^\d{12}$'),
  last_name text not null,
  first_name text not null,
  middle_name text,
  ext_name text,
  sex text not null check (sex in ('M', 'F')),
  birthdate date,
  grade_level int not null check (grade_level between 0 and 6),
  status text not null default 'enrolled'
    check (status in ('enrolled', 'transferred', 'dropped'))
);

create table assessment_rounds (
  id bigint generated always as identity primary key,
  tool text not null check (tool in ('crla', 'rma', 'philiri', 'exam')),
  name text not null check (name in ('BOSY', 'MOY', 'EOSY', 'Q1', 'Q2', 'Q3', 'Q4')),
  sequence int not null,
  unique (tool, name)
);

-- Raw-score columns are nullable: autosave writes partial rows while the
-- teacher is still encoding; null means not-yet-encoded, not zero.
create table crla_results (
  id bigint generated always as identity primary key,
  learner_id uuid not null references learners (id),
  round_id bigint not null references assessment_rounds (id),
  language text not null check (language in ('MT', 'FIL', 'ENG')),
  task1 int,
  task2l int,
  task2h int,
  story_no int,
  miscues int,
  words_read int,
  reading_secs int,
  comprehension_correct int,
  experience_rating int,
  observation_level text,
  unique (learner_id, round_id, language)
);

create table rma_results (
  id bigint generated always as identity primary key,
  learner_id uuid not null references learners (id),
  round_id bigint not null references assessment_rounds (id),
  task_scores jsonb not null default '{}',
  unique (learner_id, round_id)
);

create table philiri_results (
  id bigint generated always as identity primary key,
  learner_id uuid not null references learners (id),
  round_id bigint not null references assessment_rounds (id),
  passage_level int,
  reading_level text check (reading_level in
    ('Independent', 'Instructional', 'Frustration', 'Non-Reader')),
  unique (learner_id, round_id)
);

create table learning_areas (
  id bigint generated always as identity primary key,
  name text not null,
  grade_level int not null check (grade_level between 0 and 6),
  hps_per_quarter jsonb not null default '{}',
  sequence int not null,
  unique (name, grade_level)
);

-- score <= HPS cannot be a plain CHECK: HPS lives per-quarter in
-- learning_areas.hps_per_quarter jsonb. Enforced by the validation layer.
create table exam_results (
  id bigint generated always as identity primary key,
  learner_id uuid not null references learners (id),
  round_id bigint not null references assessment_rounds (id),
  learning_area_id bigint not null references learning_areas (id),
  score numeric,
  unique (learner_id, round_id, learning_area_id)
);

-- version tracks the DepEd instrument release (e.g. 'CRLA2v1', 'RMA2v2').
-- CRLA per-language cut-offs nest inside rules jsonb.
create table scoring_rules (
  id bigint generated always as identity primary key,
  tool text not null check (tool in ('crla', 'rma', 'philiri', 'exam')),
  grade_level int not null check (grade_level between 0 and 6),
  version text not null,
  rules jsonb not null,
  unique (tool, grade_level, version)
);

-- Deny-all until the RLS ticket adds policies; without RLS every table is
-- writable through the anon API key.
alter table profiles enable row level security;
alter table teacher_assignments enable row level security;
alter table learners enable row level security;
alter table assessment_rounds enable row level security;
alter table crla_results enable row level security;
alter table rma_results enable row level security;
alter table philiri_results enable row level security;
alter table exam_results enable row level security;
alter table learning_areas enable row level security;
alter table scoring_rules enable row level security;
