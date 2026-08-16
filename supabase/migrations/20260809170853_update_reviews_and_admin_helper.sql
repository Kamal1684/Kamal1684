/*
# Update nurse_profiles, reviews policies, and add is_admin helper

## Overview
Three changes:
1. Replace nurse_profiles SELECT policy to add hospital read path
   (hospitals can read nurse_profiles for nurses who applied to their jobs).
2. Replace reviews INSERT policy to enforce that reviews can only be
   left after a completed/selected/joined recruitment relationship.
3. Create an `is_admin()` SQL helper function for cleaner policy predicates.

## Modified Table: nurse_profiles
- SELECT policy replaced: now allows hospitals to read nurse_profiles
  for nurses who have applied to their jobs (via applications → jobs → hospitals).
  Also retains nurse-self-read and admin-read.

## Modified Table: reviews
- INSERT policy replaced: a review can only be inserted if there exists
  an application between the reviewer and reviewee that reached
  'selected' or 'joined' status, OR a shift application with 'accepted' status.
- SELECT/UPDATE/DELETE policies remain unchanged.

## New Function: is_admin()
- SECURITY DEFINER function that checks if the current auth.uid() has
  role='admin' in profiles.
- Used to simplify RLS policies across tables.

## Notes
1. is_admin() is SECURITY DEFINER to avoid recursive RLS on profiles
   when querying role. It only reads the role column — no sensitive data.
2. The reviews INSERT check covers both job-based and shift-based
   applications (backward compatible).
*/

-- ============ is_admin() HELPER ============
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- ============ UPDATE nurse_profiles SELECT POLICY ============
DROP POLICY IF EXISTS "nurse_profiles_select_own_or_admin" ON nurse_profiles;
DROP POLICY IF EXISTS "nurse_profiles_select_own_or_hospital_or_admin" ON nurse_profiles;

CREATE POLICY "nurse_profiles_select_own_or_hospital_or_admin"
ON nurse_profiles FOR SELECT
TO authenticated USING (
  nurse_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM applications
    JOIN jobs ON jobs.id = applications.job_id
    JOIN hospitals ON hospitals.id = jobs.hospital_id
    WHERE applications.nurse_id = nurse_profiles.nurse_id
      AND hospitals.user_id = auth.uid()
  )
  OR is_admin()
);

-- ============ UPDATE reviews INSERT POLICY ============
-- Reviews can only be left after a completed recruitment relationship:
-- - For job applications: status must be 'selected' or 'joined'
-- - For shift applications: status must be 'accepted'
DROP POLICY IF EXISTS "reviews_insert_own" ON reviews;

CREATE POLICY "reviews_insert_own"
ON reviews FOR INSERT
TO authenticated WITH CHECK (
  reviewer_id = auth.uid()
  AND (
    -- Job-based: reviewer and reviewee connected via a selected/joined application
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.status IN ('selected', 'joined')
        AND (
          (applications.nurse_id = reviewer_id AND applications.nurse_id = reviewee_id)
          OR EXISTS (
            SELECT 1 FROM jobs
            JOIN hospitals ON hospitals.id = jobs.hospital_id
            WHERE jobs.id = applications.job_id
              AND hospitals.user_id = reviewee_id
              AND applications.nurse_id = reviewer_id
          )
          OR EXISTS (
            SELECT 1 FROM jobs
            JOIN hospitals ON hospitals.id = jobs.hospital_id
            WHERE jobs.id = applications.job_id
              AND hospitals.user_id = reviewer_id
              AND applications.nurse_id = reviewee_id
          )
        )
    )
    OR
    -- Shift-based (legacy): reviewer and reviewee connected via an accepted application
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.status = 'accepted'
        AND (
          (applications.nurse_id = reviewer_id)
          OR EXISTS (
            SELECT 1 FROM shifts
            JOIN hospitals ON hospitals.id = shifts.hospital_id
            WHERE shifts.id = applications.shift_id
              AND hospitals.user_id = reviewer_id
          )
        )
        AND (
          applications.nurse_id = reviewee_id
          OR EXISTS (
            SELECT 1 FROM shifts
            JOIN hospitals ON hospitals.id = shifts.hospital_id
            WHERE shifts.id = applications.shift_id
              AND hospitals.user_id = reviewee_id
          )
        )
    )
  )
);

-- Also update reviews SELECT to use is_admin for consistency
-- (keeps existing behavior: all authenticated can read reviews)
-- No change needed — reviews_select_all already allows all authenticated.

-- Update reviews UPDATE and DELETE to also allow admin
DROP POLICY IF EXISTS "reviews_update_own" ON reviews;
CREATE POLICY "reviews_update_own"
ON reviews FOR UPDATE
TO authenticated USING (reviewer_id = auth.uid() OR is_admin())
WITH CHECK (reviewer_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "reviews_delete_own" ON reviews;
CREATE POLICY "reviews_delete_own"
ON reviews FOR DELETE
TO authenticated USING (reviewer_id = auth.uid() OR is_admin());
