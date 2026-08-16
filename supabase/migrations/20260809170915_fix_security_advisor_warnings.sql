/*
# Fix security advisor warnings

## Overview
Fixes 5 security advisor warnings:
1. Revoke EXECUTE on is_admin() and calculate_job_match() from anon role
   so unauthenticated users cannot call these SECURITY DEFINER functions.
2. Set explicit search_path on update_updated_at_column() to fix the
   mutable search_path warning.

## Security Changes
- REVOKE EXECUTE ON FUNCTION is_admin() FROM anon
- REVOKE EXECUTE ON FUNCTION calculate_job_match(uuid, uuid) FROM anon
- ALTER FUNCTION update_updated_at_column() SET search_path = public

## Notes
1. is_admin() and calculate_job_match() are still executable by authenticated.
2. These are intentional SECURITY DEFINER functions — they need to read
   tables that the caller might not have direct SELECT access to. Restricting
   to authenticated ensures only signed-in users can invoke them.
*/

REVOKE EXECUTE ON FUNCTION is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION calculate_job_match(uuid, uuid) FROM anon;

ALTER FUNCTION update_updated_at_column() SET search_path = public;
