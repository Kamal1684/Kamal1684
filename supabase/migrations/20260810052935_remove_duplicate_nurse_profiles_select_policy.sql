/*
# Remove duplicate nurse_profiles SELECT policy

Two SELECT policies existed on nurse_profiles:
  1. nurse_profiles_select_own_hospital_or_admin (new — from previous fix)
  2. nurse_profiles_select_own_or_hospital_or_admin (old — from a prior migration)

Both are permissive and don't conflict, but having two is redundant.
Drop the old one to keep the policy set clean.
*/

DROP POLICY IF EXISTS "nurse_profiles_select_own_or_hospital_or_admin" ON nurse_profiles;
