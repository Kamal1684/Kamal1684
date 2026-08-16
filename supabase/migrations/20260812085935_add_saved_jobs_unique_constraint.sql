/*
# Prevent duplicate saved_jobs records

1. Database Changes
- Add a UNIQUE constraint on (nurse_id, job_id) in saved_jobs so a nurse
  cannot save the same job twice.
- Uses IF NOT EXISTS pattern to be idempotent.

2. Security Notes
- No RLS changes. Existing saved_jobs policies remain intact.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'saved_jobs_nurse_job_unique'
  ) THEN
    ALTER TABLE saved_jobs ADD CONSTRAINT saved_jobs_nurse_job_unique UNIQUE (nurse_id, job_id);
  END IF;
END $$;
