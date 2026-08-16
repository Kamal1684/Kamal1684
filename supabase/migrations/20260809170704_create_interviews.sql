/*
# Create interviews table

## Overview
Creates the `interviews` table for scheduling interviews between hospitals
and nurse candidates. Each interview is linked to an application.

## New Table: interviews
- `id` (uuid, PK)
- `application_id` (uuid, NOT NULL, FK → applications ON DELETE CASCADE)
- `interview_date` (date, NOT NULL)
- `interview_time` (time, NOT NULL)
- `interview_type` (text, NOT NULL) — in_person / video / phone
- `meeting_link` (text, nullable) — for video interviews
- `location` (text, nullable) — for in-person interviews
- `notes` (text, nullable) — interview notes/instructions
- `status` (text, NOT NULL, default 'scheduled')
  — scheduled / completed / cancelled / rescheduled
- `created_at` (timestamptz)
- `updated_at` (timestamptz, auto-updated)

## Security (RLS)
- SELECT: nurse sees interviews for their own applications; hospital sees
  interviews for applications on their jobs; admin sees all.
- INSERT: hospital owner (via application → job → hospital) or admin.
- UPDATE: hospital owner or admin.
- DELETE: hospital owner or admin.

## Notes
1. Interview is linked to an application, which links to both a nurse
   and a job/hospital. Access is scoped through this chain.
2. Only hospitals schedule interviews — nurses cannot create them.
*/

CREATE TABLE IF NOT EXISTS interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  interview_date date NOT NULL,
  interview_time time NOT NULL,
  interview_type text NOT NULL CHECK (interview_type IN ('in_person', 'video', 'phone')),
  meeting_link text,
  location text,
  notes text,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;

-- Helper: can the current user manage this interview (hospital owner or admin)?
-- We inline this in each policy.

-- SELECT: nurse (via application.nurse_id), hospital (via application → job → hospital), admin
DROP POLICY IF EXISTS "interviews_select_nurse_hospital_admin" ON interviews;
CREATE POLICY "interviews_select_nurse_hospital_admin"
ON interviews FOR SELECT
TO authenticated USING (
  EXISTS (SELECT 1 FROM applications WHERE applications.id = interviews.application_id AND applications.nurse_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM applications
    JOIN jobs ON jobs.id = applications.job_id
    JOIN hospitals ON hospitals.id = jobs.hospital_id
    WHERE applications.id = interviews.application_id AND hospitals.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM applications
    JOIN shifts ON shifts.id = applications.shift_id
    JOIN hospitals ON hospitals.id = shifts.hospital_id
    WHERE applications.id = interviews.application_id AND hospitals.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- INSERT: hospital owner or admin
DROP POLICY IF EXISTS "interviews_insert_hospital_or_admin" ON interviews;
CREATE POLICY "interviews_insert_hospital_or_admin"
ON interviews FOR INSERT
TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM applications
    JOIN jobs ON jobs.id = applications.job_id
    JOIN hospitals ON hospitals.id = jobs.hospital_id
    WHERE applications.id = interviews.application_id AND hospitals.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM applications
    JOIN shifts ON shifts.id = applications.shift_id
    JOIN hospitals ON hospitals.id = shifts.hospital_id
    WHERE applications.id = interviews.application_id AND hospitals.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- UPDATE: hospital owner or admin
DROP POLICY IF EXISTS "interviews_update_hospital_or_admin" ON interviews;
CREATE POLICY "interviews_update_hospital_or_admin"
ON interviews FOR UPDATE
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM applications
    JOIN jobs ON jobs.id = applications.job_id
    JOIN hospitals ON hospitals.id = jobs.hospital_id
    WHERE applications.id = interviews.application_id AND hospitals.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM applications
    JOIN shifts ON shifts.id = applications.shift_id
    JOIN hospitals ON hospitals.id = shifts.hospital_id
    WHERE applications.id = interviews.application_id AND hospitals.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM applications
    JOIN jobs ON jobs.id = applications.job_id
    JOIN hospitals ON hospitals.id = jobs.hospital_id
    WHERE applications.id = interviews.application_id AND hospitals.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM applications
    JOIN shifts ON shifts.id = applications.shift_id
    JOIN hospitals ON hospitals.id = shifts.hospital_id
    WHERE applications.id = interviews.application_id AND hospitals.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- DELETE: hospital owner or admin
DROP POLICY IF EXISTS "interviews_delete_hospital_or_admin" ON interviews;
CREATE POLICY "interviews_delete_hospital_or_admin"
ON interviews FOR DELETE
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM applications
    JOIN jobs ON jobs.id = applications.job_id
    JOIN hospitals ON hospitals.id = jobs.hospital_id
    WHERE applications.id = interviews.application_id AND hospitals.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM applications
    JOIN shifts ON shifts.id = applications.shift_id
    JOIN hospitals ON hospitals.id = shifts.hospital_id
    WHERE applications.id = interviews.application_id AND hospitals.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

CREATE INDEX IF NOT EXISTS idx_interviews_application_id ON interviews(application_id);
CREATE INDEX IF NOT EXISTS idx_interviews_status ON interviews(status);

DROP TRIGGER IF EXISTS interviews_updated_at ON interviews;
CREATE TRIGGER interviews_updated_at
  BEFORE UPDATE ON interviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
