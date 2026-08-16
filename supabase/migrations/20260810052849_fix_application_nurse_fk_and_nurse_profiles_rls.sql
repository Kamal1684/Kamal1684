/*
# Fix application read flow — missing FKs and nurse_profiles RLS

## Problem
The V2 frontend queries applications with embedded relations:
  applications?select=*,jobs(*,hospitals(...)),profiles(...),nurse_profiles(...),interviews(*)

PostgREST resolves embedded relations using FOREIGN KEY constraints.
The `applications.nurse_id` column had a FK to `auth.users(id)` but NO FK
to `profiles(id)`. Same for `nurse_profiles.nurse_id`. Without these FKs,
PostgREST cannot resolve the `profiles(...)` or `nurse_profiles(...)`
embeds, so the ENTIRE query returns an error / zero rows. This is why
applications were invisible to nurses, hospitals, and admins despite
existing in the database.

Additionally, the `nurse_profiles` SELECT policy only allowed the nurse
themselves or an admin to read rows. Hospitals need to read nurse_profiles
for applicants to their jobs, but were blocked by RLS — so even if the
embed resolved, the nurse_profiles data would be null.

## Fix 1: Add FK from applications.nurse_id → profiles.id
This lets PostgREST resolve `applications?select=...,profiles(...)`.
The existing FK to auth.users(id) is preserved.

## Fix 2: Add FK from nurse_profiles.nurse_id → profiles.id
This lets PostgREST resolve `applications?select=...,nurse_profiles(...)`.
The existing FK to auth.users(id) is preserved.

## Fix 3: Update nurse_profiles SELECT policy
Allow hospitals to read nurse_profiles when the nurse has applied to a
job owned by that hospital. This is scoped via:
  EXISTS (SELECT 1 FROM applications
          JOIN jobs ON jobs.id = applications.job_id
          JOIN hospitals ON hospitals.id = jobs.hospital_id
          WHERE applications.nurse_id = nurse_profiles.nurse_id
            AND hospitals.user_id = auth.uid())

## Data Safety
- No tables created or deleted.
- No columns added, removed, or renamed.
- No data modified.
- All existing FKs and constraints preserved.
- RLS remains enabled on all tables.
*/

-- ============ FIX 1: applications.nurse_id → profiles.id ============
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'applications_nurse_id_profiles_fkey'
      AND conrelid = 'applications'::regclass
  ) THEN
    ALTER TABLE applications
      ADD CONSTRAINT applications_nurse_id_profiles_fkey
      FOREIGN KEY (nurse_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============ FIX 2: nurse_profiles.nurse_id → profiles.id ============
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'nurse_profiles_nurse_id_profiles_fkey'
      AND conrelid = 'nurse_profiles'::regclass
  ) THEN
    ALTER TABLE nurse_profiles
      ADD CONSTRAINT nurse_profiles_nurse_id_profiles_fkey
      FOREIGN KEY (nurse_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============ FIX 3: nurse_profiles SELECT policy ============
-- Drop old policy and recreate with hospital read path
DROP POLICY IF EXISTS "nurse_profiles_select_own_or_admin" ON nurse_profiles;
DROP POLICY IF EXISTS "nurse_profiles_select_own_hospital_or_admin" ON nurse_profiles;

CREATE POLICY "nurse_profiles_select_own_hospital_or_admin"
ON nurse_profiles FOR SELECT
TO authenticated USING (
  nurse_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
  OR EXISTS (
    SELECT 1 FROM applications
    JOIN jobs ON jobs.id = applications.job_id
    JOIN hospitals ON hospitals.id = jobs.hospital_id
    WHERE applications.nurse_id = nurse_profiles.nurse_id
      AND hospitals.user_id = auth.uid()
  )
);
