# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm run dev` — dev server (http://localhost:3000)
- `npm run build` — production build
- `npm run lint` — ESLint (flat config, `eslint.config.mjs`)

No test runner is set up yet.

This repo uses Next.js 16.3.1 — newer than most training data. Per AGENTS.md, consult the bundled docs at `node_modules/next/dist/docs/` (App Router docs under `01-app/`) before writing framework-facing code, and keep the auto-generated AGENTS.md block committed rather than reverting it.

## What this project is

I-LEADS: prototype web app for a DepEd action research at Ligaya Primary School (multigrade school, 4 teachers + 1 school head, ~60 learners, Grades 1–6; the school has no Kindergarten section). It replaces a manual Excel workflow for learner assessment records. The research measures reliability, so data loss is the #1 failure mode to design against.

Stack: Next.js App Router + TypeScript + Tailwind v4, Supabase cloud (Postgres, Auth, RLS), deployed on Vercel, all free tier. Currently a fresh create-next-app scaffold — Supabase is not wired up yet.

Build order: follow `ILEADS-scrum-backlog.md` tickets #1–18 strictly in order (file not yet in repo — ask the user for it if missing). Sprint 3 (scoring engine + CRLA Grade 1 grid) is the pattern every other assessment grid clones.

## Core architecture rules

- **Raw scores in, levels computed out.** Teachers encode raw scores mirroring official DepEd Excel scoresheets. The system computes levels/profiles via official cut-offs. Never let a user type a level directly.
- **Cut-offs live in a `scoring_rules` table (jsonb), never hardcoded.** DepEd revises instruments; rule files are versioned (e.g. CRLA2v1, RMA2v2).
- **Roles enforced by RLS, not just UI.** `head` sees all; `teacher` sees only assigned grade levels (a teacher can hold 2+ grades).
- **Entry grids are keyboard-first** (Tab/Enter navigation), autosave per row with a visible saved/saving/failed indicator and retry on failure.
- **District exports fill the blank official .xlsx templates cell-by-cell** — never rebuild the layouts.
- **Unique keys:** `learners.lrn` (12 digits); `crla(learner, round, language)`; `rma(learner, round)`; `exam(learner, round, learning_area)`.

## Assessment domain

- **CRLA** (reading, G1–3), per language — G1: MT; G2: MT+FIL; G3: MT+FIL+ENG. Raw inputs: task1, task2L/2H, story#, miscues, words read, time, comprehension. Computed: total, WPM, fluency%, Reading Level (Full/Moderate/Light Refresher, Grade Ready), Reading Profile (Low/High Emerging, Developing, Transitioning, At Grade Level).
- **RMA** (math, all grades): per-task raw scores (G3: Tasks A–H, max 2,1,2,3,3,2,3,4 = 20). Computed: total, %, Proficiency Level (Emerging Not/Low Proficient, Developing, Transitioning, At Grade Level).
- **Phil-IRI** (reading, G4–6): pre/post reading level (Independent/Instructional/Frustration/Non-Reader). Spec provisional.
- **Exams:** raw score per subject per quarter, score ≤ HPS. Computed: Mean, SD, MPS per class per subject (MATATAG subject names).

## Prototype scope exclusions

No audit log, no year archiving, no offline mode, no password reset flows.
