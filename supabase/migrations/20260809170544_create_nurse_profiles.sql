/*
# Create nurse_profiles table

## Overview
Creates a dedicated `nurse_profiles` table to store extended professional
information for nurses. Separate from `profiles` to keep the schema normalized.

## New Table: nurse_profiles
- `id` (uuid, PK)
- `nurse_id` (uuid, NOT NULL, FK → auth.users, UNIQUE, default auth.uid())
- `qualification` (text) — BSc Nursing, GNM, MSc Nursing, etc.
- `nursing_registration_number` (text) — official registration number
- `registration_authority` (text) — issuing authority
- `total_experience` (integer) — total years of experience
- `previous_hospital` (text) — last hospital worked at
- `departments` (text) — comma-separated departments/skills
- `preferred_location` (text) — preferred work location
- `expected_salary` (numeric(10,2)) — expected monthly salary
- `shift_preference` (text) — day / evening / night / flexible
- `accommodation_required` (boolean, default false)
- `availability` (text) — immediately / 2_weeks / 1_month / not_available
- `resume_url` (text) — URL to uploaded resume in private storage
- `verification_status` (text, default 'pending') — pending / verified / rejected
- `created_at` (timestamptz)
- `updated_at` (timestamptz, auto-updated)

## Security (RLS)
- SELECT: nurse reads own profile; admin reads all.
  Hospital read path (via applications) will be added in a later migration
  after the jobs table exists.
- INSERT/UPDATE/DELETE: nurse can only modify own row.

## Notes
1. nurse_id defaults to auth.uid() so insert works without passing it.
2. UNIQUE on nurse_id ensures one profile per nurse.
*/

CREATE TABLE IF NOT EXISTS nurse_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nurse_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  qualification text,
  nursing_registration_number text,
  registration_authority text,
  total_experience integer,
  previous_hospital text,
  departments text,
  preferred_location text,
  expected_salary numeric(10,2),
  shift_preference text CHECK (shift_preference IN ('day', 'evening', 'night', 'flexible')),
  accommodation_required boolean NOT NULL DEFAULT false,
  availability text CHECK (availability IN ('immediately', '2_weeks', '1_month', 'not_available')),
  resume_url text,
  verification_status text NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (nurse_id)
);

ALTER TABLE nurse_profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: nurse reads own, admin reads all
DROP POLICY IF EXISTS "nurse_profiles_select_own_or_admin" ON nurse_profiles;
CREATE POLICY "nurse_profiles_select_own_or_admin"
ON nurse_profiles FOR SELECT
TO authenticated USING (
  nurse_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- INSERT: nurse creates own
DROP POLICY IF EXISTS "nurse_profiles_insert_own" ON nurse_profiles;
CREATE POLICY "nurse_profiles_insert_own"
ON nurse_profiles FOR INSERT
TO authenticated WITH CHECK (nurse_id = auth.uid());

-- UPDATE: nurse updates own
DROP POLICY IF EXISTS "nurse_profiles_update_own" ON nurse_profiles;
CREATE POLICY "nurse_profiles_update_own"
ON nurse_profiles FOR UPDATE
TO authenticated USING (nurse_id = auth.uid()) WITH CHECK (nurse_id = auth.uid());

-- DELETE: nurse deletes own
DROP POLICY IF EXISTS "nurse_profiles_delete_own" ON nurse_profiles;
CREATE POLICY "nurse_profiles_delete_own"
ON nurse_profiles FOR DELETE
TO authenticated USING (nurse_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_nurse_profiles_nurse_id ON nurse_profiles(nurse_id);

DROP TRIGGER IF EXISTS nurse_profiles_updated_at ON nurse_profiles;
CREATE TRIGGER nurse_profiles_updated_at
  BEFORE UPDATE ON nurse_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
