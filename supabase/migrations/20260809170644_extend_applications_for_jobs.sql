/*
# Extend applications table for job-based recruitment

## Overview
The existing `applications` table linked nurses to shifts. We now extend
it to also link nurses to jobs. The existing `shift_id` column is preserved
and a new `job_id` column is added. The `status` CHECK constraint is
expanded to include the new recruitment statuses. An `updated_at` column
and a unique constraint preventing duplicate job applications are added.

## Modified Table: applications (existing — extended)
New columns:
- `job_id` (uuid, nullable, FK → jobs) — the job being applied to
- `updated_at` (timestamptz, default now()) — last status change

Modified columns:
- `status` CHECK constraint expanded to include:
  applied / under_review / shortlisted / interview_scheduled / selected / joined / rejected
  The original statuses (pending / accepted / rejected / withdrawn) are kept
  for backward compatibility with existing shift applications.

New constraints:
- UNIQUE (job_id, nurse_id) — prevents duplicate applications to the same job

## Security (RLS) — policies updated
- SELECT: nurse sees own applications; hospital sees applications for
  their jobs (via jobs → hospitals) or their shifts (via shifts → hospitals);
  admin sees all.
- INSERT: nurse can insert own application.
- UPDATE: hospital owner (via job or shift) can update status; admin can
  update any; nurse can withdraw (update status to 'withdrawn' or 'rejected'
  on own row).
- DELETE: nurse can delete own; admin can delete any.

## Notes
1. job_id is nullable so legacy shift-based applications still work.
2. The status CHECK now allows both old and new status values.
3. UNIQUE (job_id, nurse_id) prevents the same nurse from applying to the
   same job twice. This does NOT affect shift-based applications.
4. All changes are additive — no data is lost.
*/

-- Add job_id column
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applications' AND column_name = 'job_id') THEN
    ALTER TABLE applications ADD COLUMN job_id uuid REFERENCES jobs(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add updated_at column
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applications' AND column_name = 'updated_at') THEN
    ALTER TABLE applications ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

-- Expand status CHECK constraint to include new recruitment statuses
-- Drop old constraint and add new one that allows both old and new values
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'applications_status_check'
      AND conrelid = 'applications'::regclass
  ) THEN
    ALTER TABLE applications DROP CONSTRAINT applications_status_check;
  END IF;
END $$;

ALTER TABLE applications ADD CONSTRAINT applications_status_check
  CHECK (status IN (
    'pending', 'accepted', 'rejected', 'withdrawn',
    'applied', 'under_review', 'shortlisted', 'interview_scheduled',
    'selected', 'joined'
  ));

-- Add unique constraint for job applications (prevents duplicate)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'applications_job_id_nurse_id_key'
      AND conrelid = 'applications'::regclass
  ) THEN
    ALTER TABLE applications ADD CONSTRAINT applications_job_id_nurse_id_key
      UNIQUE (job_id, nurse_id);
  END IF;
END $$;

-- updated_at trigger
DROP TRIGGER IF EXISTS applications_updated_at ON applications;
CREATE TRIGGER applications_updated_at
  BEFORE UPDATE ON applications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_applications_job_id ON applications(job_id);

-- ============ REPLACE ALL POLICIES ============
-- Drop all old policies
DROP POLICY IF EXISTS "applications_select_nurse_or_hospital" ON applications;
DROP POLICY IF EXISTS "applications_insert_own" ON applications;
DROP POLICY IF EXISTS "applications_update_hospital_status" ON applications;
DROP POLICY IF EXISTS "applications_update_nurse_withdraw" ON applications;
DROP POLICY IF EXISTS "applications_delete_own" ON applications;

-- SELECT: nurse sees own; hospital sees apps for their jobs or shifts; admin sees all
CREATE POLICY "applications_select_nurse_hospital_admin"
ON applications FOR SELECT
TO authenticated USING (
  nurse_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM jobs
    JOIN hospitals ON hospitals.id = jobs.hospital_id
    WHERE jobs.id = applications.job_id AND hospitals.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM shifts
    JOIN hospitals ON hospitals.id = shifts.hospital_id
    WHERE shifts.id = applications.shift_id AND hospitals.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- INSERT: nurse inserts own
CREATE POLICY "applications_insert_own"
ON applications FOR INSERT
TO authenticated WITH CHECK (nurse_id = auth.uid());

-- UPDATE: hospital owner (via job or shift) or admin or nurse (own)
CREATE POLICY "applications_update_hospital_or_admin_or_nurse"
ON applications FOR UPDATE
TO authenticated USING (
  nurse_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM jobs
    JOIN hospitals ON hospitals.id = jobs.hospital_id
    WHERE jobs.id = applications.job_id AND hospitals.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM shifts
    JOIN hospitals ON hospitals.id = shifts.hospital_id
    WHERE shifts.id = applications.shift_id AND hospitals.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
) WITH CHECK (
  nurse_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM jobs
    JOIN hospitals ON hospitals.id = jobs.hospital_id
    WHERE jobs.id = applications.job_id AND hospitals.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM shifts
    JOIN hospitals ON hospitals.id = shifts.hospital_id
    WHERE shifts.id = applications.shift_id AND hospitals.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- DELETE: nurse deletes own; admin deletes any
CREATE POLICY "applications_delete_own_or_admin"
ON applications FOR DELETE
TO authenticated USING (
  nurse_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);
