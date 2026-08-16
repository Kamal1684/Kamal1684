/*
# Fix SECURITY DEFINER function execute grants

## Overview
The previous revocation from `anon` was insufficient because PostgreSQL
grants EXECUTE to `PUBLIC` by default (which includes all roles).
This migration revokes EXECUTE from PUBLIC and grants it only to
`authenticated`, so only signed-in users can call these functions.

## Security Changes
- REVOKE EXECUTE ON all SECURITY DEFINER functions FROM PUBLIC
- GRANT EXECUTE only TO authenticated
*/

REVOKE EXECUTE ON FUNCTION is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION calculate_job_match(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_job_match(uuid, uuid) TO authenticated;
