/*
# Fix: allow job-based applications without shift_id

The original `applications` table had `shift_id` as NOT NULL because
legacy applications were shift-based. V2 applications are job-based and
do not provide a shift_id, causing a NOT NULL violation on insert.

This migration makes shift_id nullable so:
  - V2 job applications can be created with job_id only (shift_id = NULL)
  - Legacy shift-based applications are preserved and still work
  - No data is deleted or altered
  - Existing UNIQUE(job_id, nurse_id) constraint is preserved
*/

ALTER TABLE applications ALTER COLUMN shift_id DROP NOT NULL;
