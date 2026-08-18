-- Remarks (ticket #9). The CRLA scoresheet carries a teacher-typed Remarks
-- column that the Class Record reproduces; there was nowhere to store it.
alter table crla_results add column remarks text;
