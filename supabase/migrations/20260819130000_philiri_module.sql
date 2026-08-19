-- Phil-IRI module (ticket #13): switch philiri_results from storing a
-- computed level directly to raw-scores-in/levels-computed-out, matching
-- crla_results/rma_results, and add the language dimension (FIL/ENG) the
-- original table lacked.

alter table philiri_results
  drop column reading_level,
  add column language text not null default 'FIL'
    check (language in ('FIL', 'ENG')),
  add column screening_score int,
  add column word_count int,
  add column miscues int,
  add column comprehension_items int,
  add column comprehension_correct int,
  add column set_used text check (set_used in ('A', 'B', 'C', 'D')),
  add column remarks text,
  add constraint miscues_le_words
    check (miscues is null or word_count is null or miscues <= word_count),
  add constraint correct_le_items check (
    comprehension_correct is null or comprehension_items is null
    or comprehension_correct <= comprehension_items
  );

alter table philiri_results alter column language drop default;

alter table philiri_results
  drop constraint philiri_results_learner_id_round_id_key,
  add constraint philiri_results_learner_id_round_id_language_key
    unique (learner_id, round_id, language);
