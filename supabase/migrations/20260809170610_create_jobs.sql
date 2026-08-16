/*
# Create jobs table

## Overview
Creates the `jobs` table — the central entity for hospital job postings.
This is separate from the existing `shifts` table, which remains for
backward compatibility with the original shift-based model. The `jobs`
table supports a richer recruitment workflow with approval states,
salary ranges, vacancies, and skill matching.

## New Table: jobs
- `id` (uuid, PK)
- `hospital_id` (uuid, NOT NULL, FK → hospitals) — posting hospital
- `job_title` (text, NOT NULL)
- `department` (text, NOT NULL)
- `qualification_required` (text, nullable) — e.g. "BSc Nursing"
- `experience_required` (integer, nullable) — minimum years
- `salary_min` (numeric(10,2), nullable)
- `salary_max` (numeric(10,2), nullable)
- `location` (text, nullable) — job location
- `vacancies` (integer, default 1) — number of open positions
- `shift_id` (uuid, nullable, FK → shifts) — optional link to a shift
- `accommodation_available` (boolean, default false)
- `job_description` (text, nullable)
- `required_skills` (text, nullable) — comma-separated skills
- `status` (text, NOT NULL, default 'pending_approval')
  — draft / pending_approval / active / closed / rejected
- `created_at` (timestamptz)
- `updated_at` (timestamptz, auto-updated)

## Security (RLS)
- SELECT: all authenticated users can read jobs (nurses need to browse).
  Admins and the owning hospital can see all statuses; other users see
  only 'active' jobs. This is enforced via a USING predicate.
- INSERT: only the hospital owner can create jobs for their hospital.
- UPDATE: hospital owner can update their own jobs; admin can update any job.
- DELETE: hospital owner can delete their own jobs; admin can delete any.

## Notes
1. Jobs start as 'pending_approval' — admin must approve before they
   become 'active' and visible to nurses.
2. shift_id is optional — allows linking a job to a specific shift
   in the legacy shifts table if needed.
*/

CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  job_title text NOT NULL,
  department text NOT NULL,
  qualification_required text,
  experience_required integer,
  salary_min numeric(10,2),
  salary_max numeric(10,2),
  location text,
  vacancies integer NOT NULL DEFAULT 1,
  shift_id uuid REFERENCES shifts(id) ON DELETE SET NULL,
  accommodation_available boolean NOT NULL DEFAULT false,
  job_description text,
  required_skills text,
  status text NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('draft', 'pending_approval', 'active', 'closed', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- SELECT: active jobs visible to all; all statuses visible to owner + admin
DROP POLICY IF EXISTS "jobs_select_visible" ON jobs;
CREATE POLICY "jobs_select_visible"
ON jobs FOR SELECT
TO authenticated USING (
  status = 'active'
  OR EXISTS (
    SELECT 1 FROM hospitals
    WHERE hospitals.id = jobs.hospital_id AND hospitals.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- INSERT: only hospital owner
DROP POLICY IF EXISTS "jobs_insert_hospital_owner" ON jobs;
CREATE POLICY "jobs_insert_hospital_owner"
ON jobs FOR INSERT
TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM hospitals
    WHERE hospitals.id = jobs.hospital_id AND hospitals.user_id = auth.uid()
  )
);

-- UPDATE: hospital owner or admin
DROP POLICY IF EXISTS "jobs_update_owner_or_admin" ON jobs;
CREATE POLICY "jobs_update_owner_or_admin"
ON jobs FOR UPDATE
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM hospitals
    WHERE hospitals.id = jobs.hospital_id AND hospitals.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM hospitals
    WHERE hospitals.id = jobs.hospital_id AND hospitals.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- DELETE: hospital owner or admin
DROP POLICY IF EXISTS "jobs_delete_owner_or_admin" ON jobs;
CREATE POLICY "jobs_delete_owner_or_admin"
ON jobs FOR DELETE
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM hospitals
    WHERE hospitals.id = jobs.hospital_id AND hospitals.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

CREATE INDEX IF NOT EXISTS idx_jobs_hospital_id ON jobs(hospital_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_department ON jobs(department);
CREATE INDEX IF NOT EXISTS idx_jobs_location ON jobs(location);

DROP TRIGGER IF EXISTS jobs_updated_at ON jobs;
CREATE TRIGGER jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
